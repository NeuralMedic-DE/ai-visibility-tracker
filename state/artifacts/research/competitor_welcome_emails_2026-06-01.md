# Competitor First-Touch Onboarding Emails
**Task:** T-0db32825  
**Researched:** 2026-06-01  
**Researcher:** Researcher sub-agent  
**Observability:** All three flows researched via public reviews, help docs, and pricing pages. None directly observed by signing up (Gracker email content remains partially unobservable). Founder signup recommended for ground-truth verification.

---

## Question
What do Peec.ai, Otterly.ai, and Gracker.ai send as their first-touch (welcome / signup confirmation) email to a new free or trial signup? What does each contain, how fast does it arrive, what action does it push, and what onboarding friction does it reduce?

---

## Findings

### 1. Peec.ai

**Sources:** marketermilk.com review, thedigitalmerchant.com review, generatemore.ai review, saasclub.io podcast (Marius Meiners CEO interview), docs.peec.ai  

**(a) Email content:**
- **First email sent:** A magic-link authentication email arrives immediately on signup — passwordless auth, so this IS the "get into the app" email. Note: multiple reviewers flag it lands in spam.
- **Second email sent:** A personal welcome email from CEO **Marius Meiners** (his real personal address, not a noreply alias). Content is brief: introduction, invitation to reply directly with any questions.
- Subject line: Not publicly documented; likely plain-text from a personal Gmail/Fastmail address.
- Tone: Founder-to-founder, text-only, no HTML templates visible.

**(b) Timing:**
- Magic link: Immediate on signup (check spam).
- CEO welcome email: Implied same-day, possibly triggered within minutes. No exact delay documented.

**(c) Action pushed:**
- Magic link: Click to enter the app.
- CEO email: "Reply if you have questions" — low-pressure, direct support channel opener.

**(d) Friction reduced:**
- No password to set/forget (magic link).
- In-app "Kickstart Session" booking button on first screen reduces setup confusion.
- AI-suggested starter prompts ("topics") so users aren't blank-page blocked.
- WhatsApp + Slack access to founding team mentioned in reviews as a support safety net.
- 7-day free trial, no credit card required.

**Observable?** Partially. CEO email content inferred from reviewer paraphrase ("you can simply reply to if you have any questions"). Subject line and exact body not captured publicly. **Recommend founder signs up with a personal email to capture both emails verbatim.**

---

### 2. Otterly.ai

**Sources:** help.otterly.ai signup guide, help.otterly.ai onboarding guide (7 modules), otterly.ai pricing page, theanswerenginereport.com, generatemore.ai/blog/otterly-ai-review  

**(a) Email content:**
- **First email sent:** Verification/confirmation email containing a verification link (not magic-link passwordless — user still adds their name after clicking).
  - Subject line: Not publicly documented.
  - Body: Implied standard "confirm your email address" with a link button.
- **Post-verification onboarding:** 4-step AI-assisted setup (the AI auto-selects niches, relevant prompts, and competitor brands). This is the standout frictionless moment — users are not asked "what do you want to track?" cold.
- No separate HTML welcome email documented in any public source.

**(b) Timing:**
- Verification email: Immediate on signup.
- First meaningful report: Within 1 hour of completing onboarding.

**(c) Action pushed:**
- Verify → name entry → AI-assisted prompt/competitor selection → start monitoring.
- No separate "please log back in" nudge documented yet.

**(d) Friction reduced:**
- AI picks your prompts and competitors for you (4-step AI-assisted setup) — removes the #1 new-user block ("I don't know what to track").
- No credit card for 14-day trial.
- Standard plan and above include a personal onboarding session (human, not automated).
- 7-module video onboarding guide available in help centre.
- Reports live within 1 hour — instant gratification closes the activation gap before the user can churn.

**Observable?** Partially. Help docs confirm the verification email step and the 4-step AI-assisted setup. Email body and subject line not captured. **Recommend founder signs up to observe full email sequence.**

---

### 3. Gracker.ai

**Sources:** gracker.ai homepage, gracker.ai/pricing, gracker.ai/cybersecurity-marketing-101/product-led-onboarding-experiences, slashdot.org reviews, G2 review summaries, comparateur-ia.com  

**(a) Email content:**
- **Two signup paths exist:**
  1. **Free Seed plan ("Get My Free AI Score"):** No CC required; produces an AI visibility score in 60 seconds. Likely triggers a transactional confirmation email, but body/subject not documented publicly.
  2. **14-day trial (paid plans):** Standard trial confirmation email expected; specifics not captured.
- No public source documents a founder/CEO personal welcome email (unlike Peec).
- Gracker's blog describes trigger-based email logic (completion emails, re-engagement emails) as best practice — likely reflects their own system, but no copy visible.
- Enterprise signups receive a human-touch onboarding: competitive landscape analysis, custom prompt library, CMS integration, content strategy workshop, 90-day roadmap.

**(b) Timing:**
- AI score: Delivered in-app within 60 seconds of entering brand info — before any email is needed.
- Full monitoring: "Within minutes" (self-serve plans); "within 24 hours" mentioned in one review context.

**(c) Action pushed:**
- Free path: See your AI score → upgrade to see more.
- Trial path: Set up tracking (product name → category → competitors → prompt preview → monitoring starts).

**(d) Friction reduced:**
- Free Seed plan with no CC removes the trial-commitment barrier entirely — score first, pay later.
- Category-aware setup (cybersecurity, IAM, DevTools, etc.) means the platform suggests relevant prompts automatically.
- The 60-second score creates an aha-moment before users even enter the onboarding funnel.
- G2 reviewers flag that the interface is "complex" in early weeks — suggests their email sequence likely includes re-engagement and help nudges.

