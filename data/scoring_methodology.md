# NeuralReach AI Visibility Score — Scoring Methodology v1

**Version:** research_based_v1  
**Produced:** 2026-05-27  
**Brands:** 100  

---

## Overview

The v1 leaderboard uses a **research-based offline scoring model**. Scores are derived from brand 
tier, product category, and known AI-corpus-prevalence patterns — not live API calls.  

This matches the Week 1 milestone: *"shippable static leaderboard with email-capture waitlist, even 
if scoring is computed offline."* Live API scoring (via OpenAI, Anthropic, Perplexity, SerpAPI) will 
replace these scores from Week 2 onward.

---

## Composite Score (AI Visibility Score — AVS)

The composite AVS is an average of four per-LLM scores:

```
AVS = mean(score_openai, score_anthropic, score_perplexity, score_google)
```

Each per-LLM score = `base_score + category_boost + llm_bias_offset`

All scores are clamped to [1, 100].

---

## Brand Tier Assignments

Brands are assigned to one of four tiers based on ARR, funding stage, and market awareness:

| Tier   | Description | AVS Base Range | Count |
|--------|-------------|---------------|-------|
| anchor | $100M+ ARR or dominant market position; household name in category | 58–88 | 25 |
| tier2  | $30M–$80M ARR; established with growing category awareness | 38–64 | 27 |
| tier1  | $5M–$30M ARR; target customer segment; budget-sensitive | 18–50 | 46 |
| niche  | <$5M ARR or highly specialized with low broad awareness | 8–32 | 2 |

Base scores within each tier are drawn from a uniform distribution using a deterministic seed 
(`md5("neuralreach_v1_{brand}")`) — scores are reproducible.

---

## Category Visibility Boost

Certain product categories have higher AI-corpus coverage. An additive boost is applied:

| Category | Boost |
|----------|-------|
| AI tooling / MLOps | +7 to +8 |
| DevTools / Infra | +4 to +5 |
| automation / workflow | +4 to +5 |
| product analytics / web analytics | +3 to +4 |
| error monitoring / deployment | +4 |
| marketing automation / sales engagement | +2 to +3 |
| compliance / security | +2 to +3 |
| CRM / Sales Intelligence | +4 |
| customer support | +4 |
| data integration | +3 |
| billing / SaaS analytics | +2 |
| HR / ATS | +1 to +2 |
| secrets management / reverse ETL | −2 to +1 |

---

## Per-LLM Bias Model

Each LLM has a characteristic bias applied on top of the composite score:

| LLM | Mean Offset | Std Dev | Rationale |
|-----|-------------|---------|-----------|
| OpenAI (ChatGPT) | 0.0 | 5.0 | Baseline; well-calibrated across brand sizes |
| Anthropic (Claude) | −2.0 | 4.5 | Slightly lower for niche brands; conservative citations |
| Perplexity (sonar-pro) | +1.5 | 5.5 | Web-indexed; slightly better coverage for recent brands |
| Google AI Overviews | −4.0 | 7.0 | Most variable; heavily depends on SEO and schema markup |

---

## Gap Analysis

Each brand receives 3 prioritized gaps. Gaps are drawn from a library of 10 gap types and 
assigned based on the brand's composite score:

| Score Range | Priority Gaps |
|-------------|---------------|
| < 30 (low visibility) | schema_org, list_placements, comparison_pages, case_studies, g2_citations, faq_pricing |
| 30–50 (medium-low) | comparison_pages, schema_org, list_placements, faq_pricing, case_studies, integration_docs |
| 50–65 (medium) | faq_pricing, comparison_pages, howto, integration_docs, blog_coverage, schema_org |
| > 65 (high visibility) | howto, faq_pricing, comparison_pages, blog_coverage, pr_coverage, integration_docs |

**Gap types defined:**

1. `schema_org` — Missing Organization/SoftwareApplication schema
2. `faq_pricing` — No FAQPage schema on pricing/comparison pages  
3. `howto` — No HowTo schema on docs/tutorials
4. `comparison_pages` — Thin competitor-comparison landing pages
5. `list_placements` — Low frequency in "best [category] tools" roundups
6. `case_studies` — Sparse use-case-specific case study content
7. `integration_docs` — Integration docs not optimized for AI-indexed queries
8. `g2_citations` — Below-benchmark review volume on G2/Capterra
9. `blog_coverage` — Insufficient SEO-targeted adjacent content
10. `pr_coverage` — Low earned media in tech publications

---

## Planned v2 Upgrades (Week 2)

1. **Live API scoring** — 25 prompts × 4 LLMs × 100 brands = 10,000 real API calls
2. **Real presence detection** — binary presence, rank position, sentiment per prompt
3. **Schema validation** — automated headless browser check for structured data
4. **Citation counting** — G2 review count vs. category leader benchmark
5. **Comparison page audit** — crawl check for dedicated `/vs/` pages

---

## Reproducibility

All scores in leaderboard_v1.json are fully reproducible by re-running:

```bash
cd ai-visibility-tracker
python data/generate_leaderboard_v1.py
```

The generation script uses `hashlib.md5` to seed Python's `random.Random`, guaranteeing identical 
output regardless of Python version or platform.
