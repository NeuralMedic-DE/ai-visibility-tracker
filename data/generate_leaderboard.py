#!/usr/bin/env python3
"""
Generate data/leaderboard.json and data/brands/<slug>.json from the latest
non-dry-run scorer output (scorer_output/2026-05-30/).

Run from the ai-visibility-tracker directory:
    python3 data/generate_leaderboard.py
"""

import json
import re
import csv
from pathlib import Path
from datetime import datetime, timezone

# ── Paths ─────────────────────────────────────────────────────────────────────
WORKSPACE = Path(__file__).parent.parent
SCORER_OUTPUT = WORKSPACE / "scorer_output" / "2026-05-30"
DATA_DIR = WORKSPACE / "data"
BRANDS_DIR = DATA_DIR / "brands"
V1_FILE = DATA_DIR / "leaderboard_v1.json"
CSV_FILE = WORKSPACE / "brands_100.csv"

# ── Helpers ──────────────────────────────────────────────────────────────────


def slugify(name: str) -> str:
    """Same logic as Next.js slugify in leaderboard page."""
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


# ── Prompt-gap reasoning ─────────────────────────────────────────────────────
CATEGORY_WHY = {
    "category_discovery": (
        "Discovery queries drive early-funnel awareness. Buyers use these "
        "to find solutions to problems they haven't yet named. Missing here "
        "means you're invisible before the consideration stage."
    ),
    "comparison": (
        "Comparison queries signal high purchase intent. A buyer typing "
        "'X vs Y' is typically days from a decision. Not appearing here "
        "means handing that deal to a named competitor."
    ),
    "alternatives": (
        "Alternative searches are used by buyers actively switching tools. "
        "Visibility here captures switching-intent demand at its peak."
    ),
    "use_case": (
        "Use-case prompts reach buyers at the exact moment they need your "
        "solution. These are the highest-converting prompt type in AI search."
    ),
    "integration": (
        "Integration queries signal technical buyers in the evaluation "
        "stage. Missing here loses decision-stage opportunities to tools "
        "that have stronger integration documentation."
    ),
}

# Map prompt category to BrandGap type
CATEGORY_GAP_TYPE = {
    "category_discovery": "content",
    "comparison": "positioning",
    "alternatives": "positioning",
    "use_case": "content",
    "integration": "schema",
}


# ── Load metadata ────────────────────────────────────────────────────────────
# Load v1 leaderboard for gaps and tier info
v1_by_brand: dict = {}
if V1_FILE.exists():
    with open(V1_FILE) as f:
        v1_data = json.load(f)
    for b in v1_data["brands"]:
        v1_by_brand[b["brand"]] = b
        v1_by_brand[slugify(b["brand"])] = b  # also index by slug

