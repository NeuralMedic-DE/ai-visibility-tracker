# Vercel — AI Visibility Gap Analysis

**AVS Score:** 54.8 / 100  
**Rank:** #1 of 25  
**Run date:** 2026-05-28

## LLM Breakdown

| LLM | AVS |
|-----|-----|
| ChatGPT (GPT-4o) | 64.0 |
| Claude (Haiku 4.5) | 44.4 |
| Perplexity (sonar-pro) | 56.0 |

## Weakest Prompts (score 0–3 across LLMs)

1. **[CD-01]** "What is the best deployment for frontend engineering teams at SaaS companies?" — score 0 on ChatGPT, Claude, and Perplexity; the broadest category-entry question is fully invisible.
2. **[UC-02]** "Best way to manage preview deployments for every pull request for a frontend engineering team" — score 0 on ChatGPT and Perplexity; core use-case narrative missing.
3. **[CD-03]** "Which deployment software should a head of frontend engineering or CTO use?" — score 0 on Claude (negative sentiment) and Perplexity; persona-level queries missing.

## Recommended Fixes

1. **Publish a "Best Deployment Platform for SaaS Frontend Teams" landing page:** CD-01 scores 0 on all 3 LLMs despite Vercel being the category leader — an explicit, indexed page targeting this phrase will capture the category-discovery entry point across ChatGPT, Claude, and Perplexity.
2. **Add a "Preview Deployments per PR" use-case guide:** UC-02 is invisible on ChatGPT and Perplexity — a step-by-step guide titled "How to manage preview deployments for every pull request" with schema markup will close this gap.
3. **Lift Claude AVS from 44.4:** Claude underperforms by 20 points vs ChatGPT; publishing developer-facing docs and changelog posts that Claude's training and live sources can cite will narrow the gap on CD-03 and comparison prompts.
