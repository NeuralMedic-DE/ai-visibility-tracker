# Semgrep — AI Visibility Gap Analysis

**AVS Score:** 32.8 / 100
**Rank:** #46 of 100
**Run date:** 2026-05-30

## LLM Breakdown

| LLM | AVS |
|-----|-----|
| ChatGPT (GPT-4o) | 20.8 |
| Claude (Haiku 4.5) | 39.2 |
| Perplexity (sonar-pro) | 38.4 |

## Weakest Prompts (score 0–3 across LLMs)

1. **[CD-01]** "What is the best static analysis tool for finding security vulnerabilities?" — Score 0/30; all three LLMs (GPT-4o, Claude, Perplexity) return 0. Semgrep is completely invisible in top-of-funnel category discovery for its core security scanning use case.
2. **[UC-01]** "How do I enforce secure coding standards across my engineering team?" — Score 0/30; all three LLMs return 0. Semgrep has zero presence in use-case queries about developer security enforcement, a primary buying scenario.
3. **[AL-04]** "What are the best open-source SAST tools?" — Score 2/30; GPT-4o and Claude return 0, Perplexity returns 2. Semgrep is nearly absent from alternative/open-source SAST comparisons despite being one of the most prominent open-source options.

## Recommended Fixes

1. **Publish "What is static analysis?" landing page:** Create a dedicated, SEO-optimized page titled "Static Application Security Testing (SAST) — What It Is and How Semgrep Leads" that defines the category and positions Semgrep as the default answer. This directly targets CD-01 invisibility.
2. **Create use-case content for developer security enforcement:** Write a detailed guide — "How to Enforce Secure Coding Standards at Scale with Semgrep" — covering team policies, CI/CD integration, and custom rules. Submit it to developer security publications (OWASP community, DevSecOps newsletters) so LLMs surface it for UC-01 queries.
3. **Claim the open-source SAST narrative:** Publish a comparison page "Best Open-Source SAST Tools in 2026 (Semgrep vs. Bandit vs. CodeQL)" with benchmark data and integration guides. Earn backlinks from open-source security communities so Perplexity and GPT-4o begin citing Semgrep for AL-04 alternative queries.