# Load CSV for category metadata
csv_by_brand: dict = {}
if CSV_FILE.exists():
    with open(CSV_FILE, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_by_brand[row["brand"]] = row
            csv_by_brand[slugify(row["brand"])] = row


def get_metadata(brand_name: str) -> dict:
    """Look up category/tier/gaps metadata for a brand."""
    slug = slugify(brand_name)
    # Try v1 exact, then slug, then CSV exact, then CSV slug
    v1 = v1_by_brand.get(brand_name) or v1_by_brand.get(slug)
    csv_row = csv_by_brand.get(brand_name) or csv_by_brand.get(slug)

    category = (
        csv_row.get("category", "").strip()
        if csv_row
        else (v1.get("category", "B2B SaaS") if v1 else "B2B SaaS")
    )
    category_long = (
        csv_row.get("category_long", "").strip()
        if csv_row
        else (v1.get("category_long", "") if v1 else "")
    )
    tier = v1.get("tier", "tier1") if v1 else "tier1"
    gaps = v1.get("gaps", []) if v1 else []

    return {
        "category": category or "B2B SaaS",
        "category_long": category_long,
        "tier": tier,
        "gaps": gaps,
    }


# ── Read all brand JSONs ─────────────────────────────────────────────────────
print(f"Reading scorer output from {SCORER_OUTPUT} …")
brands_raw = []
for fp in SCORER_OUTPUT.glob("*.json"):
    if fp.name == "summary.json":
        continue
    with open(fp) as f:
        data = json.load(f)
    brands_raw.append(data)

print(f"  Found {len(brands_raw)} brand files")

# Sort by avs_brand descending, assign rank
brands_raw.sort(key=lambda b: b["avs_brand"], reverse=True)

# ── Build leaderboard ────────────────────────────────────────────────────────
BRANDS_DIR.mkdir(parents=True, exist_ok=True)

leaderboard_brands = []
skipped = []

for rank, bd in enumerate(brands_raw, 1):
    brand_name = bd["brand"]
    slug = slugify(brand_name)
    meta = get_metadata(brand_name)

    llms: dict = bd.get("llms", {})
    llm_keys = list(llms.keys())

    # ── Compute gap prompts ─────────────────────────────────────────────────
    # For each prompt_id, count how many LLMs had presence=False
    gap_map: dict[str, dict] = {}
    for llm_key, llm_data in llms.items():
        for pr in llm_data.get("prompt_results", []):
            pid = pr["prompt_id"]
            if pid not in gap_map:
                gap_map[pid] = {
                    "prompt_id": pid,
                    "prompt_text": pr["prompt_text"],
                    "prompt_category": pr["prompt_category"],
                    "llms_missing": [],
                    "total_score": 0.0,
                    "llm_count": 0,
                }
            gap_map[pid]["llm_count"] += 1
            gap_map[pid]["total_score"] += pr.get("score", 0.0)
            if not pr.get("presence", False):
                gap_map[pid]["llms_missing"].append(llm_key)

    # Sort: most LLMs missing first; then lowest total score
    sorted_gaps = sorted(
        gap_map.values(),
        key=lambda x: (-len(x["llms_missing"]), x["total_score"]),
    )

    # Top gap (worst single prompt)
    worst_gap = sorted_gaps[0] if sorted_gaps else None
    top_gap_id = (
        worst_gap["prompt_id"]
        if worst_gap and len(worst_gap["llms_missing"]) > 0
        else None
    )
    top_gap_prompt = (
        worst_gap["prompt_text"]
        if worst_gap and len(worst_gap["llms_missing"]) > 0
        else None
    )

    # Top 3 gap prompts (only those where at least 1 LLM is missing)
    top_3_gaps = [g for g in sorted_gaps if len(g["llms_missing"]) > 0][:3]
    gap_prompts = []
    for g in top_3_gaps:
        cat = g["prompt_category"]
        gap_prompts.append(
            {
                "prompt_id": g["prompt_id"],
                "prompt_text": g["prompt_text"],
                "prompt_category": cat,
                "llms_missing": g["llms_missing"],
                "llms_missing_count": len(g["llms_missing"]),
                "why_it_matters": CATEGORY_WHY.get(
                    cat, "Visibility in this prompt type strengthens brand awareness."
                ),
            }
        )

    # Also derive BrandGap-compatible gaps from top gap prompts (for side panel)
    derived_gaps = []
    for i, g in enumerate(top_3_gaps[:3], 1):
        cat = g["prompt_category"]
        llms_missing_labels = {
            "openai": "ChatGPT",
            "anthropic": "Claude",
            "perplexity": "Perplexity",
        }
        missing_str = " and ".join(
            llms_missing_labels.get(k, k) for k in g["llms_missing"][:3]
        )
        derived_gaps.append(
            {
                "type": CATEGORY_GAP_TYPE.get(cat, "content"),
                "title": f"Not appearing in: \"{g['prompt_text'][:70]}{'…' if len(g['prompt_text']) > 70 else ''}\"",
                "description": (
                    f"{brand_name} was invisible to {missing_str} on this query. "
                    + CATEGORY_WHY.get(cat, "")
                ),
                "priority": i,
            }
        )

    # Use v1 gaps if available, else derived gaps
    panel_gaps = meta["gaps"] if meta["gaps"] else derived_gaps

    # ── Build per-LLM details ────────────────────────────────────────────────
    prompts_scored = max(
        (llm["prompts_scored"] for llm in llms.values()), default=0
    )
    avs_per_llm = {k: v["avs"] for k, v in llms.items()}
    llm_details = {
        k: {
            "label": v.get("label", k),
            "avs": v["avs"],
            "prompts_scored": v["prompts_scored"],
        }
        for k, v in llms.items()
    }

    # ── Leaderboard entry ────────────────────────────────────────────────────
    entry = {
        "slug": slug,
        "brand": brand_name,
        "url": bd["url"],
        "rank": rank,
        "avs_brand": bd["avs_brand"],
        "avs_per_llm": avs_per_llm,
        "prompts_scored": prompts_scored,
        "run_date": bd["run_date"],
        "top_gap": top_gap_id,
        "top_gap_prompt": top_gap_prompt,
        "verified": True,
        "category": meta["category"],
        "category_long": meta["category_long"],
        "tier": meta["tier"],
        "gaps": panel_gaps,
    }
    leaderboard_brands.append(entry)

    # ── Per-brand detail file ────────────────────────────────────────────────
    detail = {
        **entry,
        "gap_prompts": gap_prompts,
        "llm_details": llm_details,
        "total_brands": len(brands_raw),
    }
    out_path = BRANDS_DIR / f"{slug}.json"
    with open(out_path, "w") as f:
        json.dump(detail, f, indent=2)

# ── Write leaderboard.json ───────────────────────────────────────────────────
leaderboard = {
    "run_date": "2026-05-30",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "total_brands": len(leaderboard_brands),
    "active_llms": ["openai", "anthropic", "perplexity"],
    "brands": leaderboard_brands,
}

out_file = DATA_DIR / "leaderboard.json"
with open(out_file, "w") as f:
    json.dump(leaderboard, f, indent=2)

print(f"✓ Wrote {out_file} with {len(leaderboard_brands)} brands")
print(f"✓ Wrote {len(leaderboard_brands)} per-brand files in {BRANDS_DIR}/")
if skipped:
    print(f"  Skipped: {skipped}")
