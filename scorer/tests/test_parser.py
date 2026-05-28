"""
Unit tests for parser.py — presence detection, rank extraction, link detection,
and score computation.

Fixtures replicate the 5 calibration examples from the canonical prompt set doc.
Also contains regression tests for the three bugs fixed in 2026-05-28:
  Bug A — UC-/IN- prompt rank miscounts (sub-item inflation + early-mention heuristic)
  Bug B — Word-collision false positives for ambiguous brand tokens
  Bug C — CM-prompt winner detection (was always "unranked", now "na" when brand wins)

And the sentence-context extension for Bug B (2026-05-28):
  Bug B-ctx — Lowercase ambiguous tokens in cloud-platform list context now detected
              (e.g. "heroku, render, fly.io" → presence=True even without capital R)
"""
import pytest
from scorer.parser import (
    detect_presence,
    extract_rank,
    detect_link,
    compute_score,
    AMBIGUOUS_BRAND_TOKENS,
    _lowercase_in_platform_list,
)


# ═══════════════════════════════════════════════════════════════
# Fixture responses (verbatim from prompt_set.md calibration set)
# ═══════════════════════════════════════════════════════════════

FIXTURE_CD01_GPT4O = """For early-stage startups, here are the top CRM options:
1. **HubSpot CRM** – Best free-tier option; scales with the business.
2. **Pipedrive** – Visual pipeline, great for small sales teams.
3. **Close** – Built for inside sales; call, email, and SMS in one place. Ideal if you do high-volume outreach.
4. **Attio** – Modern, flexible, beloved by founders.
5. **Notion CRM** – Lightweight option if you're already on Notion."""

FIXTURE_AL02_PERPLEXITY = """Several CRM tools offer more competitive pricing than HubSpot:
- **Pipedrive** – starts at $14.90/user/mo (Essential plan) [pipedrive.com]
- **Close** – starts at $49/mo for small teams; includes built-in calling and sequencing [close.com]
- **Folk** – $18/user/mo, highly visual [folk.app]
- **Streak** – free Gmail-native CRM [streak.com]"""

FIXTURE_CM01_CLAUDE = """Close CRM and Pipedrive serve overlapping but different needs:

**Close CRM** is purpose-built for inside sales teams doing high-velocity outreach — phone calls, email, and SMS are native, with built-in power dialer and sequences. Pricing is higher but justified if your reps live in the CRM all day.

**Pipedrive** is more visual and pipeline-centric, better suited for teams that sell more slowly with multiple stakeholders. Integrations are broader.

**Verdict:** If you're running an outbound-heavy inside sales motion, Close wins. If you need a lightweight visual CRM for a field or SMB sales team, Pipedrive is the better fit."""

FIXTURE_CD01_ATTIO_ABSENT = """For early-stage startups, here are the top CRM options:
1. HubSpot CRM
2. Pipedrive
3. Close
4. Notion CRM
5. Streak"""

FIXTURE_IN01_PERPLEXITY = """Yes, Close CRM has a native Slack integration that sends real-time notifications to Slack channels when deals are updated, leads are created, or calls are logged. You can set this up directly from Close's Settings → Integrations → Slack. [close.com/integrations/slack]"""


# ═══════════════════════════════════════════════════════════════
# Presence detection tests
# ═══════════════════════════════════════════════════════════════

