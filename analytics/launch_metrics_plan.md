# NeuralReach — Launch-Readiness Metrics Dashboard & Pivot Thresholds

**Document owner:** Analyst sub-agent  
**Created:** 2026-05-27  
**Company:** NeuralReach (under NeuralMedic)  
**Purpose:** Defines the exact metrics, measurement sources, day-7 check-in thresholds, and day-14 binary pivot decision for the "AI Visibility Index" leaderboard launch.

> **How to use this document:** On day 7, read every row in Section 2 and count how many metrics are in the "concern" or "danger" zone. On day 14, read Section 3 — any single HARD PIVOT trigger fires the pivot, regardless of other metrics. No judgment calls needed.

---

## 1. Assumed Launch Timeline

| Milestone | Target Day | Dependency |
|---|---|---|
| All 100 brands scored | Day 1–2 | T-7033735f (in_progress) |
| UI wired to real data | Day 2–3 | T-6533907f |
| Stripe checkout live | Day 3 | T-5ac6dc40 |
| Vercel prod deploy | Day 3–4 | T-873b1a23 (approval needed) |
| Reddit + IH posts published | Day 4–5 | Founder executes T-07ca55ef drafts |
| LinkedIn outreach begins | Day 5–7 | T-973158c3 + T-931be218 |

**Day 0 = 2026-05-27 (today). Day 14 = 2026-06-10.**  
**Day-14 pivot decision must be made by end of day 2026-06-10.**

---

## 2. Metric Definitions and Measurement Sources

### Metric 1 — Unique Visitors

**What it measures:** Total distinct sessions to any NeuralReach page (homepage + /leaderboard).  
**Tool:** Plausible Analytics or PostHog (must be installed before launch — no data without this).  
**Where to check:** Plausible dashboard → "Unique visitors" (7-day or cumulative).

| Status | Day-7 Threshold | Day-14 Threshold |
|---|---|---|
| ✅ On track | ≥ 400 cumulative | ≥ 500 cumulative |
| ⚠️ Concern | 200–399 | 300–499 |
| 🔴 Danger | < 200 | < 300 |

**Context:** The 4 planned posts (r/SaaS, r/SEO, r/SideProject, Indie Hackers) combined should deliver 500–2,000 visits in the first 48–72 hours if upvote velocity is good. If day-7 total is <200 it means all 4 posts underperformed — not a conversion problem, a distribution problem. Check which post got the most traction and double down with a follow-up comment or cross-post.  
**Pivot hard trigger:** < 500 total by day 14 (from company brief).

---

### Metric 2 — Waitlist Signups

**What it measures:** Total unique emails captured in Supabase `waitlist` table.  
**Tool:** Supabase dashboard → Table editor → `waitlist` → COUNT.  
**Where to check:** `SELECT COUNT(*) FROM waitlist WHERE created_at <= '<day-14-date>'`

| Status | Day-7 Threshold | Day-14 Threshold |
|---|---|---|
| ✅ On track | ≥ 30 signups | ≥ 50 signups |
| ⚠️ Concern | 15–29 | 25–49 |
| 🔴 Danger | < 15 | < 25 |

**Context:** B2B tool leaderboard landing pages typically convert at 6–12%. At 500 visitors with 8% conversion = 40 signups. 30 by day 7 is realistic; 50 by day 14 matches the company brief pivot threshold.  
**Pivot hard trigger:** < 50 signups by day 14 (from company brief).

---

### Metric 3 — Signup-to-Visit Conversion Rate

**What it measures:** Waitlist signups ÷ unique visitors. Tells you if the landing page is doing its job, independent of traffic volume.  
**How to calculate:** `(Supabase waitlist count) / (Plausible unique visitors) × 100`

| Status | Day-7 Threshold | Day-14 Threshold |
|---|---|---|
| ✅ On track | ≥ 8% | ≥ 8% |
| ⚠️ Concern | 4–8% | 4–8% |
| 🔴 Danger | < 4% | < 4% |

**Context:** 8% is achievable for a free, no-credit-card leaderboard with a clear value prop. <4% means the headline/CTA is broken or the page load is slow. This metric is independent of the pivot trigger — even if traffic is low, you can debug conversion before more distribution.  
**Action if danger:** A/B test the hero headline and CTA. Current draft: "Find out if AI chatbots are hiding your brand from buyers." Try: "See how your brand ranks in ChatGPT, Claude, and Perplexity — free."

---

### Metric 4 — Reddit Upvotes / Comments per Post

**What it measures:** Community signal that the angle is resonating. Upvotes drive continued algorithm exposure.  
**Tool:** Manual check on each post URL. Log daily in a simple tracker.  
**Log file location:** `analytics/reddit_tracking.csv` (create at launch, update daily).

