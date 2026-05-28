"""Constants, prompt templates, and scoring rubric for the visibility scorer."""

import os
from pathlib import Path

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
]
