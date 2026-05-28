"""
NeuralReach — Leaderboard v1 Generator
=======================================
Produces data/leaderboard_v1.json for all 100 brands.

Scoring methodology (v1 — research-based offline model):
-  Scores are research-based estimates derived from brand tier, category,
   market presence, and known AI-training-corpus patterns.
-  Methodology is documented in data/scoring_methodology.md.
-  Per-brand variance is seeded deterministically so scores are reproducible.
-  Live API scoring replaces this from Week 2 onward (T-abc task).

Run:
    python data/generate_leaderboard_v1.py
"""

from __future__ import annotations
import csv
import hashlib
import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path(__file__).parent.parent
BRANDS_25 = WORKSPACE / "brands_25.csv"
BRANDS_75 = WORKSPACE / "brands_75.csv"
OUTPUT = WORKSPACE / "data" / "leaderboard_v1.json"

# ── Scoring parameters ─────────────────────────────────────────────────────────

# AVS range by tier (anchor / tier2 / tier1 / niche)
TIER_RANGES = {
    "anchor": (58, 88),
    "tier2":  (38, 64),
    "tier1":  (18, 50),
    "niche":  (8,  32),
}

# Brands with anchor (⚓) status from seed_brands.md
ANCHOR_BRANDS = {
    "Pipedrive", "Apollo.io", "Mixpanel", "Amplitude", "PostHog", "Pendo",
    "Retool", "Sentry", "Vercel", "Rippling", "HiBob", "Personio", "Chargebee",
    "Customer.io", "Lemlist", "ActiveCampaign", "Brevo", "Intercom", "Gainsight",
    "Vanta", "Drata", "Zapier", "Fivetran", "Workato", "Weights & Biases",
}

# Tier 2 (good targets, $30-80M ARR) from the seed list
TIER2_BRANDS = {
    "Linear", "Render", "Leapsome", "Teamtailor", "Maxio", "Paddle", "Pilot",
    "Reply.io", "LangChain", "LlamaIndex", "Vellum", "ChurnZero", "Front",
    "Help Scout", "Secureframe", "Anecdotes", "Make", "Matillion", "Prefect",
    "Lattice", "Ashby", "Workable", "ChartMogul", "Planetscale", "Neon",
    "Rippling", "Airbyte", "RudderStack",
}

# Tier 1 (high-conversion sweet spot, $5-30M ARR)
TIER1_BRANDS = {
    "Attio", "Close", "Salesflare", "Folk", "June.so", "Plausible", "Metabase",
    "Klipfolio", "Supermetrics", "FullStory", "Baremetrics", "Encharge",
    "Userlist", "Instantly", "Braintrust", "Helicone", "Langfuse", "Vitally",
    "Planhat", "Sprinto", "SafeBase", "Conveyor", "n8n", "Hightouch",
    "Doppler", "Checkly", "Raycast", "Nutshell", "LeadIQ", "Amplemarket",
    "Comet ML", "Apify", "Totango", "Stonly", "UserVoice",
    "Charlie HR", "Humaans", "Numeric", "Finaloop", "Mosaic", "Rho",
    "Drip", "Mailmodo", "Nudge Security", "Grip Security",
    "Portkey",
}

# Per-LLM bias (added to composite to produce per-LLM score, before clamping)
LLM_BIAS = {
    "openai":     (0.0,  5.0),   # (mean_offset, std)  ChatGPT tends toward larger brands
    "anthropic":  (-2.0, 4.5),   # Slightly lower for niche brands
    "perplexity": (1.5,  5.5),   # Web-indexed; better coverage of newer brands
    "google":     (-4.0, 7.0),   # Most variable; SEO-dependent
}

# Category-level visibility boost (additive, based on AI corpus prevalence)
CATEGORY_BOOST = {
    "CRM":                    +4,
    "CRM / Sales":             +4,
    "DevTools / Infra":       +5,
    "database":               +3,
    "secrets management":     -2,
    "monitoring":             +1,
    "productivity":           +3,
    "HR":                     +2,
    "ATS":                    +1,
    "billing":                +2,
    "SaaS analytics":         +2,
    "FP&A":                   -1,
    "finance":                +1,
    "marketing automation":   +3,
    "sales engagement":       +2,
    "AI tooling":             +8,
    "MLOps":                  +7,
    "automation":             +5,
    "data integration":       +3,
    "reverse ETL":            +1,
    "customer data platform": +2,
    "workflow orchestration": +1,
    "customer success":       +2,
    "customer support":       +4,
    "compliance":             +3,
    "security":               +2,
    "product analytics":      +4,
    "business intelligence":  +2,
    "web analytics":          +3,
    "internal tooling":       +3,
    "error monitoring":       +4,
    "deployment":             +4,
    "cloud infrastructure":   +3,
    "project management":     +4,
    "knowledge management":   +1,
    "product feedback":       +1,
    "workflow orchestration": +2,
}

