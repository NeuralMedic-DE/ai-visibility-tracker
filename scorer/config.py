"""Constants, prompt templates, and scoring rubric for the visibility scorer."""

import os
from pathlib import Path

# ── Per-plan prompt quotas ─────────────────────────────────────────────────
# Starter: 25 prompts/run  ($39/mo — "25 AI prompts per week")
# Pro:    100 prompts/run  ($89/mo — "100 AI prompts per week")
# The scorer slices PROMPT_TEMPLATES[:limit] before running.
PLAN_PROMPT_LIMITS: dict[str, int] = {
    "starter": 25,
    "pro": 100,
}

# ── Paths ──────────────────────────────────────────────────────────────────
WORKSPACE_DIR = Path(__file__).parent.parent
CACHE_DIR = WORKSPACE_DIR / "scorer" / ".cache"
OUTPUT_DIR = WORKSPACE_DIR / "scorer_output"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Model names ────────────────────────────────────────────────────────────
LLM_CONFIGS = {
    "openai": {
        "model": "gpt-4o",
        "label": "ChatGPT (GPT-4o)",
        "rate_limit_delay": 1.0,  # seconds between calls
    },
    "anthropic": {
        "model": "claude-haiku-4-5-20251001",
        "label": "Claude (Haiku 4.5)",
        "rate_limit_delay": 0.5,  # Haiku is fast; 0.5s delay is sufficient
    },
    "perplexity": {
        "model": "sonar-pro",
        "label": "Perplexity (sonar-pro)",
        "rate_limit_delay": 1.5,
    },
    "google": {
        "model": "serpapi",
        "label": "Google AI Overviews (SerpAPI)",
        "rate_limit_delay": 2.0,
    },
}

SENTIMENT_MODEL = "gpt-4o-mini"  # cheap model for sentiment classification

# ── Scoring rubric ──────────────────────────────────────────────────────────
RANK_POINTS = {
    1: 6,
    2: 5,
    3: 4,
    4: 3,
    5: 2,
    "unranked": 2,
    "na": 3,
}
# Rank 6+ → 1 point (handled in scorer.py)

SENTIMENT_ADJ = {
    "positive": 2,
    "neutral": 0,
    "negative": -2,
}

LINK_ADJ = {
    True: 1,
    False: 0,
}

# Prompt types where N/A rank applies if brand is mentioned but no list
NA_RANK_PROMPT_PREFIXES = ("IN-", "UC-")

# ── 25 canonical prompt templates ─────────────────────────────────────────
# Variables: {BRAND}, {CATEGORY}, {CATEGORY_LONG}, {SEGMENT}, {COMPETITOR_1},
#            {COMPETITOR_2}, {USE_CASE_1}, {USE_CASE_2}, {INTEGRATION_1},
#            {INTEGRATION_2}, {ROLE}

