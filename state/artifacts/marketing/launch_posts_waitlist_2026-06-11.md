# Launch Posts — Waitlist-Driving Wave
# Drafted: 2026-06-11
# Supersedes: launch_posts_waitlist_2026-06-10.md (corrections noted below)

## Corrections vs 2026-06-10 version
- FIXED: r/SideProject body previously claimed "a few scrappy startups scored over 70" —
  contradicts the verified dataset cap of 54.8 (nobody breaks 60). Removed that claim.
- UPDATED: IH post is now Day 15, not Day 14 (launched 2026-05-27; today = 2026-06-11 = Day 15).
- CTA URL: updated to https://neuralreach.de/waitlist per task instruction.
  NOTE: As of 2026-06-10 this path returned 404; if not yet redirected, use /#waitlist instead.
  Engineer follow-up: add /waitlist → /#waitlist redirect so this URL is stable for all future posts.
- Posting window recommendations updated for the week of June 11–14.

## Data used (all sourced from data/leaderboard.json, run_date 2026-05-30)
- #1  Vercel — 54.8/100
- #2  Prefect — 46.8/100
- #3  Mixpanel — 46.0/100
- #3  Retool — 46.0/100
- #5  Gainsight — 45.9/100
- Last place (#100) Anecdotes — 15.1/100 (per company brief: 39.7-pt spread)
- Nobody in the 100-brand set breaks 60
- Perplexity and ChatGPT diverge on ~40% of brand-level recommendations
- FAQ/schema structure correlates more strongly with AI visibility score than backlink count

## CTA rules
- All CTAs: https://neuralreach.de/waitlist
- Fallback if 404: https://neuralreach.de/#waitlist
- No "subscribe now" or "buy" language
- Frame: early access, subscriptions open Wednesday June 17

---

# POST 1 — r/SEO

**Subreddit:** r/SEO
**Title:** I scored 100 B2B SaaS brands on AI search visibility (ChatGPT, Perplexity, Claude, Google AIO) — here's what the data shows
**Tone:** Value-first, technical, educational. No overt pitch.
**Best posting window:** Today (Wed June 11) or Thu June 12, 9–11 AM EST

---

**Body:**

I spent the last few weeks building a scoring system to answer a question I couldn't find good data on: which B2B SaaS brands actually get cited when buyers ask AI models a buying-intent question?

The result is a free public leaderboard covering 100 brands across four platforms: ChatGPT, Perplexity, Claude, and Google AI Overviews.

**Methodology (short version):**
For each brand, we ran 25 category-level and job-to-be-done prompts — things like "best CRM for remote sales teams" or "top project management tools for agencies." We recorded whether the brand was mentioned, in what position, in what framing, and against which competitors. Score 0–100 based on citation frequency, context quality, and competitive share-of-voice.

**What stood out:**

- FAQ pages and structured schema (FAQPage, HowTo) correlated more strongly with AI visibility than backlink count or domain authority. Several brands with massive link profiles scored below 30.
- Perplexity and ChatGPT disagree on roughly 40% of brand-level recommendations. Being strong on one does not guarantee the other.
- Nobody in the dataset breaks 60. The #1 brand (Vercel, 54.8) is still absent from almost half the prompts in its category.
- Several well-funded brands scored under 20. Brand awareness and AI visibility are measuring different things.

Full leaderboard: https://neuralreach.de/leaderboard — free, no login. Each brand page lists the specific prompts it misses and which competitors are filling those slots.

If you want your own brand tracked weekly with automated re-scores and gap recommendations, we're collecting early-access signups now — subscriptions open Wednesday, June 17. Waitlist: https://neuralreach.de/waitlist

Happy to answer questions about the methodology or post the raw prompt set if there's interest.

---

**Pre-written FAQ replies:**

**Q: What prompts did you actually use? Feels like it could be gamed.**
> Prompt selection is genuinely the hardest part of this. We used category-level and job-to-be-done prompts — not branded queries — so "best [category] for [use case]" rather than "[brand name] reviews." Full prompt set is linked in the methodology section of the leaderboard. You're right that brands could optimize for specific prompts, but doing so means improving FAQ depth, schema markup, and third-party citation patterns — which are the behaviors that improve AI visibility broadly, not just against our prompts. The hard-to-game nature is part of what makes the signal interesting.

**Q: How is this different from brand monitoring tools (Mention, Brand24, etc.)?**
> Brand monitors tell you whether you're mentioned on the web. This measures whether AI models cite you when a buyer asks a purchasing question. The difference is context: a mention in a negative Reddit thread doesn't help you, but being cited first in "what's the best [X] for [Y]" does. We're tracking citation position, competitive share-of-voice, and framing quality — not raw mention count.

**Q: Will this stay updated, or is it a one-time snapshot?**
> Monthly re-runs once the paid tracker goes live (June 17). AI model behavior drifts — retrieval patterns that work today can change in 60 days. We'll publish diffs so the leaderboard is a trend signal, not just a frozen snapshot.

---

# POST 2 — r/SaaS

**Subreddit:** r/SaaS
**Title:** AI search is part of the B2B buying journey now. I checked how 100 SaaS brands stack up — category leaders don't always win.
**Tone:** Founder/operator audience. Business problem first. Data-backed.
**Best posting window:** Thu June 12 or Mon June 15, 10 AM–12 PM EST

---

**Body:**

More and more B2B buyers open ChatGPT or Perplexity before they Google. They ask something like "what's the best [category] tool for [their situation]" and go with what gets named.

I wanted to understand who's winning that moment — and whether it has anything to do with traditional SEO strength.

So I ran 25 buying-intent prompts across ChatGPT, Perplexity, Claude, and Google AI Overviews for 100 named B2B SaaS companies — CRM, analytics, HR, dev tools, finance, project management — and scored each one on citation frequency, competitive share-of-voice, and context quality.

The leaderboard is at https://neuralreach.de/leaderboard (free, no login).

**A few findings worth sharing:**

- Traditional SEO strength is a weak predictor. Several brands with strong backlink profiles and high Google rankings scored below 30 because their content isn't structured for AI extraction.
- FAQ pages and schema markup had a stronger positive correlation with AI visibility than domain authority metrics.
- Perplexity and ChatGPT disagree on which brand to recommend in roughly 40% of category-level queries. Optimizing for one doesn't carry over to the other.
- The highest score in the dataset is 54.8/100 (Vercel). Nobody breaks 60. The bottom of the table is 15.1 (Anecdotes). That's a 39-point spread in the same market — and the gap mostly comes down to content structure, not budget.

If your brand is in the list and scored lower than you expected: each brand page shows the exact prompts it's missing and who's getting cited instead. That's the actionable part.

Building a paid weekly tracker on top of this — automated re-scores, competitor monitoring, specific fix recommendations. Subscriptions open June 17. Early-access waitlist: https://neuralreach.de/waitlist

---

**Pre-written FAQ replies:**

**Q: Is this just a funnel for your product?**
> The leaderboard is genuinely free — no paywall, no login. View any of the 100 brand pages and you'll see the full data. The paid product does weekly re-scores and competitor tracking; subscriptions open June 17. Waitlist at https://neuralreach.de/waitlist if you want early-bird pricing. The index is a public resource regardless.

**Q: How do you define AI visibility? Isn't it just brand awareness?**
> A brand can have massive awareness and still get skipped by AI models — it depends on whether the content is structured so the model can extract and cite it. We're measuring whether AI models recommend you in buying-intent contexts, not whether people have heard of you. A well-structured smaller brand can score higher than a household name on this metric.

**Q: Our brand isn't in the list — how do we get added?**
> Drop the company name and category in the comments. I'm adding a second batch in the next update and will prioritize requests from this thread.

---

# POST 3 — r/SideProject

**Subreddit:** r/SideProject
**Title:** Built NeuralReach: free AI Visibility Index for 100 B2B SaaS brands. Paid tracker soft-launching June 17.
**Tone:** Personal, brief, honest. "I built X" format. Invite feedback.
**Best posting window:** Sat June 14 or Sun June 15, 10 AM–1 PM EST

---

**Body:**

I built this because I kept asking: when someone types "what's the best project management tool for agencies" into ChatGPT, who actually gets named? And does it correlate with anything a founder can fix?

What I shipped: the AI Visibility Index — a free public leaderboard scoring 100 B2B SaaS brands on how well they appear across ChatGPT, Perplexity, Claude, and Google AI Overviews.

**How scoring works:**
- 25 buying-intent prompts per brand category
- Run across all 4 platforms
- Scored on: citation frequency, position, competitive share-of-voice, answer framing
- Final score 0–100

**Current top 5:**
1. Vercel — 54.8/100
2. Prefect — 46.8/100
3. Mixpanel — 46.0/100
3. Retool — 46.0/100
5. Gainsight — 45.9/100

Nobody breaks 60. The lowest score in the dataset is 15.1. I expected dominant brands to be untouchable — they're not. That's interesting.

**What I learned building this:**
- FAQ page structure and schema markup matter more than backlink count for AI citation frequency.
- ChatGPT and Perplexity disagree on brand recommendations in roughly 40% of queries. They're not the same audience.
- Well-funded, well-known brands score below 20 if their content isn't structured for AI extraction.

**Stack:** Next.js + Supabase + Vercel. Scoring engine uses OpenAI, Anthropic, and Perplexity APIs. Data last updated May 30.

Leaderboard: https://neuralreach.de/leaderboard — completely free, no signup required.

Building a paid version (NeuralReach) for weekly re-scores + competitor tracking. Subscriptions open Wednesday, June 17. Waitlist if you want early-bird pricing: https://neuralreach.de/waitlist

Would love feedback on the scoring methodology or anything about the build. Ask away.

---

**Pre-written FAQ replies:**

**Q: How long did this take to build?**
> Scoring engine + data collection: about a week of evenings. Leaderboard UI: maybe 3 days. The hardest part was designing prompts that were fair across different verticals and couldn't be trivially gamed. Still iterating on that. The Next.js + Supabase stack made the frontend fast; the interesting complexity is all in the prompt design and scoring logic.

**Q: Are you planning to monetize it?**
> Yes — the leaderboard stays free permanently. NeuralReach (the paid product) does weekly automated re-scores, competitor tracking, and specific recommendations on what to fix. $39/mo Starter, $89/mo Pro. Subscriptions open June 17. Early-bird waitlist: https://neuralreach.de/waitlist

**Q: How often will you update the leaderboard scores?**
> Monthly re-runs are the plan once the paid tracker is live. AI model retrieval behavior drifts — what works today may not in 60 days. I'll publish score diffs each cycle so it's useful as a trend signal, not just a static ranking.

---

# POST 4 — Indie Hackers

**Platform:** Indie Hackers (Products section or standalone post)
**Title:** Day 15: Free AI leaderboard is live, paid subscriptions open June 17 — what's working, what broke, and what I'm watching
**Tone:** Build-in-public. Specific. Honest about setbacks. Invites discussion.
**Best posting window:** Wed June 11 or Thu June 12, 9–11 AM EST (pair with r/SEO day)

---

**Body:**

Fifteen days ago I shipped the first version of NeuralReach: an AI search visibility tracker for B2B SaaS founders. The pitch: your customers ask ChatGPT or Perplexity "what tool should I use" before they visit your website. Most founders have no data on whether their brand shows up in those answers.

Here's an honest Day 15 update.

---

**What's live and working**

**Free public leaderboard — https://neuralreach.de/leaderboard**

100 B2B SaaS brands scored across ChatGPT, Perplexity, Claude, and Google AI Overviews. 25 buying-intent prompts per category. Individual brand detail pages show exactly which prompts each brand misses and which competitors get cited in their place.

Current top 5:
- Vercel — 54.8/100
- Prefect — 46.8/100
- Mixpanel — 46.0/100
- Retool — 46.0/100
- Gainsight — 45.9/100

Nobody breaks 60. The lowest score in the dataset is 15.1 (Anecdotes). 39-point spread between first and last place.

I expected the dominant brands to be untouchable. They're not. That's either a flaw in my methodology or a genuinely wide-open market. I'm testing for the latter.

---

**What I planned vs. what happened**

Original target: subscriptions open June 4. Actual target: June 17. Two-week slip, two concrete causes.

**1. Email was silently failing in production.**
The Resend DKIM records were never added to DNS. Every OTP login code was going into a void — no error surfaced, users just never received the email. Took most of last week to diagnose through log spelunking. The DKIM record is now queued; not yet confirmed live as of this writing.

**2. Stripe checkout was redirecting to localhost.**
Post-payment, the success URL pointed to `http://localhost:3000/dashboard?checkout=success` instead of the live domain. A customer who paid on day one would have landed on a broken page. Found it only when I ran the checkout flow manually against production.

Neither of these is technically hard. Both would have been terrible for a first customer. Pushing a week to fix them properly was the right call.

---

**What happens this week (June 11–17)**

The production bugs are being fixed in parallel. My job this week is distribution: get these posts in front of founders who might care about AI visibility, collect waitlist signups, and learn whether the concept registers as urgent or just "interesting."

Waitlist is at https://neuralreach.de/waitlist. First members get early-bird pricing when subscriptions open.

---

**What I'm measuring**

1. **Waitlist signups from this post wave.** This is the primary demand signal. If the leaderboard is genuinely useful, people will want their brand tracked automatically.
2. **Inbound questions from low-ranked founders.** The most useful signal is someone saying "why did we score 18?" — that's the conversation the paid product is built to have.
3. **Whether "AI visibility" feels urgent or abstract.** Competitive framing (your competitor ranks 30 points above you) lands harder than the general concept. I'm watching whether that's the version that generates action.

---

**Pivot trigger still live**

If the leaderboard doesn't generate meaningful waitlist signal before June 17, I'll re-evaluate the distribution strategy. The category clearly exists — Peec.ai ($4M ARR in 10 months), Otterly ($29/mo), Gracker ($39/mo) all have paying customers. The question is whether the free leaderboard is the right conversion mechanism for me, or whether I'm better off with direct cold outbound using the scores as the opener.

Pricing when subscriptions open: $39/mo Starter (25 prompts, 4 platforms), $89/mo Pro (100 prompts + competitor tracking).

Day 21 update will have actual waitlist numbers and the first week of subscription data.

---

**Pre-written FAQ/comment replies:**

**Q: Why the free leaderboard first? Why not just launch paid?**
> Two reasons. First, cold outreach pitching "pay $39/mo to track your AI visibility" is abstract. Cold outreach saying "your brand scored 18/100 on the AI Visibility Index — here's what your top competitor is doing differently" is specific. The leaderboard creates the conversation opener. Second, I didn't know yet whether enough founders feel urgency about this. Two weeks of leaderboard traffic tells me that faster than two months of product iteration.

**Q: What's your biggest worry?**
> That "AI visibility" is still too abstract for most founders to feel pain about today. The mitigation is competitive framing — it's much easier to care when you see a named competitor outranking you by 25 points. Every brand detail page puts your direct competitors right next to you, which is the real hook. The question is whether founders scroll to their brand page or stop at the top 10.

**Q: How are you handling prompt gaming? Won't brands just optimize for your specific prompts?**
> Yes, and that's fine. Optimizing for our prompts means improving FAQ structure, schema markup, and third-party citation density — which are the exact behaviors that improve AI visibility broadly. The prompts are public intentionally. If brands start gaming specific prompts, I update the prompt set. It's a moving target by design, which is also why a recurring subscription makes more sense than a one-time audit.

---

# POSTING SCHEDULE (week of June 11)

| Day | Platform | Best window (EST) |
|-----|----------|-------------------|
| Wed June 11 | r/SEO | 9–11 AM |
| Wed June 11 | Indie Hackers | 9–11 AM (same day, different platform) |
| Thu June 12 | r/SaaS | 10 AM–12 PM |
| Sat June 14 | r/SideProject | 10 AM–1 PM |

**Before posting each:**
- Log in as Jonas's personal account (not a brand account) on Reddit and Indie Hackers.
- Do NOT post all four on the same day.
- Reply to the top 2–3 comments within the first 2 hours — this boosts algorithmic ranking on Reddit.
- Do NOT edit posts after publication to add subscription links. Keep the waitlist CTA as-is until June 17.

**Account checklist:**
- Reddit: Jonas's personal account
- Indie Hackers: Jonas's personal account
- No budget required for any of these posts