**Observable?** Low. Email body/subject line not captured in any public source. **Recommend founder signs up via the free Seed path to observe email sequence.**

---

## Side-by-Side Summary Table

| Dimension | Peec.ai | Otterly.ai | Gracker.ai |
|---|---|---|---|
| Auth method | Passwordless magic link | Email verification + name | Email/password (assumed) |
| First email timing | Immediate | Immediate | Immediate |
| CEO/founder email? | Yes — personal reply-to | Not documented | Not documented |
| Key onboarding hook | Auto-suggested prompts + booking button | 4-step AI-assisted setup (AI picks prompts) | 60-second free AI score |
| Time to first value | Minutes (in-app) | <1 hour (first report) | 60 seconds (AI score) |
| Trial model | 7 days, no CC | 14 days, no CC | Free Seed plan forever OR 14-day trial, no CC |
| Human touch | CEO email + Slack/WhatsApp + 1:1 bookings | Personal onboarding (Standard+ plans) | Enterprise only: full onboarding package |
| Spam risk flagged? | Yes (magic link hits spam) | Not documented | Not documented |
| Observable without paying? | Partial | Partial | Low |

---

## What We Should Steal — Mapping to NeuralReach Nurture Sequence

| Insight | Source | Concrete change to `email_nurture_sequence.md` |
|---|---|---|
| **CEO personal welcome email** | Peec.ai | Email #1 (immediate): Plain-text, from `jonas@neuralreach.de`, subject: "Welcome to NeuralReach — reply here", 3 sentences max. Invite reply with one question: "What's the #1 brand you want to track?" Signals human behind the tool. |
| **Magic link / spam risk** | Peec.ai | Add a post-signup in-app banner: "If you don't see our email, check spam — it's from jonas@neuralreach.de". Also send a plain-text subject line without spam triggers ("NeuralReach access link"). |
| **4-step AI-assisted prompt selection** | Otterly.ai | Build prompt auto-suggestion into the onboarding form (T-275bfa1c scope). If not built yet: Email #1 CTA should include 3 pre-filled example prompts for the user's category so they can skip blank-page friction. |
| **60-second value moment before paywall** | Gracker.ai | Either: (a) show a partial AI visibility score on the onboarding form before account creation, or (b) Email #1 CTA links directly to a pre-loaded dashboard with the user's brand already searched. Close the activation gap in the first 5 minutes. |
| **Free tier as top-of-funnel** | Gracker.ai | Consider adding a free-forever plan (5 prompts, 1 LLM) to match Gracker's no-CC Seed plan. Email sequence branch: free-tier users get a day-7 upgrade nudge showing what they'd see on 4 LLMs instead of 1. |
| **Re-engagement email at day 7 no-login** | Gracker.ai blog (their own best-practice) | Email #3 (day 7, if no login): "Your first AI visibility report is ready — here's what we found for [brand]." Include a teaser metric. |
| **Completion email after aha moment** | Gracker.ai blog | Email #2 (triggered when user adds first brand): "Your tracking is live. First report in ~1 hour." Sets expectation, prevents churn before first data arrives. |
| **Personal onboarding offer (mid-tier)** | Otterly.ai | Add to Email #1 postscript: "If you'd like a 15-min setup call, grab a slot here: [Calendly]". Keep optional so self-servers aren't slowed down. |
| **Subject line: plain text, personal** | Peec.ai (implied) | Never use "Welcome to NeuralReach!" as subject. Use: "Your NeuralReach access" or "Quick question about [brand]" (personalised with brand name from onboarding form). |
| **Slack/WhatsApp direct access** | Peec.ai | Add in Email #1 footer: "Fastest help: DM me on LinkedIn [link] or reply here." Cheap signal of founder availability that reduces trial-to-churn. |

---

## Recommendation

Peec.ai's CEO personal welcome email is the highest-leverage tactic to copy immediately — it costs zero engineering, sends in <10 minutes of writing, and multiple reviewers cite it as a trust signal. Write it now as a Resend template triggered on `user.signed_up` (part of T-bbf10de1). The email should be 3–5 sentences of plain text, ask one question ("what brand do you want to track?"), and come from `jonas@neuralreach.de`.

The second steal is Otterly's AI-assisted prompt suggestion, which removes the activation blocker. If that's too heavy for the current sprint, pre-fill the onboarding CTA in Email #1 with 3 generic example prompts the user can edit ("What's the best AI visibility tracker?" / "Top tools for B2B SaaS marketing" / "ChatGPT recommendations for [category]").

Gracker's 60-second free score is aspirational for now — it requires live scoring infra — but its mental model (value before commitment) should inform how the dashboard loads for trial users.

**Confidence: Medium.** Peec.ai's CEO email is confirmed by two independent reviewers paraphrasing the same detail. Otterly's 4-step AI-assisted setup is confirmed by its help docs and one review. Gracker's email content is unobservable — all three competitors require a founder signup to capture exact subject lines and body copy.

---

## Appendix: Recommended Founder Actions

1. Sign up for Peec.ai trial (peec.ai) with a fresh email → capture both the magic-link email and CEO Marius email. Screenshot both.
2. Sign up for Otterly free trial (app.otterly.ai/sign-up) → capture verification email + any post-signup emails in the first 48 hours.
3. Sign up for Gracker free Seed plan (gracker.ai) with no CC → capture all emails in first 7 days, especially any re-engagement / "your report is ready" triggers.
4. Forward all captured emails to `jonas@neuralreach.de` archive for reference.
