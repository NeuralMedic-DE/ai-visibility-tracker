#!/usr/bin/env python3
"""
build_leaderboard.py
====================
Merges live scorer output from scorer_output/YYYY-MM-DD/summary.json into
data/leaderboard_v1.json, tagging each brand row with a `data_source` field:

  "verified_YYYY-MM-DD"  — live API score from that run
  "estimated"            — research-based offline estimate

Usage:
  python scripts/build_leaderboard.py [--run-date YYYY-MM-DD]

Default run-date: 2026-05-28  (the first real scoring run)

After running, re-deploy or run `npm run build` to pick up the updated JSON.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone


# ── Paths ─────────────────────────────────────────────────────────────────────

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(WORKSPACE, "data")
LEADERBOARD_PATH = os.path.join(DATA_DIR, "leaderboard_v1.json")


# ── Helpers ───────────────────────────────────────────────────────────────────

def norm_name(s: str) -> str:
    """Lowercase + strip all non-alphanumeric chars for fuzzy name matching."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def norm_domain(s: str) -> str:
    """Lowercase, strip www. prefix and trailing slash."""
    return s.lower().removeprefix("www.").rstrip("/")


# ── Main ─────────────────────────────────────────────────────────────────────

def build(run_date: str) -> None:
    summary_path = os.path.join(WORKSPACE, "scorer_output", run_date, "summary.json")

    if not os.path.exists(summary_path):
        sys.exit(f"ERROR: scorer output not found at {summary_path}")
    if not os.path.exists(LEADERBOARD_PATH):
        sys.exit(f"ERROR: leaderboard JSON not found at {LEADERBOARD_PATH}")

    with open(summary_path, encoding="utf-8") as f:
        summary = json.load(f)

    with open(LEADERBOARD_PATH, encoding="utf-8") as f:
        leaderboard = json.load(f)

    verified_label = f"verified_{run_date}"

    # Build lookup tables from summary brands
    summary_by_name: dict = {}
    summary_by_domain: dict = {}
    for sb in summary["brands"]:
        summary_by_name[norm_name(sb["brand"])] = sb
        summary_by_domain[norm_domain(sb["url"])] = sb

    verified: list[str] = []
    estimated: list[str] = []
    unmatched_summary: list[str] = list(summary_by_name.keys())

    for brand in leaderboard["brands"]:
        key_name = norm_name(brand["brand"])
        key_domain = norm_domain(brand["domain"])

        sb = summary_by_name.get(key_name) or summary_by_domain.get(key_domain)

        if sb:
            # ── Replace estimated scores with real live values ──────────────
            brand["composite_score"] = round(sb["avs"], 1)
            brand["scores"]["openai"]["score"] = round(sb["avs_per_llm"]["openai"], 1)
            brand["scores"]["anthropic"]["score"] = round(sb["avs_per_llm"]["anthropic"], 1)
            brand["scores"]["perplexity"]["score"] = round(sb["avs_per_llm"]["perplexity"], 1)
            # Google AIO was not in this run — keep the existing estimated value
            brand["data_source"] = verified_label
            verified.append(brand["brand"])
            if key_name in unmatched_summary:
                unmatched_summary.remove(key_name)
        else:
            brand["data_source"] = "estimated"
            estimated.append(brand["brand"])

    # ── Re-sort by composite_score (desc) and re-assign ranks ────────────────
    leaderboard["brands"].sort(key=lambda b: b["composite_score"], reverse=True)
    for i, brand in enumerate(leaderboard["brands"]):
        brand["rank"] = i + 1

    # ── Update metadata ───────────────────────────────────────────────────────
    leaderboard["generated_at"] = datetime.now(timezone.utc).isoformat()
    leaderboard["scoring_method"] = "hybrid_v1"
    leaderboard["scoring_note"] = (
        f"{len(verified)} brands scored live on {run_date} via OpenAI, Anthropic, "
        f"and Perplexity APIs (Google AIO pending). "
        f"{len(estimated)} brands carry research-based estimates."
    )

    with open(LEADERBOARD_PATH, "w", encoding="utf-8") as f:
        json.dump(leaderboard, f, indent=2, ensure_ascii=False)

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"\n✅  build_leaderboard.py complete")
    print(f"    run_date   : {run_date}")
    print(f"    verified   : {len(verified)} brands  ({verified_label})")
    print(f"    estimated  : {len(estimated)} brands")
    print(f"    written to : {LEADERBOARD_PATH}")

    if unmatched_summary:
        print(f"\n⚠️  Summary brands NOT found in leaderboard (check spelling):")
        for b in unmatched_summary:
            print(f"    - {b}")

    print(f"\nTop 5 after merge:")
    for b in leaderboard["brands"][:5]:
        print(f"  #{b['rank']:3d}  {b['brand']:30s}  {b['composite_score']:5.1f}  [{b['data_source']}]")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge scorer output into leaderboard JSON.")
    parser.add_argument(
        "--run-date",
        default="2026-05-28",
        help="Date of the scoring run (YYYY-MM-DD).  Default: 2026-05-28",
    )
    args = parser.parse_args()
    build(args.run_date)