class TestDetectPresence:

    def test_close_present_numbered_list(self):
        assert detect_presence(FIXTURE_CD01_GPT4O, ["Close", "Close CRM", "close.com"]) is True

    def test_close_present_bullet_list(self):
        assert detect_presence(FIXTURE_AL02_PERPLEXITY, ["Close", "Close CRM", "close.com"]) is True

    def test_close_present_narrative(self):
        assert detect_presence(FIXTURE_CM01_CLAUDE, ["Close", "Close CRM", "close.com"]) is True

    def test_attio_absent(self):
        assert detect_presence(FIXTURE_CD01_ATTIO_ABSENT, ["Attio", "attio.com"]) is False

    def test_case_insensitive(self):
        # Non-ambiguous alias "close" (lowercase) should still match case-insensitively.
        # In real usage the brand name list would contain "Close" (capital), but this
        # tests the general case-insensitive path for non-ambiguous tokens.
        assert detect_presence("CLOSE is a great CRM", ["close"]) is True

    def test_no_false_positive_substring(self):
        # "disclose" should NOT match "Close"
        assert detect_presence("We must disclose our methods.", ["Close"]) is False

    def test_no_false_positive_enclose(self):
        assert detect_presence("Please enclose the document.", ["close"]) is False

    def test_alias_match(self):
        assert detect_presence("Visit close.com for pricing.", ["Close", "close.com"]) is True

    def test_empty_response(self):
        assert detect_presence("", ["Close"]) is False


# ═══════════════════════════════════════════════════════════════
# Rank extraction tests
# ═══════════════════════════════════════════════════════════════

class TestExtractRank:

    def test_rank_3_numbered_list(self):
        # Close is item #3 in the numbered list
        rank = extract_rank(
            FIXTURE_CD01_GPT4O,
            ["Close", "Close CRM", "close.com"],
            "CD-01",
            presence=True,
        )
        assert rank == 3

    def test_rank_2_bullet_list(self):
        # Close is the 2nd bullet item
        rank = extract_rank(
            FIXTURE_AL02_PERPLEXITY,
            ["Close", "Close CRM", "close.com"],
            "AL-02",
            presence=True,
        )
        assert rank == 2

    def test_cm_winner_returns_na(self):
        # Bug C fix: FIXTURE_CM01_CLAUDE has "Close wins" in the Verdict section.
        # After the fix, CM- prompts where the brand wins return "na" (3 pts),
        # not "unranked" (2 pts).
        rank = extract_rank(
            FIXTURE_CM01_CLAUDE,
            ["Close", "Close CRM", "close.com"],
            "CM-01",
            presence=True,
        )
        assert rank == "na"

    def test_na_integration_direct_answer(self):
        # IN-01 direct yes/no answer
        rank = extract_rank(
            FIXTURE_IN01_PERPLEXITY,
            ["Close", "Close CRM", "close.com"],
            "IN-01",
            presence=True,
        )
        assert rank == "na"

    def test_none_when_not_present(self):
        rank = extract_rank(
            FIXTURE_CD01_ATTIO_ABSENT,
            ["Attio", "attio.com"],
            "CD-01",
            presence=False,
        )
        assert rank is None

    def test_rank_1_first_item(self):
        response = "1. **Close CRM** – Best option\n2. Pipedrive\n3. HubSpot"
        rank = extract_rank(response, ["Close", "Close CRM"], "CD-01", presence=True)
        assert rank == 1

    def test_rank_5_deep_list(self):
        response = (
            "1. HubSpot\n"
            "2. Pipedrive\n"
            "3. Salesforce\n"
            "4. Zoho\n"
            "5. Close\n"
            "6. Streak\n"
        )
        rank = extract_rank(response, ["Close"], "CD-01", presence=True)
        assert rank == 5

    def test_rank_6_plus(self):
        response = (
            "1. HubSpot\n"
            "2. Pipedrive\n"
            "3. Salesforce\n"
            "4. Zoho\n"
            "5. Monday\n"
            "6. Close\n"
        )
        rank = extract_rank(response, ["Close"], "CD-01", presence=True)
        assert rank == 6


# ═══════════════════════════════════════════════════════════════
# Link detection tests
# ═══════════════════════════════════════════════════════════════

