#!/usr/bin/env python3
"""
Generate AI Visibility Gap Reports for 75 newly-scored brands.
Reads individual brand JSON files from scorer_output/2026-05-30/
and produces markdown gap reports in state/artifacts/research/gap_reports/
"""

import json
import os
from pathlib import Path

SCORER_DIR = Path("/Users/jonasheinzmann/Local_Documents/GitHub/claude_ceo/ai-visibility-tracker/scorer_output/2026-05-30")
OUTPUT_DIR = Path("/Users/jonasheinzmann/Local_Documents/GitHub/claude_ceo/ai-visibility-tracker/state/artifacts/research/gap_reports")
SUMMARY_PATH = SCORER_DIR / "summary.json"

# Brands already covered in gap_analysis/ (the existing 25)
EXISTING_BRANDS = {
    "Amplemarket", "Amplitude", "Apollo.io", "Attio", "Close",
    "Copper", "Folk", "FullStory", "June.so", "Klipfolio",
    "LeadIQ", "Linear", "Metabase", "Mixpanel", "Nutshell",
    "Pendo", "Pipedrive", "Plausible", "PostHog", "Render",
    "Retool", "Salesflare", "Sentry", "Supermetrics", "Vercel"
}

LLM_LABELS = {
    "openai": "ChatGPT (GPT-4o)",
    "anthropic": "Claude (Haiku 4.5)",
    "perplexity": "Perplexity (sonar-pro)",
}

def slugify(brand_name: str) -> str:
    """Convert brand name to filename slug."""
    return (brand_name.lower()
            .replace(" ", "-")
            .replace(".", "-")
            .replace("&", "and")
            .replace("/", "-")
            .replace("(", "")
            .replace(")", "")
            .replace(",", "")
            .rstrip("-"))

def get_weakest_prompts(brand_data: dict, top_n: int = 3) -> list[dict]:
    """Find the top_n weakest prompts by summing scores across all LLMs."""
    prompt_totals = {}  # prompt_id -> {total_score, prompt_text, prompt_category, per_llm}

    for llm_key, llm_data in brand_data["llms"].items():
        for result in llm_data["prompt_results"]:
            pid = result["prompt_id"]
            if pid not in prompt_totals:
                prompt_totals[pid] = {
                    "prompt_id": pid,
                    "prompt_text": result["prompt_text"],
                    "prompt_category": result["prompt_category"],
                    "total_score": 0.0,
                    "per_llm": {}
                }
            score = result.get("score", 0.0) or 0.0
            prompt_totals[pid]["total_score"] += score
            prompt_totals[pid]["per_llm"][llm_key] = {
                "score": score,
                "presence": result.get("presence", False),
                "sentiment": result.get("sentiment", "neutral"),
            }

    # Sort by total score ascending (weakest first)
    sorted_prompts = sorted(prompt_totals.values(), key=lambda x: x["total_score"])
    return sorted_prompts[:top_n]

def describe_weak_prompt(prompt: dict, brand_name: str) -> str:
    """Generate a description of why this prompt is weak."""
    pid = prompt["prompt_id"]
    text = prompt["prompt_text"]
    per_llm = prompt["per_llm"]
    cat = prompt["prompt_category"]
    total = prompt["total_score"]

    # Identify which LLMs score 0
    zero_llms = [LLM_LABELS.get(k, k) for k, v in per_llm.items() if v["score"] == 0.0]
    low_llms = [LLM_LABELS.get(k, k) for k, v in per_llm.items() if 0 < v["score"] <= 3.0]

    if zero_llms and len(zero_llms) == 3:
        llm_note = "score 0 across ALL three LLMs — completely invisible"
    elif zero_llms:
        joined = " and ".join(zero_llms)
        llm_note = f"score 0 on {joined}"
    elif low_llms:
        joined = " and ".join(low_llms)
        llm_note = f"very low scores on {joined}"
    else:
        llm_note = f"total score only {total:.1f}/30 across LLMs"

    cat_desc = {
        "category_discovery": "category-level discovery query",
        "comparison": "head-to-head comparison query",
        "alternatives": "alternatives/switching query",
        "use_case": "use-case-specific query",
        "integration": "integration-specific query",
    }.get(cat, cat)

    return f"**[{pid}]** \"{text}\" — {cat_desc}; {llm_note}."

