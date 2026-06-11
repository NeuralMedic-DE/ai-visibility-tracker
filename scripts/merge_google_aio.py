"""Merge Google AIO scores from the 2026-06-11 SerpAPI run into the
production leaderboard.json. Idempotent — run as many times as you want."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Prefer v2 (async-fetched, real AI Overview text) over v1 (no async, all zeros)
V2_FILE = ROOT / "scripts" / "google_aio_v2_progress.json"
V1_FILE = ROOT / "scripts" / "google_aio_results_2026-06-11.json"
LEADERBOARD_FILE = ROOT / "data" / "leaderboard.json"


def main() -> int:
    results_file = V2_FILE if V2_FILE.exists() else V1_FILE
    if not results_file.exists():
        print(f"ERROR: neither v1 nor v2 results file found — run the scoring script first")
        return 1
    print(f"using results file: {results_file.relative_to(ROOT)}")
    results = json.loads(results_file.read_text())
    # Skip brands with score=None (couldn't fetch). Only merge real 0/100 signals.
    by_brand: dict[str, int] = {}
    for name, rec in results["brands"].items():
        score = rec.get("score") if "score" in rec else rec.get("google_aio_score")
        if score is None:
            continue
        by_brand[name] = int(score)
    print(f"loaded {len(by_brand)} brand scores from results file")

    leaderboard = json.loads(LEADERBOARD_FILE.read_text())
    # Schema: either a list, or {"brands": [...]}
    rows = leaderboard["brands"] if isinstance(leaderboard, dict) and "brands" in leaderboard else leaderboard

    matched = 0
    unmatched = []
    for row in rows:
        brand = row.get("brand")
        if brand in by_brand:
            row.setdefault("avs_per_llm", {})["google_aio"] = by_brand[brand]
            matched += 1
        else:
            unmatched.append(brand)

    LEADERBOARD_FILE.write_text(json.dumps(leaderboard, indent=2))
    print(f"merged into {LEADERBOARD_FILE.relative_to(ROOT)} — matched {matched} brands")
    if unmatched:
        print(f"WARN: {len(unmatched)} brands in leaderboard.json had no SerpAPI score:")
        for b in unmatched[:10]:
            print(f"  - {b}")
        if len(unmatched) > 10:
            print(f"  ... and {len(unmatched)-10} more")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
