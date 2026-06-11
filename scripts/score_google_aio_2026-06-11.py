"""One-off Google AI Overviews scoring run for the 100-brand leaderboard.

Budget: 200 SerpAPI queries (2 per brand × 100 brands). Hard stop at 199.

Two prompts per brand:
  - CD-01: "What is the best {CATEGORY} for {SEGMENT}?"
  - AL-01: "Alternatives to {COMPETITOR_1} for {SEGMENT}"

Scoring:
  - present_cd01: bool — brand or any alias appears in the CD-01 AI Overview
  - present_al01: bool — same for AL-01
  - google_aio: int — (cd01 + al01) * 50 → values: 0, 50, 100

Incremental save every 5 brands to scripts/google_aio_progress.json so a
crash never loses more than 4 brands × 2 queries = 8 wasted calls.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Manually load .env.local so this runs without `pnpm` / Next.js loaders.
ENV_FILE = ROOT / ".env.local"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

if not os.getenv("SERPAPI_KEY"):
    print("ERROR: SERPAPI_KEY not found in .env.local")
    sys.exit(1)

from scorer.clients import google_client  # noqa: E402

# --- config ---
BRAND_CSV       = ROOT / "brands_100.csv"
OUTPUT_FILE     = ROOT / "scripts" / "google_aio_results_2026-06-11.json"
PROGRESS_FILE   = ROOT / "scripts" / "google_aio_progress.json"
HARD_QUERY_CAP  = 199             # 200 budget - 1 safety
SAVE_EVERY      = 5               # save progress every N brands
SLEEP_BETWEEN_S = 0.5             # courtesy delay; SerpAPI rate-limit is 250/hr

# --- brand alias matching ---

def brand_aliases(row: dict) -> list[str]:
    """All forms of the brand name worth detecting in AI Overview text."""
    aliases = {row["brand"].strip()}
    if row.get("aliases"):
        for a in row["aliases"].split(","):
            a = a.strip()
            if a:
                aliases.add(a)
    # also try domain stem (vercel.com → vercel)
    if row.get("url"):
        stem = row["url"].split(".")[0]
        if stem and len(stem) >= 3:
            aliases.add(stem)
    return sorted(aliases, key=len, reverse=True)


def brand_mentioned(ai_overview_text: str, aliases: list[str]) -> bool:
    """Case-insensitive word-boundary match for any alias."""
    if not ai_overview_text or ai_overview_text == "NO_AI_OVERVIEW":
        return False
    lower = ai_overview_text.lower()
    for alias in aliases:
        # word-boundary so "Render" doesn't match "rendering"
        pat = r"\b" + re.escape(alias.lower()) + r"\b"
        if re.search(pat, lower):
            return True
    return False


# --- prompt rendering ---

def render_cd01(row: dict) -> str:
    return f"What is the best {row['category']} for {row['segment']}?"


def render_al01(row: dict) -> str:
    return f"Alternatives to {row['competitor_1']} for {row['segment']}"


# --- runner ---

def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text())
        except Exception:
            pass
    return {"brands": {}, "queries_used": 0, "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def save_progress(state: dict) -> None:
    PROGRESS_FILE.write_text(json.dumps(state, indent=2))


def query_with_handling(prompt: str) -> tuple[str | None, str | None]:
    """Return (ai_overview_text_or_none, error_or_none)."""
    try:
        text = google_client.query(prompt)
        return text, None
    except Exception as e:
        return None, str(e)


def main() -> int:
    with BRAND_CSV.open() as f:
        rows = list(csv.DictReader(f))
    print(f"loaded {len(rows)} brands from {BRAND_CSV.name}")

    state = load_progress()
    already_done = set(state["brands"].keys())
    remaining = [r for r in rows if r["brand"] not in already_done]
    if already_done:
        print(f"resuming — {len(already_done)} brands already scored, "
              f"{state['queries_used']} queries used")

    print(f"about to score {len(remaining)} brands · "
          f"hard cap {HARD_QUERY_CAP} queries · "
          f"{HARD_QUERY_CAP - state['queries_used']} remaining in budget")
    if (HARD_QUERY_CAP - state["queries_used"]) < len(remaining) * 2:
        max_brands = (HARD_QUERY_CAP - state["queries_used"]) // 2
        print(f"WARNING: budget allows only {max_brands} more brands. truncating.")
        remaining = remaining[:max_brands]

    consecutive_errors = 0

    for i, row in enumerate(remaining, start=1):
        brand_name = row["brand"]
        aliases = brand_aliases(row)
        result: dict = {"brand": brand_name, "aliases": aliases}

        # CD-01
        if state["queries_used"] >= HARD_QUERY_CAP:
            print(f"[{i}/{len(remaining)}] {brand_name}: budget exhausted, stopping")
            break
        prompt_cd = render_cd01(row)
        text_cd, err_cd = query_with_handling(prompt_cd)
        state["queries_used"] += 1
        if err_cd:
            consecutive_errors += 1
            print(f"[{i}/{len(remaining)}] {brand_name} CD-01 ERROR: {err_cd}")
            if consecutive_errors >= 3:
                print("3 consecutive errors — aborting run, partial results saved")
                save_progress(state)
                return 2
        else:
            consecutive_errors = 0
        result["cd01_prompt"] = prompt_cd
        result["cd01_triggered"] = text_cd not in (None, "NO_AI_OVERVIEW")
        result["cd01_present"] = brand_mentioned(text_cd or "", aliases)
        result["cd01_text_preview"] = (text_cd or "")[:300]

        # courtesy delay
        time.sleep(SLEEP_BETWEEN_S)

        # AL-01
        if state["queries_used"] >= HARD_QUERY_CAP:
            print(f"[{i}/{len(remaining)}] {brand_name}: budget exhausted before AL-01, saving CD-01 only")
            state["brands"][brand_name] = result
            break
        prompt_al = render_al01(row)
        text_al, err_al = query_with_handling(prompt_al)
        state["queries_used"] += 1
        if err_al:
            consecutive_errors += 1
            print(f"[{i}/{len(remaining)}] {brand_name} AL-01 ERROR: {err_al}")
            if consecutive_errors >= 3:
                print("3 consecutive errors — aborting run, partial results saved")
                state["brands"][brand_name] = result
                save_progress(state)
                return 2
        else:
            consecutive_errors = 0
        result["al01_prompt"] = prompt_al
        result["al01_triggered"] = text_al not in (None, "NO_AI_OVERVIEW")
        result["al01_present"] = brand_mentioned(text_al or "", aliases)
        result["al01_text_preview"] = (text_al or "")[:300]

        # Compute score
        mentions = int(bool(result.get("cd01_present"))) + int(bool(result.get("al01_present")))
        result["google_aio_score"] = mentions * 50  # 0, 50, or 100

        state["brands"][brand_name] = result

        status = "✓" if mentions > 0 else "·"
        print(f"[{i}/{len(remaining)}] {status} {brand_name}: "
              f"CD={int(bool(result['cd01_present']))} AL={int(bool(result['al01_present']))} "
              f"→ score={result['google_aio_score']} · queries used: {state['queries_used']}")

        if i % SAVE_EVERY == 0:
            save_progress(state)

        time.sleep(SLEEP_BETWEEN_S)

    # Final save + copy to output
    save_progress(state)
    OUTPUT_FILE.write_text(json.dumps(state, indent=2))
    print(f"\ndone. {len(state['brands'])}/100 brands scored, "
          f"{state['queries_used']} queries used. "
          f"output: {OUTPUT_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
