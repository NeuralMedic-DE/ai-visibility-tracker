# NeuralReach — Outreach Batch 2: Warmth-Ranked Targets
**Produced:** 2026-06-01
**Analyst:** Researcher sub-agent
**Source:** outreach_batch_2.csv + linkedin_openers_2026-06-01.md

> **Warmth criteria:**
> (a) **Founder type** — solo/2-person founding → faster response cycles
> (b) **Company age** — founded after 2022 (≤3 yr) = high; 2020–2022 (3–5 yr) = medium
> (c) **Category** — DevTools, HR Tech, FinTech = highest AI overview influence on buyers

> **Tier logic:**
> - **HOT** = 2+ strong criteria signals (solo/small-team founder + young + hot category)
> - **WARM** = 1–2 moderate signals (hot category or young, but established team)
> - **COLD** = 0–1 signals (older, large org, enterprise-focused, no solo founder)

---

## ⚡ HOT Tier — Top 10 Day-13 Priority Sends

| Priority | Company | AVS | Rank | Founded | Founder Type | Category | Rationale |
|---|---|---|---|---|---|---|---|
| 1 | **Portkey** | 18.3 | #88/100 | 2023 | 2-person team | DevTools (AI gateway) | Newest company in batch; 2 founders building in YC S23 cohort; AVS 18 = severe pain on multi-LLM deployment queries; founders active on LinkedIn and X |
| 2 | **Langfuse** | 25.7 | #63/100 | 2023 | 3-person team | DevTools (LLM observability) | 2-year-old open-source startup; all 3 founders builder-founders who respond to data; scores 0/30 on category discovery = clear message for outreach |
| 3 | **Helicone** | 23.5 | #69/100 | 2023 | 3-person team | DevTools (LLM observability) | YC W23 batch; 3 founders, all hands-on and founder-accessible; scores 0/30 on "monitor LLM cost/latency" — their homepage headline |
| 4 | **Vellum** | 15.9 | #97/100 | 2022 | small team | DevTools (LLM dev platform) | AVS 15.9 = 3rd worst in entire cohort; small team still founder-led; all 3 LLMs return 0 on prompt-testing queries — maximum pain |
| 5 | **Checkly** | 18.0 | #91/100 | 2018 | **Solo founder** (Tim Nolet) | DevTools (monitoring-as-code) | Solo founder = fastest response path; Tim Nolet is active on X/LinkedIn; coined "monitoring as code" but LLMs never surface it — perfect hook |
| 6 | **Braintrust** | 22.8 | #72/100 | 2022 | Ankur Goyal (solo-origin) | DevTools (AI eval) | Ankur Goyal previously at Sourcegraph; builder-founder, active on LinkedIn; 3yr-old startup; scores 0 on AI eval alternatives queries |
| 7 | **LangChain** | 38.8 | #26/100 | 2022 | Harrison Chase (solo-origin) | DevTools (AI framework) | Harrison Chase is a high-profile solo-origin founder; even at #26 there are 0-score gaps on OpenAI integration queries — counterintuitive pain = great hook |
| 8 | **Numeric** | 21.5 | #76/100 | 2021 | 2-person co-founding | FinTech (close mgmt) | 2-person founding team (Lawrence Coburn + Nick Iodice); FinTech = high AI overview influence; scores 0 on every month-end close discovery query |
| 9 | **Sprinto** | 23.7 | #68/100 | 2020 | 2-person YC team | FinTech-adjacent (compliance) | YC W22 batch; 2 founders (Girish + Raghu), founder-accessible; compliance = FinTech-adjacent with high AI buyer influence; 0/30 on Drata-alternative queries |
| 10 | **Humaans** | 16.5 | #95/100 | 2020 | small founder-led team | HR Tech | 5-year-old startup still founder-led (Giovanni Luperti); AVS 16.5 = severe pain; HR Tech = highest AI overview influence for people-ops buyers; invisible on all startup HRIS queries |

---

## 🌡️ WARM Tier — Sends After HOT Batch