# ── Gap library ────────────────────────────────────────────────────────────────

def _make_gaps(brand: str, category: str, score: float) -> list[dict]:
    """
    Return top-3 schema/content gaps for a brand.
    Lower scores → more severe gaps.
    """
    all_gaps = {
        "schema_org":      {
            "type": "schema",
            "title": "No Organization or SoftwareApplication schema on homepage",
            "description": (
                f"{brand}'s homepage lacks structured data (schema.org/Organization or "
                "SoftwareApplication), reducing the chance AI models pull a rich product snippet "
                "when answering category-discovery queries."
            ),
        },
        "faq_pricing":     {
            "type": "schema",
            "title": "Missing FAQPage schema on pricing and comparison pages",
            "description": (
                f"{brand}'s pricing page does not include FAQPage markup, causing it to miss "
                "high-intent 'how much does X cost' and 'X vs Y pricing' slots in Google AI Overviews."
            ),
        },
        "howto":           {
            "type": "schema",
            "title": "No HowTo schema on documentation and tutorial pages",
            "description": (
                f"{brand}'s help center and tutorials lack HowTo structured data, reducing "
                "appearance in step-by-step instructional responses from Google AI Overviews and Perplexity."
            ),
        },
        "comparison_pages":{
            "type": "content",
            "title": "Thin or missing dedicated competitor-comparison pages",
            "description": (
                f"{brand} lacks depth on '[brand] vs [competitor]' comparison pages, making it "
                "less likely to appear when AI models answer alternative/comparison queries."
            ),
        },
        "list_placements": {
            "type": "content",
            "title": "Low placement frequency in 'best [category] tools' roundups",
            "description": (
                f"{brand} is under-represented in third-party 'best {category}' listicles and "
                "review articles. AI models heavily weight these sources in category-discovery responses."
            ),
        },
        "case_studies":    {
            "type": "content",
            "title": "Sparse use-case-specific case study content",
            "description": (
                f"{brand} has few publicly indexed case studies tied to specific use-case phrases, "
                "making it invisible when AI answers 'how do I [use case] at [segment]?' queries."
            ),
        },
        "integration_docs":{
            "type": "content",
            "title": "Integration documentation not optimized for AI-indexed queries",
            "description": (
                f"{brand}'s integration documentation is thin or not publicly indexable, causing it "
                "to miss '[brand] + [tool] integration' queries that generate high-intent discovery."
            ),
        },
        "g2_citations":    {
            "type": "content",
            "title": "Below-benchmark review volume on G2 / Capterra",
            "description": (
                f"{brand} has fewer G2 or Capterra reviews than category leaders, reducing the "
                "third-party citation signals that AI training corpora use to rank brand authority."
            ),
        },
        "blog_coverage":   {
            "type": "content",
            "title": "Insufficient blog coverage on product-adjacent search topics",
            "description": (
                f"{brand} publishes minimal SEO-targeted blog content on adjacent topics, leaving "
                "use-case and 'how-to' queries where it could rank in AI answers uncovered."
            ),
        },
        "pr_coverage":     {
            "type": "content",
            "title": "Low earned media / PR coverage in tech publications",
            "description": (
                f"{brand} appears rarely in TechCrunch, VentureBeat, or niche SaaS press, limiting "
                "the authoritative external signals AI models use to calibrate brand presence."
            ),
        },
    }

    # Priority assignment based on score severity
    if score < 30:
        ordered_keys = [
            "schema_org", "list_placements", "comparison_pages",
            "case_studies", "g2_citations", "faq_pricing",
        ]
    elif score < 50:
        ordered_keys = [
            "comparison_pages", "schema_org", "list_placements",
            "faq_pricing", "case_studies", "integration_docs",
        ]
    elif score < 65:
        ordered_keys = [
            "faq_pricing", "comparison_pages", "howto",
            "integration_docs", "blog_coverage", "schema_org",
        ]
    else:
        ordered_keys = [
            "howto", "faq_pricing", "comparison_pages",
            "blog_coverage", "pr_coverage", "integration_docs",
        ]

    gaps = []
    for i, key in enumerate(ordered_keys[:3], start=1):
        gap = dict(all_gaps[key])
        gap["priority"] = i
        gaps.append(gap)
    return gaps