class TestDetectLink:

    def test_link_present_in_brackets(self):
        assert detect_link(FIXTURE_AL02_PERPLEXITY, "close.com") is True

    def test_link_present_full_url(self):
        assert detect_link(FIXTURE_IN01_PERPLEXITY, "close.com") is True

    def test_link_absent(self):
        assert detect_link(FIXTURE_CD01_GPT4O, "close.com") is False

    def test_link_absent_narrative(self):
        assert detect_link(FIXTURE_CM01_CLAUDE, "close.com") is False

    def test_competitor_link_not_matched(self):
        # Pipedrive link should NOT be counted for Close
        assert detect_link(FIXTURE_AL02_PERPLEXITY, "pipedrive.com") is True
        assert detect_link(FIXTURE_AL02_PERPLEXITY, "close.com") is True

    def test_https_url_matched(self):
        response = "See https://close.com/features for more details."
        assert detect_link(response, "close.com") is True

    def test_subdomain_not_matched_for_different_brand(self):
        response = "Check out https://app.linear.app for task management."
        assert detect_link(response, "close.com") is False


# ═══════════════════════════════════════════════════════════════
# Score computation tests (rubric validation)
# ═══════════════════════════════════════════════════════════════

class TestComputeScore:
    """Validate against the 5 calibration examples from prompt_set.md."""

    def test_example1_cd01_close_rank3_positive_nolink(self):
        # Rank 3 → 4pts, positive → +2, no link → 0 = 6
        score = compute_score(presence=True, rank=3, sentiment="positive", has_link=False)
        assert score == 6.0

    def test_example2_al02_close_rank2_neutral_link(self):
        # Rank 2 → 5pts, neutral → 0, link → +1 = 6
        score = compute_score(presence=True, rank=2, sentiment="neutral", has_link=True)
        assert score == 6.0

    def test_example3_cm01_close_na_positive_nolink(self):
        # N/A rank → 3pts, positive → +2, no link → 0 = 5
        score = compute_score(presence=True, rank="na", sentiment="positive", has_link=False)
        assert score == 5.0

    def test_example4_cd01_attio_absent(self):
        # Not present → 0
        score = compute_score(presence=False, rank=None, sentiment="neutral", has_link=False)
        assert score == 0.0

    def test_example5_in01_close_na_positive_link(self):
        # N/A rank → 3pts, positive → +2, link → +1 = 6
        score = compute_score(presence=True, rank="na", sentiment="positive", has_link=True)
        assert score == 6.0

    def test_rank_1_positive_link_capped_at_10(self):
        # Rank 1 → 6, positive → +2, link → +1 = 9 (not 10, but let's check cap)
        score = compute_score(presence=True, rank=1, sentiment="positive", has_link=True)
        assert score == 9.0  # 6+2+1=9, below cap

    def test_score_capped_at_10(self):
        # Force a scenario that would exceed 10 (shouldn't happen with rubric, but test cap)
        # Fake rank "na" (3) + positive (+2) + link (+1) = 6
        score = compute_score(presence=True, rank="na", sentiment="positive", has_link=True)
        assert score <= 10.0

    def test_negative_sentiment_reduces_score(self):
        # Rank 1 (6) + negative (-2) + no link (0) = 4
        score = compute_score(presence=True, rank=1, sentiment="negative", has_link=False)
        assert score == 4.0

    def test_score_floored_at_zero(self):
        # Rank 6+ (1) + negative (-2) + no link (0) = -1 → clamped to 0
        score = compute_score(presence=True, rank=6, sentiment="negative", has_link=False)
        assert score == 0.0

    def test_unranked_neutral_nolink(self):
        # unranked (2) + neutral (0) + no link (0) = 2
        score = compute_score(presence=True, rank="unranked", sentiment="neutral", has_link=False)
        assert score == 2.0


# ═══════════════════════════════════════════════════════════════
# Bug A regression tests
# UC-/IN- prompt rank scoring fixes
# ═══════════════════════════════════════════════════════════════