def generate_fix_recommendations(weakest: list[dict], brand_name: str, brand_data: dict) -> list[str]:
    """Generate 2-3 concrete fix recommendations based on weakest prompts."""
    fixes = []
    used_cats = set()

    for prompt in weakest:
        pid = prompt["prompt_id"]
        cat = prompt["prompt_category"]
        text = prompt["prompt_text"]
        per_llm = prompt["per_llm"]

        zero_llms = [LLM_LABELS.get(k, k) for k, v in per_llm.items() if v["score"] == 0.0]
        llm_count = len(zero_llms)

        if cat == "category_discovery" and cat not in used_cats:
            fix = (f"**Optimize category-level content for \"{text[:60]}...\":** "
                   f"{pid} scores near-zero — publish a dedicated landing page or blog post targeting "
                   f"this category query with explicit positioning, FAQ schema, and the brand's ICP "
                   f"clearly stated so LLMs cite {brand_name} as the canonical answer.")
            fixes.append(fix)
            used_cats.add(cat)

        elif cat == "comparison" and cat not in used_cats:
            # Extract competitor from prompt text
            competitor = "the competitor"
            if " vs " in text:
                parts = text.split(" vs ")
                if len(parts) >= 2:
                    competitor = parts[1].split(":")[0].split(" for ")[0].strip()
            fix = (f"**Build a dedicated \"{brand_name} vs {competitor}\" comparison page:** "
                   f"{pid} is invisible on key LLMs — create a structured comparison page with "
                   f"a feature table, pricing breakdown, and honest use-case differentiation; "
                   f"include FAQ schema so AI systems can surface {brand_name} favorably in "
                   f"direct-comparison queries.")
            fixes.append(fix)
            used_cats.add(cat)

        elif cat == "alternatives" and cat not in used_cats:
            fix = (f"**Create 'Alternatives to X' content claiming {brand_name}:** "
                   f"{pid} scores 0 — publish a landing page explicitly positioning {brand_name} "
                   f"as the top alternative for the competitor named in this query, with clear "
                   f"migration benefits, a comparison table, and structured data so LLMs recommend "
                   f"the switch to {brand_name}.")
            fixes.append(fix)
            used_cats.add(cat)

        elif cat == "use_case" and cat not in used_cats:
            fix = (f"**Publish a use-case landing page matching \"{text[:60]}\":** "
                   f"{pid} is missing from LLM answers — create a page that directly addresses "
                   f"this workflow/use-case with step-by-step guidance, customer quotes, and "
                   f"HowTo/FAQ schema markup so {brand_name} appears as the authoritative solution.")
            fixes.append(fix)
            used_cats.add(cat)

        elif cat == "integration" and cat not in used_cats:
            # Extract integration partner from text
            partner = "the integration partner"
            for phrase in ["integrate with ", "integration: ", "connect ", "works with ", "native "]:
                if phrase in text.lower():
                    idx = text.lower().find(phrase) + len(phrase)
                    partner = text[idx:].split("?")[0].split(" and ")[0].strip()
                    break
            fix = (f"**Add dedicated integration docs for {brand_name} + {partner}:** "
                   f"{pid} scores 0 on key LLMs — publish a dedicated integration page with "
                   f"step-by-step setup guide, use-case examples, and a public changelog; "
                   f"submit the page to integration directories so AI systems surface "
                   f"{brand_name} for integration-specific searches.")
            fixes.append(fix)
            used_cats.add(cat)

    # Ensure at least 2 fixes
    if len(fixes) < 2:
        fixes.append(
            f"**Add structured schema markup (FAQ + HowTo) to {brand_name}'s key product pages:** "
            f"Several low-scoring prompts show brand presence but low scores — adding "
            f"structured data and clearer ICP language on the homepage, pricing page, and "
            f"use-case pages will lift LLM citation rates across all prompt categories."
        )

    return fixes[:3]  # Return max 3

