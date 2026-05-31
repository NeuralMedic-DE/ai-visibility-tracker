# NeuralReach — Email Nurture Sequence
**Drafted:** 2026-06-01  
**Informed by:** `research/competitor_welcome_emails_2026-06-01.md`  
**Delivery tool:** Resend (via T-bbf10de1)  
**Sender address:** `jonas@neuralreach.de`  
**Sender name:** `Jonas @ NeuralReach`  
**Trigger system:** Supabase webhook → Resend API

> **Freeze rule:** No real sends before T-bbf10de1 is done AND `jonas@neuralreach.de` has ≥7 days of sender history (target: 2026-06-04).

---

## Email #1 — Welcome (immediate trigger: `user.signed_up`)

**Subject:** Your NeuralReach access — quick question  
*(Plain text subject, no "Welcome!" filler. Personalise with `{{brand}}` if captured at signup.)*

**From:** jonas@neuralreach.de  
**Format:** Plain text (no HTML template). This is the "CEO email" pattern stolen from Peec.ai.  
**Timing:** Triggered within 60 seconds of account creation.

**Body (draft):**

```
Hi {{first_name}},

Your NeuralReach account is live — you can log in here:
{{dashboard_url}}

Quick question before you dive in: what's the #1 brand you want to track?
Reply here and I'll make sure the prompt set we suggest actually fits your category.

(If you don't see this email or the login link, check spam — it comes from jonas@neuralreach.de)

— Jonas
Founder, NeuralReach
```

**Why this works:**
- Personal reply-to invite signals a human, not a bot (Peec.ai pattern — confirmed trust signal by reviewers)
- One question ("what brand?") is low friction and surfaces the user's intent
- Spam warning preempts the #1 drop-off point in magic-link / transactional email flows
- Plain text avoids spam filters better than heavy HTML templates

**CTA:** Log in to dashboard (primary); reply to email (secondary).

---

## Email #2 — "Your tracking is live" (trigger: `brand.added` OR 30 min after signup)

**Subject:** Tracking is live for {{brand}} — first report in ~1 hour  
**Format:** Minimal HTML (logo + text). Short.  
**Timing:** Fired when user adds their first tracked brand, OR 30 min after signup as a fallback if they haven't.

**Body (draft):**

```
{{first_name}},

Good news: NeuralReach is now running prompts for {{brand}} across ChatGPT, Perplexity, Claude, and Google AI Overviews.

Your first visibility report lands in your dashboard within the next hour.

While you wait, here are 3 example prompts we're already tracking:
• "What's the best AI search visibility tool for B2B SaaS?"  
• "ChatGPT recommendations for [your category]"  
• "Top [your category] tools compared"

You can edit or add to these at any time from your dashboard.

→ View dashboard: {{dashboard_url}}

— Jonas
```

**Why this works:**
- Sets expectation for first data (Otterly pattern — closes churn window before first value)
- Pre-fills sample prompts so users understand what tracking looks like (Otterly AI-assist pattern, email-side version)
- Warm, non-automated feel even though it's automated

**CTA:** Dashboard link.

---

## Email #3 — First Report Ready (trigger: `report.generated` for first report)

**Subject:** {{brand}}'s AI visibility score is in  
**Format:** Minimal HTML with one data highlight.  
**Timing:** Triggered when the first report is generated (typically within 1 hour of brand.added).

**Body (draft):**

```
{{first_name}},

Your first NeuralReach report for {{brand}} is ready.

Here's the headline:

AI Visibility Score: {{score}}/100
Mentions across 4 LLMs: {{mention_count}}
Top competitor appearing instead of you: {{top_competitor}}

The full breakdown — with the specific prompts and content fixes — is in your dashboard.

→ See your report: {{report_url}}

If anything looks off or you want to add competitor tracking, just reply here.

— Jonas
```

**Why this works:**
- Delivers the aha-moment data point that makes value tangible (Gracker 60-second score concept — email-side equivalent)
- Competitor mention triggers loss-aversion (core emotional driver for this product)
- Soft reply invite keeps the human thread open

**CTA:** Report URL (primary).

---

## Email #4 — Day 7 No-Login Re-engagement (trigger: `user.no_login_7d`)

**Subject:** Still there, {{first_name}}? ({{brand}}'s AI score)  
**Format:** Plain text.  
**Timing:** Day 7 if user has not logged in since signup.

**Body (draft):**

```
{{first_name}},

You signed up for NeuralReach a week ago but I haven't seen you back in the dashboard.

Quick update: we've now run {{prompt_count}} prompts for {{brand}} and your AI visibility score is {{score}}/100.

The biggest gap we found: {{top_gap}}.

Worth 5 minutes if you haven't checked yet:
→ {{dashboard_url}}

If the timing isn't right or you hit a snag setting things up, just reply — I'll help directly.

— Jonas
```

**Why this works:**
- Trigger-based re-engagement at the exact churn window (Gracker best-practice, likely their own approach)
- Includes a teaser metric so the email itself is useful, not just a "come back" nag
- Soft breakup tone avoids annoying unsubscribes

**CTA:** Dashboard link (primary); reply for help (secondary).

---

## Email #5 — Day 3 Upgrade Nudge (trigger: free Seed plan, day 3 of use)

> **Only relevant if a free Seed plan is added to the product (currently not live).**

**Subject:** You're only seeing 1 LLM — here's what you're missing  
**Format:** Plain text + simple comparison table.  
**Timing:** Day 3, for free-tier users who have logged in at least once.

**Body (draft):**

```
{{first_name}},

You've been tracking {{brand}} on ChatGPT. Here's what you're not seeing yet:

| LLM | Your brand mentioned? |
| ChatGPT | {{chatgpt_result}} |
| Perplexity | (locked — Starter plan) |
| Claude | (locked — Starter plan) |  
| Google AI Overview | (locked — Starter plan) |

The brands winning AI search are showing up consistently across all four.
Starter plan unlocks everything for $39/mo — first 14 days free.

→ Upgrade: {{upgrade_url}}

— Jonas
```

**CTA:** Upgrade link.

---

## Sequence Map

```
Signup
  └── Email #1 (immediate): Welcome + one question
        └── [brand added or 30 min]
              └── Email #2: Tracking is live, prompts set
                    └── [first report generated]
                          └── Email #3: Score is in, top gap revealed
                                └── [day 7, no login]
                                      └── Email #4: Re-engagement with teaser metric
                                            └── [free tier, day 3, has logged in]
                                                  └── Email #5: Upgrade nudge (if free tier exists)
```

---

## What We Did NOT Steal (and Why)

| Competitor tactic | Why skipped |
|---|---|
| Otterly 7-module video onboarding guide | Too heavyweight for week 2 sprint; build once retention data shows users need it |
| Gracker enterprise full onboarding package | Not our segment at launch; add when first enterprise inquiry arrives |
| Peec Slack access channel | High founder time cost; keep as a personal offer in Email #1 footer only |

---

## Open Questions for Founder

1. Should Email #1 fire for waitlist-to-account conversions too, or only for direct signups?
2. Confirm Resend supports `brand.added` webhook from Supabase — needs confirming in T-bbf10de1 scope.
3. Do we want a plain-text "breakup" email at day 14 end-of-trial? Recommend yes — add as Email #6 once trial flow is live.