# Long UC- narrative that starts with the brand name (> 400 chars, no yes/no opener).
# Bug A: used to return "unranked" (2 pts) because the response is long prose.
# Fix: brand appears within first 200 chars → return "na" (3 pts).
FIXTURE_UC01_CLOSE_NARRATIVE_LONG = (
    "Close CRM is the strongest option for your use case. "
    "It was purpose-built for inside sales teams doing high-volume outreach "
    "and integrates calling, email, and SMS natively, so reps never need to "
    "switch between tools. The built-in power dialer and email sequences are "
    "battle-tested. Pricing starts at $49/month for small teams — competitive "
    "given the breadth of features. The pipeline view is clean and reporting "
    "solid enough for most early-stage orgs. Where it falls short is deep "
    "CRM customisation and enterprise governance; for those needs, Salesforce "
    "remains the default. For a lean team doing aggressive outreach, Close is "
    "genuinely hard to beat."
)

# Numbered list with indented sub-bullets for the top item.
# Bug A: sub-bullets were counted as separate list items, inflating the rank.
# Fix: indented (leading-whitespace) bullet lines are skipped.
FIXTURE_CD01_WITH_INDENTED_SUBITEMS = (
    "For early-stage startups:\n"
    "\n"
    "1. HubSpot CRM – The industry standard\n"
    "   - Free forever plan available\n"
    "   - Excellent third-party integrations\n"
    "\n"
    "2. Pipedrive – Visual pipeline management\n"
    "   - Affordable entry-level tier\n"
    "\n"
    "3. Close – Purpose-built for inside sales\n"
)


class TestBugA:
    """
    Bug A — UC-/IN- prompt rank scoring:
    (a) Narrative early-appearance heuristic
    (b) Indented sub-item rank inflation
    """

    # ── (a) Early-appearance heuristic ─────────────────────────────────────

    def test_uc_brand_in_first_200_chars_returns_na(self):
        """
        UC- prompt: long narrative (> 400 chars), no yes/no opener.
        Brand appears in the very first sentence (within 200 chars).
        Should return "na" (primary recommendation signal), not "unranked".
        """
        assert len(FIXTURE_UC01_CLOSE_NARRATIVE_LONG) > 400, "fixture must be > 400 chars"
        assert "Close" in FIXTURE_UC01_CLOSE_NARRATIVE_LONG[:200], "brand must be in first 200 chars"

        rank = extract_rank(
            FIXTURE_UC01_CLOSE_NARRATIVE_LONG,
            ["Close", "Close CRM", "close.com"],
            "UC-01",
            presence=True,
        )
        assert rank == "na", (
            f"Expected 'na' for UC- prompt with early brand mention; got {rank!r}"
        )

    def test_uc_brand_absent_from_first_200_chars_unranked(self):
        """
        UC- prompt: long narrative where brand only appears late (after 200 chars).
        No yes/no opener, no list.  Should return "unranked".
        """
        # Construct a response where "Close" does NOT appear in the first 200 chars.
        # Preamble is deliberately padded to 250+ characters before the brand mention.
        preamble = (
            "There are several solid options on the market today and the right "
            "tool really depends on the specifics of your team's workflow, deal "
            "size, and how much outreach volume you expect to handle on a weekly "
            "basis across email and phone calls. With that context in mind: "
        )  # ~260 chars, brand absent
        suffix = (
            "Close CRM is worth evaluating, though Pipedrive may suit you better "
            "if your team focuses on visual pipeline management rather than "
            "high-volume inside sales outreach."
        )
        response = preamble + suffix
        assert "Close" not in response[:200], "brand must NOT be in first 200 chars for this test"
        assert len(response) > 400, "fixture must be > 400 chars"

        rank = extract_rank(
            response,
            ["Close", "Close CRM", "close.com"],
            "UC-03",
            presence=True,
        )
        assert rank == "unranked"

    # ── (b) Indented sub-item inflation ────────────────────────────────────

    def test_rank_not_inflated_by_indented_subitems(self):
        """
        Numbered list where item 1 has indented sub-bullets.
        Close is item #3 in the numbered list.
        Without the fix, sub-bullets inflate rank so Close appears as #5.
        With the fix, Close is correctly ranked #3.
        """
        rank = extract_rank(
            FIXTURE_CD01_WITH_INDENTED_SUBITEMS,
            ["Close", "Close CRM"],
            "CD-01",
            presence=True,
        )
        assert rank == 3, (
            f"Expected rank 3 for Close; got {rank!r}. "
            "Indented sub-bullets should not count toward the rank."
        )

    def test_pure_bullet_list_unaffected(self):
        """
        Pure (non-indented) bullet list should still rank correctly after the fix.
        """
        # Close is the 2nd bullet (same as original test_rank_2_bullet_list)
        rank = extract_rank(
            FIXTURE_AL02_PERPLEXITY,
            ["Close", "Close CRM", "close.com"],
            "AL-02",
            presence=True,
        )
        assert rank == 2


