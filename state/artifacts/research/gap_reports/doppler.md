# Doppler — AI Visibility Gap Analysis

**AVS Score:** 31.1 / 100
**Rank:** #48 of 100
**Run date:** 2026-05-30

## LLM Breakdown

| LLM | AVS |
|-----|-----|
| ChatGPT (GPT-4o) | 27.6 |
| Claude (Haiku 4.5) | 28.0 |
| Perplexity (sonar-pro) | 37.6 |

## Weakest Prompts (score 0–3 across LLMs)

1. **[IN-04]** "How does Doppler integrate with Kubernetes for secrets management?" — Score 0/30; all three LLMs return 0. Despite Kubernetes being one of the most important deployment targets for Doppler's secrets management, no LLM surfaces Doppler for this integration query.
2. **[CD-01]** "What is the best secrets management tool for development teams?" — Score 1/30; GPT-4o returns 1, Claude and Perplexity return 0. Doppler is nearly invisible in its primary category-discovery query.
3. **[AL-04]** "What are alternatives to HashiCorp Vault for smaller teams?" — Score 1/30; GPT-4o returns 1, Claude and Perplexity return 0. Doppler is one of the most common Vault alternatives for smaller/mid-market teams but does not appear in this query.

## Recommended Fixes

1. **Publish a dedicated Kubernetes secrets management integration guide:** Create a detailed technical doc — "Managing Kubernetes Secrets with Doppler: A Complete Guide" — covering the Doppler operator, environment injection, and namespace-level syncing. Submit it to CNCF community blogs and Kubernetes Weekly. This directly targets IN-04 invisibility across all three LLMs.
2. **Capture the "best secrets management tool" category query:** Write a "Secrets Management for Development Teams in 2026 — A Practical Guide" that defines the category and positions Doppler prominently. Earn citations from DevOps newsletters (DevOps Weekly, Changelog) and developer documentation sites so LLMs begin surfacing Doppler for CD-01.
3. **Launch a "HashiCorp Vault Alternative" comparison page:** Build a dedicated "/hashicorp-vault-alternative" page with honest feature comparisons, setup complexity benchmarks, and cost comparisons at different team sizes. Target AL-04 by getting this page linked from HashiCorp migration guides and DevOps community posts.