| Subreddit | On Track (first 48h) | Concern | Danger |
|---|---|---|---|
| r/SaaS | ≥ 75 upvotes, ≥ 10 comments | 30–74 | < 30 |
| r/SEO | ≥ 40 upvotes, ≥ 8 comments | 20–39 | < 20 |
| r/SideProject | ≥ 30 upvotes, ≥ 5 comments | 15–29 | < 15 |
| Indie Hackers | ≥ 20 upvotes, ≥ 8 comments | 10–19 | < 10 |

**Note on timing:** Post r/SaaS first on Tuesday–Thursday between 9–11am EST. IH can go same day. r/SEO and r/SideProject within 24 hours. Don't post all 4 simultaneously — stagger by 12 hours.  
**Action if danger:** Do NOT re-post (ban risk). Instead, drop a high-value comment in an existing thread ("I just built a tool that measures this...") and link. Or post in r/Entrepreneur.  
**Pivot signal (soft):** If the top post is below 30 upvotes by day 7 across all subreddits, the distribution channel has failed. Consider writing a cold email blast to the 100 leaderboard brands directly instead.

---

### Metric 5 — LinkedIn Connection Acceptance Rate

**What it measures:** % of cold connection requests sent to bottom-ranked brand founders who accept.  
**Target audience:** Founders/CMOs of brands ranked 51–100 on the leaderboard (lowest visibility).  
**Tool:** Manual LinkedIn tracking. Log in `analytics/linkedin_tracking.csv`.

| Status | Threshold |
|---|---|
| ✅ On track | ≥ 20% acceptance rate |
| ⚠️ Concern | 10–19% |
| 🔴 Danger | < 10% |

**Denominator:** Send minimum 30 requests to measure this reliably. Send in batches of 10 to avoid LinkedIn rate limits. First batch goes out on day 5–6 when outreach list is ready.  
**Action if danger:** The connection request message is failing. Reduce length, remove anything that looks like a pitch, lead with the specific rank number ("Your brand ranked #87 out of 100 in AI visibility — I thought you'd want to see why").  
**Note:** LinkedIn reply rate (of those who accept) should also be tracked. Target: ≥ 15% reply rate from accepted connections.

---

### Metric 6 — Demo / Report Requests

**What it measures:** Clicks on "Get my brand's report" CTA on the leaderboard page. This is the highest-intent action a visitor can take — it signals someone wants to pay.  
**Tool:** PostHog event tracking (`event: cta_click, property: button: get_report`) OR Plausible goal conversion. Must be wired at launch.  
**Where to check:** PostHog → Events → `cta_click` filter by `get_report`.

| Status | Day-7 Threshold | Day-14 Threshold |
|---|---|---|
| ✅ On track | ≥ 15 CTA clicks | ≥ 25 CTA clicks |
| ⚠️ Concern | 5–14 | 10–24 |
| 🔴 Danger | < 5 | < 10 |

**Context:** At 500 visitors, 3% CTA click-through = 15 clicks. These are warm leads for the $39 Starter plan. Each CTA click should trigger an automated follow-up email ("Your request is in — here's a preview of what NeuralReach tracked for [brand]..."). This is not yet implemented but is critical for conversion.  
**Action if danger:** Move the CTA above the fold on the leaderboard table. Add a "Your brand not here? Get scored free" secondary CTA.

---

### Metric 7 — Paid Conversions

**What it measures:** Number of successful Stripe `checkout.session.completed` events (test mode until launch, live mode after deploy).  
**Tool:** Stripe Dashboard → Payments → filter by product (Starter $39 or Pro $89).  
**Where to check:** Stripe dashboard → Customers tab → check for subscriptions created.

| Status | Day-7 Threshold | Day-14 Threshold |
|---|---|---|
| ✅ On track | ≥ 0 (waitlist focus, not hard target) | ≥ 1 paying customer |
| ⚠️ Concern | 0 with no CTA clicks | 0 with ≥ 10 CTA clicks |
| 🔴 Danger | — | 0 paying customers after direct outreach |

**Context:** Expecting paid conversion by day 7 is premature — the funnel is waitlist → demo request → paid. Day 14 is the first hard target for at least 1 paying customer at $39. If day 14 arrives with 0 paying customers AND we have ≥25 waitlist signups, the problem is the pricing/CTA handoff, not the product. Try offering a 7-day free trial to any waitlist member who has clicked a report CTA.  
**Note:** $39/mo Starter is the conversion target. $89/mo Pro is aspirational until we have ≥3 Starter customers.

---

### Metric 8 — Monthly Recurring Revenue (MRR)

**What it measures:** Committed monthly revenue from active Stripe subscriptions.  
**Tool:** Stripe Dashboard → Revenue → MRR widget, OR manual: count subscriptions × plan price.  
**Formula:** `(Starter subscribers × $39) + (Pro subscribers × $89)`

| Status | Day-14 Threshold | Day-30 Target |
|---|---|---|
| ✅ On track | ≥ $39 MRR (≥ 1 Starter) | $120–$300 MRR |
| ⚠️ Concern | $0 MRR, but ≥ 1 demo request | $39–$119 MRR |
| 🔴 Danger | $0 MRR, zero demo requests | $0 MRR |