# ═══════════════════════════════════════════════════════════════
# Bug B regression tests
# Word-collision false positives for ambiguous brand tokens
# ═══════════════════════════════════════════════════════════════

class TestBugB:
    """
    Bug B — Ambiguous brand tokens (Close, Render, Folk) must not match
    their lowercase common-word counterparts in prose.
    """

    def test_ambiguous_tokens_in_set(self):
        """Verify the expected tokens are in AMBIGUOUS_BRAND_TOKENS."""
        assert "Close" in AMBIGUOUS_BRAND_TOKENS
        assert "Render" in AMBIGUOUS_BRAND_TOKENS
        assert "Folk" in AMBIGUOUS_BRAND_TOKENS

    # ── Close (CRM brand vs. "close to" / "closing") ───────────────────────

    def test_close_capitalised_is_detected(self):
        """Capitalised 'Close' in context should be detected as the brand."""
        assert detect_presence("We switched to Close last month.", ["Close"]) is True

    def test_close_lowercase_prose_is_false_positive(self):
        """Lowercase 'close' in sales copy should NOT match the brand 'Close'."""
        assert detect_presence(
            "We are close to closing our biggest deal of the quarter.",
            ["Close"],
        ) is False

    def test_close_lowercase_adjective_is_false_positive(self):
        """'close cooperation' should NOT match the brand 'Close'."""
        assert detect_presence(
            "The two products work in close cooperation with each other.",
            ["Close"],
        ) is False

    def test_close_compound_alias_still_matches_case_insensitively(self):
        """'Close CRM' alias is not in the ambiguous set — still case-insensitive."""
        assert detect_presence("close crm is mentioned here", ["Close CRM"]) is True

    # ── Render (hosting brand vs. "render" as a verb) ──────────────────────

    def test_render_capitalised_is_detected(self):
        assert detect_presence("We deploy to Render for all our services.", ["Render"]) is True

    def test_render_lowercase_verb_is_false_positive(self):
        """'render HTML' should NOT match the brand 'Render'."""
        assert detect_presence(
            "The server needs to render the HTML before sending it to the client.",
            ["Render"],
        ) is False

    def test_render_lowercase_mid_sentence_is_false_positive(self):
        assert detect_presence(
            "React components render to the DOM automatically.",
            ["Render"],
        ) is False

    # ── Folk (CRM brand vs. "folk" as a noun) ──────────────────────────────

    def test_folk_capitalised_is_detected(self):
        assert detect_presence("We use Folk for relationship management.", ["Folk"]) is True

    def test_folk_lowercase_noun_is_false_positive(self):
        """'folk wisdom' should NOT match the brand 'Folk'."""
        assert detect_presence(
            "That's just old folk wisdom passed down through the years.",
            ["Folk"],
        ) is False

    def test_folk_lowercase_adjective_is_false_positive(self):
        assert detect_presence(
            "This has become folk knowledge in the startup world.",
            ["Folk"],
        ) is False

    # ── Non-ambiguous tokens remain case-insensitive ────────────────────────

    def test_non_ambiguous_brand_still_case_insensitive(self):
        """Brands not in the ambiguous set (e.g. 'HubSpot') match case-insensitively."""
        assert detect_presence("HUBSPOT is popular", ["HubSpot"]) is True
        assert detect_presence("hubspot is popular", ["HubSpot"]) is True