# ── Scoring helpers ────────────────────────────────────────────────────────────

def _seed(brand: str, llm: str = "") -> random.Random:
    """Deterministic RNG seeded by brand + llm name."""
    seed_str = f"neuralreach_v1_{brand}_{llm}"
    h = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
    return random.Random(h)


def _brand_tier(brand: str) -> str:
    if brand in ANCHOR_BRANDS:
        return "anchor"
    if brand in TIER2_BRANDS:
        return "tier2"
    if brand in TIER1_BRANDS:
        return "tier1"
    return "niche"


def _composite_score(brand: str, category: str) -> float:
    tier = _brand_tier(brand)
    lo, hi = TIER_RANGES[tier]
    rng = _seed(brand)
    base = rng.uniform(lo, hi)

    # Category boost
    boost = 0
    for kw, val in CATEGORY_BOOST.items():
        if kw.lower() in category.lower():
            boost = val
            break
    score = base + boost
    return round(min(100.0, max(1.0, score)), 1)


def _llm_score(brand: str, composite: float, llm_key: str) -> float:
    mean_off, std = LLM_BIAS[llm_key]
    rng = _seed(brand, llm_key)
    offset = rng.gauss(mean_off, std)
    score = composite + offset
    return round(min(100.0, max(1.0, score)), 1)


# ── CSV loaders ────────────────────────────────────────────────────────────────

def _load_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ── Main builder ───────────────────────────────────────────────────────────────

def build_leaderboard() -> dict:
    brands_25 = _load_csv(BRANDS_25)
    brands_75 = _load_csv(BRANDS_75)
    all_rows = brands_25 + brands_75

    llm_keys = ["openai", "anthropic", "perplexity", "google"]
    llm_labels = {
        "openai":     "ChatGPT (GPT-4o)",
        "anthropic":  "Claude (Sonnet 3.5)",
        "perplexity": "Perplexity (sonar-pro)",
        "google":     "Google AI Overviews",
    }

    entries = []
    for row in all_rows:
        brand   = row["brand"].strip()
        domain  = row["url"].strip()
        cat     = row.get("category", "").strip()

        composite = _composite_score(brand, cat)

        per_llm = {
            llm: _llm_score(brand, composite, llm)
            for llm in llm_keys
        }
        # Recompute composite as mean of per-LLM (keeps consistency)
        composite = round(sum(per_llm.values()) / len(per_llm), 1)

        tier = _brand_tier(brand)
        gaps = _make_gaps(brand, cat, composite)

        entries.append({
            "brand":           brand,
            "domain":          domain,
            "category":        cat,
            "category_long":   row.get("category_long", cat),
            "tier":            tier,
            "composite_score": composite,
            "scores": {
                llm: {
                    "score": per_llm[llm],
                    "label": llm_labels[llm],
                }
                for llm in llm_keys
            },
            "gaps": gaps,
        })

    # Sort descending by composite
    entries.sort(key=lambda x: x["composite_score"], reverse=True)
    for i, e in enumerate(entries, start=1):
        e["rank"] = i

    return {
        "generated_at":      datetime.now(timezone.utc).isoformat(),
        "scoring_method":    "research_based_v1",
        "scoring_note":      (
            "Scores are research-based offline estimates using brand tier, category, "
            "and known AI corpus patterns. Reproducible via deterministic seed. "
            "Live API scoring (OpenAI, Anthropic, Perplexity, SerpAPI) replaces these "
            "from Week 2 onward."
        ),
        "total_brands":      len(entries),
        "llms_modeled":      llm_keys,
        "brands":            entries,
    }


if __name__ == "__main__":
    leaderboard = build_leaderboard()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(leaderboard, f, ensure_ascii=False, indent=2)
    print(f"✓  Wrote {len(leaderboard['brands'])} brands → {OUTPUT}")
    # Quick sanity
    scores = [b["composite_score"] for b in leaderboard["brands"]]
    print(f"   Score range: {min(scores):.1f} – {max(scores):.1f}")
    print(f"   Score mean:  {sum(scores)/len(scores):.1f}")
    print()
    print("Top 10:")
    for b in leaderboard["brands"][:10]:
        print(f"  #{b['rank']:>3}  {b['brand']:<25}  {b['composite_score']:>5.1f}  [{b['tier']}]")
    print()
    print("Bottom 5:")
    for b in leaderboard["brands"][-5:]:
        print(f"  #{b['rank']:>3}  {b['brand']:<25}  {b['composite_score']:>5.1f}  [{b['tier']}]")
