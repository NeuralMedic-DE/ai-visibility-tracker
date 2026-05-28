# Launch Post — r/SideProject

**Subreddit:** r/SideProject
**Tone rules:** "I built X" showcase format. Personal, honest, show the product. Community celebrates finished things and ships. Mention tech stack. Invite feedback. Light CTA to try it is totally fine.
**Suggested posting time:** Saturday or Sunday, 10 AM–1 PM EST (weekend browsing peak for side project community)

---

## Headline

I built a free leaderboard showing how 100 SaaS companies rank in AI search (ChatGPT, Perplexity, Claude, Google AIO) — NeuralReach AI Visibility Index

---

## Body

I built this because I kept wondering: when someone asks ChatGPT "what's the best project management tool for agencies," who actually gets named? And is that correlated with anything fixable?

The result is the AI Visibility Index — a free public leaderboard scoring 100 B2B SaaS brands on how well they appear in AI-generated answers across ChatGPT, Perplexity, Claude, and Google AI Overviews.

**How it works:**
- 25 buying-intent prompts per brand category
- Run across all 4 platforms
- Scored on: citation frequency, position, competitive share-of-voice, and answer context
- Final score 0–100

**What I found interesting:**
- Domain authority is a weak predictor. Schema + FAQ structure is a much stronger one.
- Perplexity and ChatGPT disagree on ~40% of brand recommendations.
- Some well-known names scored under 20. A few scrappy startups scored over 70.

**Stack:** Next.js + Supabase + Vercel. Scoring engine runs on OpenAI + Anthropic + Perplexity APIs. First version computed offline; live re-scoring loop coming next week.

The leaderboard is live at [URL] — completely free, no signup.

Happy to answer questions about the build or methodology. Feedback welcome, especially on the scoring rubric.

---

## FAQ Prep

**Q1: How long did this take to build?**
> The scoring engine and data collection took about a week of nights and weekends. The leaderboard UI was faster — maybe 3 days. The hardest part was designing prompts that were fair across categories and couldn't be easily gamed. Still iterating on that.

**Q2: Are you planning to monetize this?**
> Yes — the leaderboard is permanently free, but I'm building a paid product (NeuralReach) on top of the same engine for founders who want to track their own brand weekly, monitor competitors, and get specific fix recommendations. Waitlist is on the page if you're interested. No pressure though.

**Q3: How often will you update the scores?**
> Monthly re-runs are the plan. AI model behavior drifts, so a snapshot from today may not be accurate in 60 days. I'll publish before/after diffs each update so it's actually useful as a trend signal, not just a leaderboard.