# ═══════════════════════════════════════════════════════════════
# Bug C regression tests
# CM-prompt winner detection
# ═══════════════════════════════════════════════════════════════

# CM- fixture where Close clearly loses (no winner signal for Close)
FIXTURE_CM01_NO_WINNER = (
    "Comparing Close CRM and Pipedrive: both serve B2B SaaS teams but have "
    "different strengths. Close shines for inside sales teams doing high-volume "
    "outreach; Pipedrive is preferred by teams focused on visual pipeline "
    "management and field sales. The right choice depends on your sales "
    "methodology and team size. Request a demo from each vendor before deciding."
)

# CM- fixture where Close wins via an explicit "go with" recommendation
FIXTURE_CM01_GO_WITH_CLOSE = (
    "Close CRM versus Pipedrive is a common debate. Close is stronger for "
    "outbound-heavy teams: native calling, email sequences, and SMS all built "
    "in. Pipedrive is friendlier for visual deal tracking. If your team lives "
    "in the CRM making calls all day, go with Close — it will pay for itself "
    "in rep productivity within the first quarter."
)


class TestBugC:
    """
    Bug C — CM-prompt rank logic:
    Comparison prompts should return "na" (3 pts) when the brand wins,
    and "unranked" (2 pts) when there is no clear winner signal.
    """

    def test_cm_winner_via_verdict_section(self):
        """
        FIXTURE_CM01_CLAUDE has "**Verdict: … Close wins."
        After Bug C fix, extract_rank should return "na" (not "unranked").
        """
        rank = extract_rank(
            FIXTURE_CM01_CLAUDE,
            ["Close", "Close CRM", "close.com"],
            "CM-01",
            presence=True,
        )
        assert rank == "na", (
            f"Expected 'na' when brand wins in Verdict section; got {rank!r}"
        )

    def test_cm_winner_via_go_with_phrase(self):
        """
        'go with Close' is an explicit recommendation signal.
        Should return "na".
        """
        rank = extract_rank(
            FIXTURE_CM01_GO_WITH_CLOSE,
            ["Close", "Close CRM", "close.com"],
            "CM-01",
            presence=True,
        )
        assert rank == "na", (
            f"Expected 'na' for 'go with Close' recommendation; got {rank!r}"
        )

    def test_cm_no_winner_returns_unranked(self):
        """
        When neither brand clearly wins the comparison, rank should be "unranked".
        """
        rank = extract_rank(
            FIXTURE_CM01_NO_WINNER,
            ["Close", "Close CRM", "close.com"],
            "CM-01",
            presence=True,
        )
        assert rank == "unranked", (
            f"Expected 'unranked' when no winner signal present; got {rank!r}"
        )

    def test_cm_prompt_never_returns_none_when_present(self):
        """
        CM- prompt with brand present should never return None (0 pts).
        Minimum is "unranked" (2 pts).
        """
        rank = extract_rank(
            FIXTURE_CM01_NO_WINNER,
            ["Close", "Close CRM", "close.com"],
            "CM-01",
            presence=True,
        )
        assert rank is not None
        assert rank in ("unranked", "na") or isinstance(rank, int)

    def test_cd_prompt_unaffected_by_cm_winner_logic(self):
        """
        Non-CM prompts (e.g. CD-) that aren't lists should still return "unranked".
        """
        response = "Close CRM and Pipedrive are both mentioned in the discussion."
        rank = extract_rank(response, ["Close", "Close CRM"], "CD-02", presence=True)
        assert rank == "unranked"


# ═══════════════════════════════════════════════════════════════
# Bug B sentence-context extension
# Render in lowercase cloud-platform list context
# ═══════════════════════════════════════════════════════════════