PROMPT_TEMPLATES = [
    # (a) Category Discovery
    {
        "id": "CD-01",
        "template": "What is the best {CATEGORY} for {SEGMENT}?",
        "category": "category_discovery",
    },
    {
        "id": "CD-02",
        "template": "Top {CATEGORY_LONG} tools in 2025",
        "category": "category_discovery",
    },
    {
        "id": "CD-03",
        "template": "Which {CATEGORY} software should a {ROLE} use?",
        "category": "category_discovery",
    },
    {
        "id": "CD-04",
        "template": "Best {CATEGORY} platforms for {USE_CASE_1}",
        "category": "category_discovery",
    },
    {
        "id": "CD-05",
        "template": "Recommended {CATEGORY} tools for {SEGMENT} companies",
        "category": "category_discovery",
    },
    # (b) Comparison
    {
        "id": "CM-01",
        "template": "{BRAND} vs {COMPETITOR_1}: which is better?",
        "category": "comparison",
    },
    {
        "id": "CM-02",
        "template": "{BRAND} vs {COMPETITOR_2} pricing and features",
        "category": "comparison",
    },
    {
        "id": "CM-03",
        "template": "{BRAND} vs {COMPETITOR_1} for {SEGMENT}",
        "category": "comparison",
    },
    {
        "id": "CM-04",
        "template": "Compare {BRAND} and {COMPETITOR_1} for {USE_CASE_1}",
        "category": "comparison",
    },
    {
        "id": "CM-05",
        "template": "Is {BRAND} better than {COMPETITOR_2} for {USE_CASE_2}?",
        "category": "comparison",
    },
    # (c) Alternatives
    {
        "id": "AL-01",
        "template": "Alternatives to {COMPETITOR_1} for {SEGMENT}",
        "category": "alternatives",
    },
    {
        "id": "AL-02",
        "template": "Cheaper alternatives to {COMPETITOR_2}",
        "category": "alternatives",
    },
    {
        "id": "AL-03",
        "template": "Best {CATEGORY} alternatives for {SEGMENT} teams on a budget",
        "category": "alternatives",
    },
    {
        "id": "AL-04",
        "template": "{COMPETITOR_1} vs alternatives: what should I switch to?",
        "category": "alternatives",
    },
    {
        "id": "AL-05",
        "template": "Open source or affordable {CATEGORY} tools instead of {COMPETITOR_2}",
        "category": "alternatives",
    },
    # (d) Use-Case
    {
        "id": "UC-01",
        "template": "How do I {USE_CASE_1} without spending a lot on software?",
        "category": "use_case",
    },
    {
        "id": "UC-02",
        "template": "Best way to {USE_CASE_2} for a {SEGMENT} team",
        "category": "use_case",
    },
    {
        "id": "UC-03",
        "template": "What tools do {SEGMENT} companies use to {USE_CASE_1}?",
        "category": "use_case",
    },
    {
        "id": "UC-04",
        "template": "How can a {ROLE} {USE_CASE_1} more efficiently?",
        "category": "use_case",
    },
    {
        "id": "UC-05",
        "template": "What software helps with {USE_CASE_2} at scale?",
        "category": "use_case",
    },
    # (e) Integration
    {
        "id": "IN-01",
        "template": "Does {BRAND} integrate with {INTEGRATION_1}?",
        "category": "integration",
    },
    {
        "id": "IN-02",
        "template": "{BRAND} {INTEGRATION_2} integration: how does it work?",
        "category": "integration",
    },
    {
        "id": "IN-03",
        "template": "How do I connect {BRAND} with {INTEGRATION_1}?",
        "category": "integration",
    },
    {
        "id": "IN-04",
        "template": "Best {CATEGORY} that works with {INTEGRATION_1} and {INTEGRATION_2}",
        "category": "integration",
    },
    {
        "id": "IN-05",
        "template": "{CATEGORY} tools with native {INTEGRATION_1} integration",
        "category": "integration",
    },
    # ── Pro-tier extended templates (prompts 26-100) ───────────────────────
    # (a) Category Discovery — extended
    {
        "id": "CD-06",
        "template": "What {CATEGORY} tool do {SEGMENT} teams love most?",
        "category": "category_discovery",
    },
    {
        "id": "CD-07",
        "template": "Best {CATEGORY} software for {ROLE}s at {SEGMENT} companies",
        "category": "category_discovery",
    },
    {
        "id": "CD-08",
        "template": "Top-rated {CATEGORY_LONG} tools recommended by {ROLE}s",
        "category": "category_discovery",
    },
    {
        "id": "CD-09",
        "template": "What are the most popular {CATEGORY} solutions right now?",
        "category": "category_discovery",
    },
    {
        "id": "CD-10",
        "template": "Which {CATEGORY} platform is easiest to set up for {SEGMENT}?",
        "category": "category_discovery",
    },
    {
        "id": "CD-11",
        "template": "Best enterprise-grade {CATEGORY} for large {SEGMENT} teams",
        "category": "category_discovery",
    },
    {
        "id": "CD-12",
        "template": "What {CATEGORY} software should a growing {SEGMENT} startup use?",
        "category": "category_discovery",
    },
    {
        "id": "CD-13",
        "template": "{CATEGORY} tools with the best user reviews and ratings",
        "category": "category_discovery",
    },
    {
        "id": "CD-14",
        "template": "Which {CATEGORY} has the shortest learning curve for {SEGMENT} teams?",
        "category": "category_discovery",
    },
    {
        "id": "CD-15",
        "template": "How do I find the right {CATEGORY_LONG} for my {SEGMENT} team?",
        "category": "category_discovery",
    },
    # (b) Comparison — extended
    {
        "id": "CM-06",
        "template": "{BRAND} or {COMPETITOR_1}: which is easier to get started with?",
        "category": "comparison",
    },
    {
        "id": "CM-07",
        "template": "What is the main difference between {BRAND} and {COMPETITOR_1}?",
        "category": "comparison",
    },
    {
        "id": "CM-08",
        "template": "{BRAND} pros and cons vs {COMPETITOR_2}",
        "category": "comparison",
    },
    {
        "id": "CM-09",
        "template": "How does {BRAND} stack up against {COMPETITOR_1} for a {ROLE}?",
        "category": "comparison",
    },
    {
        "id": "CM-10",
        "template": "Which is more affordable: {BRAND} or {COMPETITOR_1}?",
        "category": "comparison",
    },
    {
        "id": "CM-11",
        "template": "{BRAND} vs {COMPETITOR_1} — which has better customer support?",
        "category": "comparison",
    },
    {
        "id": "CM-12",
        "template": "Is {BRAND} or {COMPETITOR_2} the better fit for {SEGMENT} teams?",
        "category": "comparison",
    },
    {
        "id": "CM-13",
        "template": "{BRAND} vs {COMPETITOR_1}: which integrates better with {INTEGRATION_1}?",
        "category": "comparison",
    },
    {
        "id": "CM-14",
        "template": "Why should I pick {BRAND} over {COMPETITOR_1}?",
        "category": "comparison",
    },
    {
        "id": "CM-15",
        "template": "{BRAND} vs {COMPETITOR_2} — honest reviews from {SEGMENT} founders",
        "category": "comparison",
    },
    # (c) Alternatives — extended
    {
        "id": "AL-06",
        "template": "What can I use instead of {BRAND} when scaling up?",
        "category": "alternatives",
    },
    {
        "id": "AL-07",
        "template": "Free or low-cost alternatives to {COMPETITOR_1} for {SEGMENT} startups",
        "category": "alternatives",
    },
    {
        "id": "AL-08",
        "template": "Tools similar to {BRAND} but more affordable",
        "category": "alternatives",
    },
    {
        "id": "AL-09",
        "template": "Best {CATEGORY} alternatives for a {ROLE}",
        "category": "alternatives",
    },
    {
        "id": "AL-10",
        "template": "What {CATEGORY} tool should I migrate to from {COMPETITOR_2}?",
        "category": "alternatives",
    },
    {
        "id": "AL-11",
        "template": "Which {CATEGORY} is best for small {SEGMENT} teams as a {COMPETITOR_1} replacement?",
        "category": "alternatives",
    },
    {
        "id": "AL-12",
        "template": "Are there alternatives to {BRAND} that are better for {USE_CASE_1}?",
        "category": "alternatives",
    },
    {
        "id": "AL-13",
        "template": "What {CATEGORY} tools have better {INTEGRATION_1} support than {COMPETITOR_2}?",
        "category": "alternatives",
    },
    {
        "id": "AL-14",
        "template": "What do teams switch to after leaving {COMPETITOR_2}?",
        "category": "alternatives",
    },
    {
        "id": "AL-15",
        "template": "{BRAND} alternatives that offer a free trial or generous free tier",
        "category": "alternatives",
    },
    # (d) Use-Case — extended
    {
        "id": "UC-06",
        "template": "Best way to {USE_CASE_2} without hiring extra staff?",
        "category": "use_case",
    },
    {
        "id": "UC-07",
        "template": "Which tool helps a {ROLE} {USE_CASE_1} without deep technical knowledge?",
        "category": "use_case",
    },
    {
        "id": "UC-08",
        "template": "How do early-stage {SEGMENT} startups handle {USE_CASE_1}?",
        "category": "use_case",
    },
    {
        "id": "UC-09",
        "template": "Best practices for {USE_CASE_2} at a {SEGMENT} company",
        "category": "use_case",
    },
    {
        "id": "UC-10",
        "template": "I need to {USE_CASE_1} as a {ROLE} — what do you recommend?",
        "category": "use_case",
    },
    {
        "id": "UC-11",
        "template": "What is the fastest way for a {ROLE} to {USE_CASE_2}?",
        "category": "use_case",
    },
    {
        "id": "UC-12",
        "template": "Top {CATEGORY} tools for {USE_CASE_1} used by {SEGMENT} companies",
        "category": "use_case",
    },
    {
        "id": "UC-13",
        "template": "How can I automate {USE_CASE_1} at my {SEGMENT} business?",
        "category": "use_case",
    },
    {
        "id": "UC-14",
        "template": "What software do successful {SEGMENT} companies use for {USE_CASE_2}?",
        "category": "use_case",
    },
    {
        "id": "UC-15",
        "template": "Best tools for {USE_CASE_1} that work for a remote {SEGMENT} team",
        "category": "use_case",
    },
    # (e) Integration — extended
    {
        "id": "IN-06",
        "template": "Best {CATEGORY} tools with native {INTEGRATION_2} support",
        "category": "integration",
    },
    {
        "id": "IN-07",
        "template": "Does {BRAND} integrate with {INTEGRATION_2}?",
        "category": "integration",
    },
    {
        "id": "IN-08",
        "template": "How do I set up {BRAND} to sync with {INTEGRATION_1}?",
        "category": "integration",
    },
    {
        "id": "IN-09",
        "template": "{CATEGORY} software that works with both {INTEGRATION_1} and {INTEGRATION_2}",
        "category": "integration",
    },
    {
        "id": "IN-10",
        "template": "Which {CATEGORY} has the deepest {INTEGRATION_1} integration for {SEGMENT}?",
        "category": "integration",
    },
    {
        "id": "IN-11",
        "template": "Can {BRAND} connect to {INTEGRATION_2} without a third-party connector?",
        "category": "integration",
    },
    {
        "id": "IN-12",
        "template": "{CATEGORY} platforms with a certified {INTEGRATION_2} integration",
        "category": "integration",
    },
    {
        "id": "IN-13",
        "template": "Is the {BRAND} {INTEGRATION_1} integration reliable?",
        "category": "integration",
    },
    {
        "id": "IN-14",
        "template": "Best {CATEGORY} for teams already relying on {INTEGRATION_1}",
        "category": "integration",
    },
    {
        "id": "IN-15",
        "template": "{BRAND} {INTEGRATION_1} integration: step-by-step setup guide",
        "category": "integration",
    },
    # (f) Pain / Problem
    {
        "id": "PP-01",
        "template": "What is the biggest challenge {SEGMENT} teams face with {CATEGORY} today?",
        "category": "pain_problem",
    },
    {
        "id": "PP-02",
        "template": "How do {ROLE}s solve {USE_CASE_1} when their current tool is too slow?",
        "category": "pain_problem",
    },
    {
        "id": "PP-03",
        "template": "Why do {SEGMENT} companies struggle with {CATEGORY} adoption?",
        "category": "pain_problem",
    },
    {
        "id": "PP-04",
        "template": "What problems does {BRAND} solve for {SEGMENT} companies?",
        "category": "pain_problem",
    },
    {
        "id": "PP-05",
        "template": "My team is frustrated with {COMPETITOR_1} — what should we switch to?",
        "category": "pain_problem",
    },
    {
        "id": "PP-06",
        "template": "What causes {SEGMENT} startups to abandon their {CATEGORY} tool?",
        "category": "pain_problem",
    },
    {
        "id": "PP-07",
        "template": "How do I convince my {SEGMENT} team to adopt a new {CATEGORY} platform?",
        "category": "pain_problem",
    },
    {
        "id": "PP-08",
        "template": "What are the hidden costs of choosing the wrong {CATEGORY} for {SEGMENT}?",
        "category": "pain_problem",
    },
    {
        "id": "PP-09",
        "template": "Why is {USE_CASE_1} still so difficult for {SEGMENT} teams?",
        "category": "pain_problem",
    },
    {
        "id": "PP-10",
        "template": "Common mistakes when choosing a {CATEGORY_LONG} for {SEGMENT}",
        "category": "pain_problem",
    },
    # (g) Pricing / Value
    {
        "id": "PV-01",
        "template": "How much does {BRAND} cost for a {SEGMENT} team?",
        "category": "pricing_value",
    },
    {
        "id": "PV-02",
        "template": "Is {BRAND} worth the price for {SEGMENT} startups?",
        "category": "pricing_value",
    },
    {
        "id": "PV-03",
        "template": "What is the ROI of using {BRAND} for {USE_CASE_1}?",
        "category": "pricing_value",
    },
    {
        "id": "PV-04",
        "template": "How does {BRAND} pricing compare to {COMPETITOR_1}?",
        "category": "pricing_value",
    },
    {
        "id": "PV-05",
        "template": "Can a small {SEGMENT} team afford {CATEGORY} software in 2025?",
        "category": "pricing_value",
    },
    {
        "id": "PV-06",
        "template": "What is the total cost of ownership for {CATEGORY} tools like {BRAND}?",
        "category": "pricing_value",
    },
    {
        "id": "PV-07",
        "template": "Does {BRAND} offer a free trial or free tier?",
        "category": "pricing_value",
    },
    {
        "id": "PV-08",
        "template": "Is it worth switching from {COMPETITOR_1} to {BRAND} given the cost difference?",
        "category": "pricing_value",
    },
    {
        "id": "PV-09",
        "template": "How do {SEGMENT} companies justify {CATEGORY} software spend?",
        "category": "pricing_value",
    },
    {
        "id": "PV-10",
        "template": "What {CATEGORY} tool gives the best value for money in 2025?",
        "category": "pricing_value",
    },
    # (h) Reputation / Social Proof
    {
        "id": "RE-01",
        "template": "What do customers say about {BRAND}?",
        "category": "reputation",
    },
    {
        "id": "RE-02",
        "template": "Is {BRAND} a reliable tool for {SEGMENT} companies?",
        "category": "reputation",
    },
    {
        "id": "RE-03",
        "template": "{BRAND} reviews from {ROLE}s — is it worth it?",
        "category": "reputation",
    },
    {
        "id": "RE-04",
        "template": "What G2 or Capterra ratings does {BRAND} have?",
        "category": "reputation",
    },
    {
        "id": "RE-05",
        "template": "Is {BRAND} trusted by enterprise {SEGMENT} teams?",
        "category": "reputation",
    },
]

assert len(PROMPT_TEMPLATES) == 100, (
    f"PROMPT_TEMPLATES must have exactly 100 entries; got {len(PROMPT_TEMPLATES)}. "
    "Update the list or adjust PLAN_PROMPT_LIMITS."
)