def generate_gap_report(brand_data: dict, rank: int, total_brands: int) -> str:
    """Generate the markdown gap report for a brand."""
    brand_name = brand_data["brand"]
    avs = brand_data["avs_brand"]

    # Per-LLM AVS
    llm_avs = {}
    for llm_key, llm_data in brand_data["llms"].items():
        llm_avs[llm_key] = llm_data["avs"]

    # Weakest prompts
    weakest = get_weakest_prompts(brand_data, top_n=3)

    # Build LLM table rows
    llm_rows = ""
    for llm_key in ["openai", "anthropic", "perplexity"]:
        label = LLM_LABELS.get(llm_key, llm_key)
        score = llm_avs.get(llm_key, 0.0)
        llm_rows += f"| {label} | {score} |\n"

    # Build weakest prompts section
    weak_lines = ""
    for i, prompt in enumerate(weakest, 1):
        weak_lines += f"{i}. {describe_weak_prompt(prompt, brand_name)}\n"

    # Build recommendations
    fixes = generate_fix_recommendations(weakest, brand_name, brand_data)
    fix_lines = ""
    for i, fix in enumerate(fixes, 1):
        fix_lines += f"{i}. {fix}\n"

    report = f"""# {brand_name} — AI Visibility Gap Analysis

**AVS Score:** {avs} / 100
**Rank:** #{rank} of {total_brands}
**Run date:** 2026-05-30

## LLM Breakdown

| LLM | AVS |
|-----|-----|
{llm_rows}
## Weakest Prompts (score 0–3 across LLMs)

{weak_lines}
## Recommended Fixes

{fix_lines}"""

    return report.strip()


def main():
    # Load summary
    with open(SUMMARY_PATH) as f:
        summary = json.load(f)

    # Build rank map (1-indexed, sorted by AVS descending)
    rank_map = {}
    for i, entry in enumerate(summary["brands"], 1):
        rank_map[entry["brand"]] = i

    total_brands = summary["total_brands"]

    # Find all brand JSON files (excluding summary.json and run.log)
    brand_files = [
        p for p in SCORER_DIR.iterdir()
        if p.suffix == ".json" and p.name != "summary.json"
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    generated = []
    skipped = []

    for brand_file in sorted(brand_files):
        with open(brand_file) as f:
            brand_data = json.load(f)

        brand_name = brand_data["brand"]

        # Skip existing brands (already have reports in gap_analysis/)
        if brand_name in EXISTING_BRANDS:
            skipped.append(brand_name)
            continue

        rank = rank_map.get(brand_name, 999)
        report_content = generate_gap_report(brand_data, rank, total_brands)

        # Write to file
        slug = slugify(brand_name)
        out_path = OUTPUT_DIR / f"{slug}.md"
        with open(out_path, "w") as f:
            f.write(report_content + "\n")

        generated.append(brand_name)
        print(f"  ✓ {brand_name} → {out_path.name}")

    print(f"\n{'='*60}")
    print(f"Generated: {len(generated)} gap reports")
    print(f"Skipped (already exist): {len(skipped)}")
    print(f"Output directory: {OUTPUT_DIR}")

    # Verify count
    existing_in_output = list(OUTPUT_DIR.glob("*.md"))
    print(f"Files now in gap_reports/: {len(existing_in_output)}")

    # Also count gap_analysis files
    gap_analysis_dir = Path("/Users/jonasheinzmann/Local_Documents/GitHub/claude_ceo/ai-visibility-tracker/state/artifacts/research/gap_analysis")
    if gap_analysis_dir.exists():
        existing_old = list(gap_analysis_dir.glob("*.md"))
        print(f"Files in gap_analysis/: {len(existing_old)}")
        print(f"Total gap reports on disk: {len(existing_in_output) + len(existing_old)}")


if __name__ == "__main__":
    main()