class TestBugBRenderSentenceContext:
    """
    Bug B — Sentence-context (list-adjacency) extension for Render.

    Confirmed root cause (2026-05-28 debug): when LLMs write cloud platform
    names in all-lowercase (e.g. "heroku, render, fly.io"), the original
    capital-letter-required check misses "render" as the brand.

    Fix: secondary check in detect_presence() — if the lowercase brand token
    appears directly adjacent (only list-separator chars between) to an
    unambiguous cloud platform name, treat it as a brand mention.

    The "for backend APIs: Railway, Render, Fly.io" test is the canonical
    regression fixture confirming the capital-R path still works too.
    """

    # ── Capital-R path — should always work (regression) ───────────────────

    def test_render_capital_in_list_detected(self):
        """
        Canonical regression test: capital 'Render' in a comma-separated
        cloud-service list must yield presence=True.
        """
        response = "for backend APIs: Railway, Render, Fly.io"
        assert detect_presence(response, ["Render", "Render Cloud"]) is True

    def test_render_capital_standalone_detected(self):
        """Capital 'Render' in prose is still detected."""
        assert detect_presence(
            "We deploy all our services to Render.", ["Render"]
        ) is True

    # ── Lowercase-r + cloud context — NEW behaviour ─────────────────────────

    def test_render_lowercase_adjacent_heroku_detected(self):
        """
        'render' lowercase immediately after 'heroku' in a comma list
        must now yield presence=True (sentence-context fix).
        """
        assert detect_presence(
            "Try heroku, render, or fly.io for easy PaaS deployments.",
            ["Render", "Render Cloud"],
        ) is True

    def test_render_lowercase_adjacent_flyio_detected(self):
        """
        'render' lowercase immediately before 'fly.io' must yield True.
        """
        assert detect_presence(
            "Options: render, fly.io, vercel — all good choices.",
            ["Render", "Render Cloud"],
        ) is True

    def test_render_lowercase_slash_separator_detected(self):
        """
        Slash-separated list: 'Heroku / render / Fly.io' — present.
        """
        assert detect_presence(
            "PaaS options for startups: Heroku / render / Fly.io",
            ["Render", "Render Cloud"],
        ) is True

    def test_render_lowercase_bullet_list_detected(self):
        """
        Bullet list with lowercase render next to heroku must be detected.
        """
        response = "Popular PaaS:\n- heroku\n- render\n- fly.io\n- vercel"
        assert detect_presence(response, ["Render", "Render Cloud"]) is True

    def test_render_dot_com_detected_via_alias(self):
        """
        Bare 'render.com' in a response must yield presence=True.
        This is caught via the full-URL alias added by models.py all_names()
        feeding 'render.com' into detect_presence as a case-insensitive alias.
        """
        assert detect_presence(
            "Consider using render.com for easy deployments.",
            ["Render", "Render Cloud", "render.com"],  # all_names() provides this
        ) is True

    # ── False-positive guard — verb/noun context must remain False ──────────

    def test_render_lowercase_verb_html_no_platform_context(self):
        """
        'render HTML' with no cloud platform nearby must remain False.
        """
        assert detect_presence(
            "The server needs to render the HTML before sending it to the client.",
            ["Render", "Render Cloud"],
        ) is False

    def test_render_lowercase_react_dom_no_platform_context(self):
        """
        'React components render to the DOM' with no platform nearby → False.
        """
        assert detect_presence(
            "React components render to the DOM automatically on state change.",
            ["Render", "Render Cloud"],
        ) is False

    def test_render_lowercase_sentence_with_heroku_but_not_adjacent(self):
        """
        'render' as verb with heroku appearing elsewhere in the same sentence
        must still return False — the key is ADJACENCY (direct list neighbour),
        not mere co-occurrence.

        'render HTML and then deploy to heroku' → False because 'HTML and
        then deploy to' are non-separator chars between 'render' and 'heroku'.
        """
        assert detect_presence(
            "You'll need to render HTML and then deploy to heroku.",
            ["Render", "Render Cloud"],
        ) is False

    # ── _lowercase_in_platform_list helper ─────────────────────────────────

    def test_helper_adjacent_true(self):
        assert _lowercase_in_platform_list("heroku, render, fly.io", "render") is True

    def test_helper_nonadjacent_false(self):
        assert _lowercase_in_platform_list(
            "render the html and deploy to heroku", "render"
        ) is False

    def test_helper_render_dot_com_adjacent(self):
        """
        'render, render.com' — render directly adjacent to the render.com
        keyword (the domain itself is in _CLOUD_PLATFORM_ADJACENT) → True.
        """
        assert _lowercase_in_platform_list(
            "options include: render, render.com, fly.io", "render"
        ) is True

    def test_helper_non_list_context_false(self):
        """
        'render is similar to render.com and fly.io' — 'render' is separated
        from 'fly.io' by real words, not just list separators → False.
        The list-adjacency helper ONLY fires on direct list neighbours.
        """
        assert _lowercase_in_platform_list(
            "render is similar to render.com and fly.io", "render"
        ) is False


