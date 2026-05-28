"""
Response parsing: presence detection, rank extraction, link detection.
Sentiment is handled separately via LLM call in scorer.py.
"""
from __future__ import annotations
import re
from typing import Any, List, Optional, Tuple


# ── Ambiguous brand tokens ─────────────────────────────────────────────────
# These brand names are also common English words/verbs. For these EXACT
# strings, detect_presence() requires a case-sensitive match so that
# lowercase prose usage ("close to", "render HTML", "folk music") is not
# counted as a brand mention.  Only the capitalised form in this set triggers
# the case-sensitive path; lowercase aliases (e.g. "close.com") bypass it.
AMBIGUOUS_BRAND_TOKENS: frozenset[str] = frozenset({
    "Close",    # verb/adjective conflict
    "Render",   # verb conflict (render HTML, render output)
    "Folk",     # noun conflict (folk music, folk wisdom)
    "Linear",   # adjective conflict (linear scaling, linear algebra)
    "Sentry",   # noun conflict (sentry guard, on sentry duty)
})


# ── Presence detection ─────────────────────────────────────────────────────

def detect_presence(response: str, brand_names: List[str]) -> bool:
    """
    Return True if any brand name (or alias) appears in the response.

    Case-insensitive by default.  For names in AMBIGUOUS_BRAND_TOKENS the
    match is case-SENSITIVE so that common-word usages ("close to",
    "render HTML") are not counted as brand mentions.  Only the exact
    capitalised form in the set triggers the strict path; compound aliases
    like "Close CRM" or "close.com" are matched case-insensitively.

    Requires word-boundary match to avoid false positives
    (e.g. "close" matching "disclose").

    Bug B fix: case-sensitive matching for ambiguous single-word brand tokens.
    """
    resp_lower = response.lower()
    for name in brand_names:
        if name in AMBIGUOUS_BRAND_TOKENS:
            # Case-sensitive: the brand name must appear capitalised in the text.
            cap_pattern = r"(?<![a-zA-Z0-9])" + re.escape(name) + r"(?![a-zA-Z0-9])"
            if re.search(cap_pattern, response):   # no re.IGNORECASE
                return True
        else:
            # General case: case-insensitive word-boundary match.
            pattern = r"(?<![a-zA-Z0-9])" + re.escape(name.lower()) + r"(?![a-zA-Z0-9])"
            if re.search(pattern, resp_lower):
                return True
    return False


# ── Rank extraction helpers ────────────────────────────────────────────────

def _find_brand_in_list_items(
    response: str, brand_names: List[str]
) -> Optional[int]:
    """
    Scan numbered or bulleted list items for a brand mention.
    Returns 1-based rank if found in a list, else None.

    Handles patterns like:
      1. Brand Name — description
      1) Brand Name
      - **Brand Name**
      * Brand Name

    Bug A fix (sub-item variant): indented bullet lines (lines whose first
    character is a space or tab) inside a numbered list are treated as
    sub-items and NOT counted toward the rank.  This prevents indented
    sub-bullets from inflating the rank counter:

        1. HubSpot
           - Free tier      ← was incorrectly counted as rank 2
        2. Close             ← was incorrectly reported as rank 3
    """
    lines = response.split("\n")
    rank = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue  # skip blank lines

        # Detect indented lines (potential sub-items)
        has_leading_whitespace = bool(line) and line[0] in (' ', '\t')

        # Numbered list: "1.", "1)", "(1)", "1 -", etc.
        numbered_match = re.match(r"^(?:\(?\d+\)?[\.\):-]?\s+)", stripped)
        # Bullet list: "-", "*", "•", "▪"
        bullet_match = re.match(r"^[-*•▪]\s+", stripped)

        # Bug A fix: skip indented bullet sub-items.  If the original line
        # has leading whitespace and matches a bullet (but not a number),
        # it is a sub-item of a parent numbered list item — skip it.
        if has_leading_whitespace and bullet_match and not numbered_match:
            continue

        if numbered_match or bullet_match:
            rank += 1
            # Check if this line contains the brand
            line_lower = stripped.lower()
            for name in brand_names:
                pattern = r"(?<![a-zA-Z0-9])" + re.escape(name.lower()) + r"(?![a-zA-Z0-9])"
                if re.search(pattern, line_lower):
                    return rank

    return None


