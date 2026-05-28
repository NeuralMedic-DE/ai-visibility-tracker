# Prefect — AI Visibility Gap Analysis

**AVS Score:** 46.8 / 100
**Rank:** #2 of 100
**Run date:** 2026-05-30

## LLM Breakdown

| LLM | AVS |
|-----|-----|
| ChatGPT (GPT-4o) | 54.4 |
| Claude (Haiku 4.5) | 36.8 |
| Perplexity (sonar-pro) | 49.2 |

## Weakest Prompts (score 0–3 across LLMs)

1. **[UC-05]** "What software helps with migrate from Airflow to a modern lightweight orchestration platform without rewrites at scale?" — Combined score of 6/30. Scores only 1 on both GPT-4o and Perplexity (negative/neutral sentiment), and only 4 on Claude. The migration-at-scale framing triggers minimal Prefect recall; all three LLMs fail to surface it prominently.

2. **[CM-01]** "Prefect vs Airflow: which is better?" — Combined score of 9/30. Despite being a named-brand comparison, GPT-4o ranks Prefect 6th (score 3), Claude ranks it 12th (score 3), and Perplexity ranks it 11th (score 3). The generic phrasing of "which is better" without context dilutes Prefect's positioning across all LLMs.

3. **[UC-01]** "How do I orchestrate Python data workflows with built-in retry scheduling and observability without spending a lot on software?" — Combined score of 10/30. Scores 3 on GPT-4o (negative sentiment, ranked 2nd), 4 on Claude (unranked), and 3 on Perplexity (ranked 17th). The "without spending a lot" framing introduces cost-sensitivity that pushes LLMs toward open-source alternatives over Prefect.

## Recommended Fixes

1. **Strengthen at-scale migration messaging:** Publish dedicated content (case studies, migration guides, landing pages) around Prefect as the go-to Airflow migration path. Target the specific phrasing "migrate from Airflow without rewrites" and "Prefect at scale" to improve UC-05 recall across all LLMs.

2. **Improve head-to-head comparison positioning for Prefect vs Airflow:** The CM-01 score reveals weak positioning in generic "vs Airflow" queries. Create clear, structured comparison content emphasizing Prefect's specific advantages (Python-native, no DAG rewriting required, modern UI) to improve ranking from 6th-12th to top-3 across LLMs.

3. **Address cost-sensitive use-case framing:** The UC-01 pattern shows Prefect underperforms when users add "without spending a lot" qualifiers. Publish open-source tier content and pricing transparency pages that explicitly position Prefect Community/OSS as a cost-effective orchestration solution for teams managing Python pipelines.