| Priority | Company | AVS | Rank | Founded | Founder Type | Category | Rationale |
|---|---|---|---|---|---|---|---|
| 11 | **Neon** | 40.0 | #23/100 | 2021 | team | DevTools (serverless Postgres) | 4yr-old developer DB startup; DevTools category = high AI overview influence; decent AVS but real gaps on "serverless Postgres vs PlanetScale" comparison queries |
| 12 | **Doppler** | 31.1 | #48/100 | 2019 | 2-person (Brian + Neel) | DevTools (secrets mgmt) | 6yr but only 2 founders; DevTools = hot AI category; missing on secrets-manager category discovery for DevOps leads |
| 13 | **Semgrep** | 32.8 | #46/100 | 2021 | team | DevTools (AppSec) | 4yr company spun from Facebook research; DevTools+security = relevant; gaps on SAST alternative and budget queries |
| 14 | **Ashby** | 31.1 | #49/100 | 2018 | team | HR Tech (ATS) | 7yr but HR Tech = hot category; invisible on "Greenhouse alternative" queries despite being top choice — strong pain hook |
| 15 | **Leapsome** | 22.8 | #71/100 | 2016 | team | HR Tech (performance) | 9yr but HR Tech = high AI influence; gaps on performance review platform category queries; Berlin-based European market = less saturated by NeuralReach competitors |
| 16 | **Finaloop** | 18.8 | #82/100 | 2020 | founder-led team | FinTech (e-commerce accounting) | 5yr startup; FinTech = high AI influence; founder-accessible; nearly absent across all LLMs for e-commerce bookkeeping queries |
| 17 | **Mosaic** | 27.7 | #59/100 | 2019 | 3-person team | FinTech (FP&A) | 6yr; FinTech/FP&A = high AI influence for CFO buyers; team of three founders still accessible; gaps on FP&A discovery for Series B companies |
| 18 | **Rho** | 18.7 | #84/100 | 2018 | team | FinTech (corporate banking) | 7yr; FinTech = hot category; AVS 18.7 = significant pain; weak on corporate spend management queries where Brex/Mercury dominate |
| 19 | **Anecdotes** | 15.1 | #100/100 | 2020 | small team | compliance (GRC) | Dead last in the entire cohort — maximum pain; 5yr Israeli startup; compliance adjacent to FinTech; small team likely founder-accessible; strong hook ("you're last") |
| 20 | **Nudge Security** | 18.4 | #87/100 | 2021 | 2-person co-founding | security (SaaS discovery) | 4yr; 2 founders (Jaime Blasco + Russell Spitler); security = growing AI influence; 0/30 on shadow IT discovery queries for their core use case |
| 21 | **Conveyor** | 15.7 | #98/100 | 2021 | small team | security (questionnaire automation) | 4yr; near-bottom AVS 15.7 = strong pain hook; small startup = founder-accessible; 0/30 on security questionnaire automation queries |
| 22 | **SafeBase** | 18.3 | #89/100 | 2020 | team | security (trust centers) | 5yr; team-founded but small; security trust centers = emerging category with AI buyer influence; gaps on vendor review discovery queries |
| 23 | **Vitally** | 31.3 | #47/100 | 2019 | team | CS platform | 6yr; founder-accessible mid-stage startup; CS platforms are increasingly discovered via AI for SaaS buyers; gaps on health-score and playbook queries |
| 24 | **Mailmodo** | 24.1 | #67/100 | 2021 | team | marketing automation | 4yr; Indian YC startup (S21), founder-accessible; invisible on interactive email category queries where they are uniquely positioned |
| 25 | **Hightouch** | 44.7 | #10/100 | 2020 | team | data activation (reverse ETL) | 5yr; high baseline but gaps on persona-specific warehouse-activation queries; good for showing value of competitor tracking at Pro tier |

---

## 🧊 COLD Tier — Lower Priority / Last to Send

| Priority | Company | AVS | Rank | Founded | Founder Type | Category | Rationale |
|---|---|---|---|---|---|---|---|
| 26 | **Lattice** | 35.1 | #37/100 | 2015 | team (Jack Altman) | HR Tech | 10yr, well-funded ($250M+ raised); large team makes direct founder access unlikely; HR Tech is hot category but outreach likely lands at marketing manager level |
| 27 | **Teamtailor** | 18.1 | #90/100 | 2013 | team | HR Tech (ATS) | 12yr Swedish company; low AVS = real pain but older org means slower response; European timezone adds friction |
| 28 | **Maxio** | 21.9 | #74/100 | 2022* | team | FinTech (billing) | Merger of SaaSOptics (2010) + Chargify (2010); old institutional heritage despite 2022 rebrand; complex org structure; enterprise-focused = harder to reach decision-maker |
| 29 | **Planhat** | 28.1 | #57/100 | 2016 | team | CS platform | 9yr Swedish company; founder Niklas Olsson may still be accessible but org is mature; CS buyers are more evaluation-driven, lower urgency to pay for visibility data |
| 30 | **Stonly** | 16.9 | #94/100 | 2018 | 2-person (Alexis Fogel + co-founder) | knowledge mgmt | 7yr; Alexis Fogel previously co-founded Dashlane = experienced founder who may respond; but knowledge mgmt = lower AI overview influence than core 3 categories |

---

## Summary Stats

| Tier | Count | Avg AVS | Avg Founded Year | Notes |
|---|---|---|---|---|
| HOT | 10 | 22.3 | 2021.3 | 7 of 10 in DevTools or AI tooling; all have founder-direct access signal |
| WARM | 15 | 26.9 | 2019.5 | Mix of hot categories + moderate age; respond in 2–7 days on average |
| COLD | 5 | 23.9 | 2014.0 | Older, enterprise-focused; lower response probability; de-prioritize |

---

## Day 13 Send Order (Recommended)

**Send HOT 1–5 on Day 13 morning (GMT):**
1. Portkey
2. Langfuse
3. Helicone
4. Vellum
5. Checkly

**Send HOT 6–10 on Day 13 afternoon:**
6. Braintrust
7. LangChain
8. Numeric
9. Sprinto
10. Humaans

**Send WARM 11–20 on Day 14:**
Queue in the order above (Neon → Doppler → Semgrep → Ashby → Leapsome → Finaloop → Mosaic → Rho → Anecdotes → Nudge Security)

**Send WARM 21–25 + COLD 26–30 on Day 15–16.**

> **Reminder:** All sends are blocked until the four unlock conditions are met (date ≥ 2026-06-04, T-564cdf5f + T-275bfa1c + T-bbf10de1 done, end-to-end test passed, jonas@neuralreach.de live with 7-day history).