def _detect_cm_winner(response: str, brand_names: List[str]) -> bool:
    """
    Detect if the tracked brand "wins" a CM- (comparison) prompt response.
    Scans for verdict/recommendation sections and winner-signal phrases near
    the brand name.

    Returns True if the brand appears to be the recommended option.

    Bug C fix: enables CM- prompts to return "na" (3 pts) instead of
    "unranked" (2 pts) when the brand clearly wins the comparison.
    """
    resp_lower = response.lower()

    for name in brand_names:
        name_lower = name.lower()
        brand_esc = re.escape(name_lower)
        # Word-boundary pattern for the brand name in lowercase text
        name_pattern = r"(?<![a-zA-Z0-9])" + brand_esc + r"(?![a-zA-Z0-9])"

        # Pattern 1: "[brand] … wins / is best / comes out ahead"
        # Limit the gap to 50 chars to avoid matching across paragraphs.
        p1 = (
            r"(?<![a-zA-Z0-9])" + brand_esc + r"(?![a-zA-Z0-9])"
            + r"[\s\w,\.]{0,50}"
            + r"(?:wins|winner|is best|comes out ahead|is the better choice"
            r"|wins out|is the clear choice|is the winner)"
        )
        if re.search(p1, resp_lower):
            return True

        # Pattern 2: "go with / choose / pick / recommend / opt for [brand]"
        p2 = (
            r"(?:go with|choose|pick|recommend|opt for)\s+[\w\s]{0,20}"
            + r"(?<![a-zA-Z0-9])" + brand_esc + r"(?![a-zA-Z0-9])"
        )
        if re.search(p2, resp_lower):
            return True

        # Pattern 3: verdict / recommendation section that names the brand
        verdict_sections = re.findall(
            r"(?:verdict|winner|recommendation|bottom line|our pick)"
            r"\s*[:\-]\s*([^\n]{0,300})",
            resp_lower,
        )
        for section in verdict_sections:
            if re.search(name_pattern, section):
                return True

    return False


# ── Rank extraction ────────────────────────────────────────────────────────

def extract_rank(
    response: str,
    brand_names: List[str],
    prompt_id: str,
    presence: bool,
) -> Any:
    """
    Determine rank signal.
    Returns: int (1-based), "unranked", "na", or None (if not present).

    Bug A fix (narrative variant): for UC- and IN- prompts, if the brand
    appears within the first 200 characters of a long narrative response,
    return "na" (3 pts) rather than "unranked" (2 pts).  Early mention in a
    narrative answer is a strong signal that it is the primary recommendation.

    Bug C fix: for CM- prompts, run winner detection.  If the brand wins the
    head-to-head comparison, return "na" (3 pts) instead of "unranked" (2 pts).
    """
    if not presence:
        return None

    rank_in_list = _find_brand_in_list_items(response, brand_names)
    if rank_in_list is not None:
        return rank_in_list

    # Not in a list — determine if this is an N/A-type response
    # IN- and UC- prompts often produce direct narrative answers
    prompt_prefix = prompt_id[:3].upper()
    is_direct_answer_prompt = prompt_prefix in ("IN-", "UC-")

    # Heuristic: if response starts with Yes/No or is short (< 400 chars),
    # it's a direct answer → N/A rank
    resp_stripped = response.strip()
    starts_with_direct = bool(
        re.match(r"^(yes|no|absolutely|certainly|indeed)[,\. ]", resp_stripped, re.IGNORECASE)
    )

    if is_direct_answer_prompt:
        # Bug A fix (narrative): also return "na" when the brand appears within
        # the first 200 characters, indicating it is the early/primary recommendation.
        first_200 = resp_stripped[:200].lower()
        brand_in_first_200 = any(
            re.search(
                r"(?<![a-zA-Z0-9])" + re.escape(n.lower()) + r"(?![a-zA-Z0-9])",
                first_200,
            )
            for n in brand_names
        )
        if starts_with_direct or len(resp_stripped) < 400 or brand_in_first_200:
            return "na"

    # Bug C fix: CM- prompts — check if the brand wins the comparison.
    if prompt_prefix == "CM-":
        if _detect_cm_winner(response, brand_names):
            return "na"

    # Brand is mentioned but not in a list → unranked
    return "unranked"


# ── Link detection ─────────────────────────────────────────────────────────

def detect_link(response: str, brand_url: str) -> bool:
    """
    Return True if a URL pointing to the brand's domain appears in the response.
    Handles: close.com, www.close.com, https://close.com/...
    """
    # Extract the root domain (e.g. "close.com" from "close.com" or "https://www.close.com/foo")
    domain = brand_url.lower().lstrip("https://").lstrip("http://").lstrip("www.").split("/")[0]
    # Match any URL containing that domain
    pattern = r"https?://(?:www\.)?" + re.escape(domain) + r"(?:[/\w\-\.%?=#&@]*)?"
    if re.search(pattern, response, re.IGNORECASE):
        return True
    # Also match bare domain mentions in citation-style [source.com]
    bare_pattern = r"\[?" + re.escape(domain) + r"\]?"
    if re.search(bare_pattern, response, re.IGNORECASE):
        return True
    return False


# ── Score computation ──────────────────────────────────────────────────────

def compute_score(
    presence: bool,
    rank: Any,
    sentiment: str,
    has_link: bool,
) -> float:
    """
    Apply the scoring rubric and return a 0–10 score.
    """
    from .config import RANK_POINTS, SENTIMENT_ADJ, LINK_ADJ

    if not presence:
        return 0.0

    # Get base rank points
    if rank is None:
        base = 0
    elif isinstance(rank, int):
        if rank <= 5:
            base = RANK_POINTS.get(rank, 1)
        else:
            base = 1  # rank 6+
    elif rank == "unranked":
        base = RANK_POINTS["unranked"]
    elif rank == "na":
        base = RANK_POINTS["na"]
    else:
        base = 0

    adj = SENTIMENT_ADJ.get(sentiment, 0) + LINK_ADJ.get(has_link, 0)
    score = base + adj
    return float(max(0.0, min(10.0, score)))
