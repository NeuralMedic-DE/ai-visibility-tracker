# Raycast — AI Visibility Gap Analysis

**AVS Score:** 40.4 / 100
**Rank:** #19 of 100
**Run date:** 2026-05-30

## LLM Breakdown

| LLM | AVS |
|-----|-----|
| ChatGPT (GPT-4o) | 37.6 |
| Claude (Haiku 4.5) | 34.4 |
| Perplexity (sonar-pro) | 49.2 |

## Weakest Prompts (score 0–3 across LLMs)

1. **[CD-03]** "Which productivity software should a Developer Productivity Lead or CTO at a tech company use?" — Combined score of 0/30. All three LLMs score 0 — Raycast is completely absent. Despite being squarely positioned for developer productivity, LLMs do not surface Raycast when a technical leader explicitly asks about productivity software for their team.

2. **[IN-04]** "Best productivity that works with Slack and GitHub" — Combined score of 0/30. All three LLMs score 0. Raycast has deep integrations with both Slack and GitHub, yet is entirely absent when users search for productivity tools that connect these two platforms — a direct product capability gap in LLM recall.

3. **[IN-05]** "productivity tools with native Slack integration" — Combined score of 0/30. All three LLMs score 0. A direct integration-discovery query for Slack — one of Raycast's most-used integrations — returns zero visibility across all LLMs, indicating that Raycast's integration ecosystem is not being indexed or cited by any of the three LLMs.

## Recommended Fixes

1. **Build developer-specific productivity positioning content:** CD-03 scoring zero for developer productivity leadership queries reveals Raycast is not in the LLM vocabulary for "developer productivity software." Create content targeting Developer Productivity Leads and engineering CTOs — "How engineering teams use Raycast to speed up developer workflows" — and ensure this content earns placement on sources like The Pragmatic Engineer, GitHub Blog, and engineering-focused newsletters.

2. **Create dedicated integration landing pages for Slack and GitHub:** IN-04 and IN-05 both scoring zero despite being core Raycast integrations is a critical gap. Publish structured integration hub pages ("Raycast + Slack," "Raycast + GitHub") with specific use-case descriptions — e.g., "search GitHub PRs from your Mac launcher" — so LLMs can retrieve and cite these pages for integration-discovery queries.

3. **Address the Perplexity vs GPT-4o/Claude visibility imbalance:** Raycast scores 49.2 on Perplexity but only 37.6 on GPT-4o and 34.4 on Claude — a 15-point gap. This suggests Raycast's content is well-optimized for real-time web search but underrepresented in the training data and knowledge bases that GPT-4o and Claude rely on. Focus on earning editorial coverage in long-form content sources (blog posts, developer guides, video content transcripts) that get indexed by OpenAI and Anthropic's knowledge bases.