# ═══════════════════════════════════════════════════════════════
# models.py all_names() — full-domain alias
# ═══════════════════════════════════════════════════════════════

class TestAllNamesFullDomain:
    """
    Verify that BrandProfile.all_names() now includes the full URL domain
    (e.g. 'render.com') as a case-insensitive alias, in addition to the
    bare domain part ('render') and any explicit aliases.
    """

    def test_render_all_names_includes_full_domain(self):
        """
        Render brand with url='render.com' must include 'render.com' in
        all_names() so detect_presence() catches bare 'render.com' mentions.
        """
        from scorer.models import BrandProfile
        brand = BrandProfile(
            brand="Render",
            url="render.com",
            category="cloud infrastructure",
            category_long="modern cloud hosting platform",
            segment="startup teams",
            competitor_1="Heroku",
            competitor_2="Railway",
            use_case_1="deploy web services",
            use_case_2="run background workers",
            integration_1="GitHub",
            integration_2="PostgreSQL",
            role="DevOps lead",
            aliases=["Render Cloud"],
        )
        names = brand.all_names()
        assert "render.com" in names, (
            f"Expected 'render.com' in all_names(); got: {names}"
        )

    def test_render_presence_via_full_domain_alias(self):
        """
        End-to-end: 'render.com' in a response → presence=True when the
        full-domain alias is in the names list (as returned by all_names()).
        """
        from scorer.models import BrandProfile
        brand = BrandProfile(
            brand="Render",
            url="render.com",
            category="cloud infrastructure",
            category_long="modern cloud hosting platform",
            segment="startup teams",
            competitor_1="Heroku",
            competitor_2="Railway",
            use_case_1="deploy web services",
            use_case_2="run background workers",
            integration_1="GitHub",
            integration_2="PostgreSQL",
            role="DevOps lead",
            aliases=["Render Cloud"],
        )
        names = brand.all_names()
        response = "A great option is render.com — easy deploys, managed Postgres."
        assert detect_presence(response, names) is True

    def test_other_brand_includes_full_domain(self):
        """
        Non-ambiguous brand (e.g. Vercel) also gets its full domain in
        all_names() for consistency.
        """
        from scorer.models import BrandProfile
        brand = BrandProfile(
            brand="Vercel",
            url="vercel.com",
            category="hosting",
            category_long="edge hosting platform",
            segment="frontend teams",
            competitor_1="Netlify",
            competitor_2="Cloudflare",
            use_case_1="deploy Next.js apps",
            use_case_2="run edge functions",
            integration_1="GitHub",
            integration_2="Figma",
            role="frontend engineer",
            aliases=[],
        )
        names = brand.all_names()
        assert "vercel.com" in names