**30-day goal from company brief:** 3–6 paying customers = $117–$534 MRR. Middle of range: ~$200 MRR.

---

## 3. Day-14 Pivot Decision Logic

**Date:** 2026-06-10 (end of day)

**Read this section on day 14. Answer these 4 questions:**

---

### Question 1 (HARD): Did we cross 500 unique visitors?
- YES → continue. NO → **PIVOT TRIGGER FIRED.** Proceed to pivot plan.

### Question 2 (HARD): Do we have ≥ 50 waitlist signups?
- YES → continue. NO → **PIVOT TRIGGER FIRED.** Proceed to pivot plan.

### Question 3 (SOFT): Do we have ≥ 1 paying customer?
- YES → strong signal, continue aggressively.
- NO → continue but change tactics (see below).

### Question 4 (SOFT): Is conversion rate ≥ 4%?
- YES → traffic is the problem, not the page.
- NO → page is the problem; fix before more distribution.

---

### Pivot Decision Matrix

| Visitors | Signups | Decision |
|---|---|---|
| ≥ 500 | ≥ 50 | ✅ **STAY THE COURSE** — execute LinkedIn outreach hard, add free-trial offer |
| ≥ 500 | < 50 | ⚠️ **CONVERT PROBLEM** — rewrite CTA + email flow before day 21; don't pivot yet |
| < 500 | ≥ 50 | ⚠️ **DISTRIBUTION PROBLEM** — try paid Reddit Ads ($50 budget) and IH newsletter; delay pivot 3 days |
| < 500 | < 50 | 🔴 **PIVOT NOW** — leaderboard distribution failed; execute paid-listing directory model |

---

## 4. Pivot Plan (if triggered)

**Pivot to: Paid-listing directory model at $149/listing**  
**What changes:** Same scoring engine and leaderboard UI, but brands pay $149 to get a "verified" AI visibility badge and appear in a prominent directory section. No SaaS subscription — one-time listing fee. Target: 5 listings in week 3–4 = $745 gross.

**Day 14 pivot actions (if triggered):**
1. Change homepage copy from waitlist to "List your brand — $149 one-time" (30 min).
2. Add a Stripe payment link for $149 product (15 min with existing Stripe setup).
3. Email all waitlist signups with pivot offer: "The index is live — list your brand for $149 and get your full AI visibility report" (30 min).
4. Send LinkedIn message to any accepted connections: "We just opened paid listings — $149 for a full AI visibility audit + badge."
5. Update Reddit/IH posts in comments: "We've launched paid listings for brands that want full reports."

**Pivot success metric:** 3 listings by day 21 = $447 gross. Covers first month of API costs.

---

## 5. Daily Tracking Template

Create `analytics/daily_log.csv` at launch with these columns:

```
date,unique_visitors_cumul,waitlist_signups_cumul,conversion_rate_pct,
reddit_best_upvotes,linkedin_requests_sent,linkedin_accepted,
cta_clicks_cumul,paid_conversions,mrr_usd,notes
```

Update once per day (evening). Takes < 5 minutes. This is the only source of truth for the day-14 decision.

**First row to fill on launch day (day ~4):**
```
2026-06-00,0,0,0,0,0,0,0,0,0,launch day
```

---

## 6. Pre-Launch Checklist (must complete before Reddit posts go live)

- [ ] Plausible or PostHog script installed on Next.js app (`app/layout.tsx`)
- [ ] PostHog `cta_click` event fires on "Get my brand's report" button click
- [ ] Supabase `waitlist` table is live and accepting inserts
- [ ] Stripe Starter ($39) and Pro ($89) checkout links are live in test mode, then switched to live mode on deploy day
- [ ] `analytics/daily_log.csv` file created (empty with headers)
- [ ] `analytics/reddit_tracking.csv` file created with post URLs
- [ ] `analytics/linkedin_tracking.csv` file created with outreach rows

---

## 7. Summary Scorecard (copy to daily_log notes)

```
DAY-14 STATUS CHECK — 2026-06-10
=================================
Unique visitors:    ___ / 500 needed  → ON TRACK / CONCERN / DANGER
Waitlist signups:   ___ / 50 needed   → ON TRACK / CONCERN / DANGER
Conversion rate:    ___%               → ON TRACK / CONCERN / DANGER
Best Reddit post:   ___ upvotes        → ON TRACK / CONCERN / DANGER
LinkedIn accept:    ___%               → ON TRACK / CONCERN / DANGER
CTA clicks:         ___                → ON TRACK / CONCERN / DANGER
Paid customers:     ___                → ON TRACK / CONCERN / DANGER
MRR:                $___               → ON TRACK / CONCERN / DANGER

PIVOT FIRED? YES / NO
If YES: Execute pivot plan (Section 4) immediately.
```

---

*Document created by analyst sub-agent. Last updated 2026-05-27. Update thresholds only if the launch date slips more than 3 days.*
