# NeuralReach — Developer Setup

## Quick Start (2 minutes)

```bash
# 1. Install dependencies
pnpm install

# 2. Start dev server
pnpm dev

# Open http://localhost:3000 — the leaderboard is live!
```

---

## Supabase Schema Setup ⚠️ REQUIRED BEFORE FIRST CUSTOMER

The leaderboard runs from static JSON data so it works without Supabase.
BUT the waitlist form needs the Supabase `waitlist` table to actually save to the database.

### Option A — Supabase Dashboard (1 minute, easiest)

1. Open: https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/sql/new
2. Click **New query**
3. Paste the contents of `supabase/migrations/0001_init.sql`
4. Click **Run** ▶

Done. The waitlist form will now save to Supabase.

### Option B — CLI (requires personal access token)

```bash
# Generate a token at: https://supabase.com/dashboard/account/tokens
supabase login --token sbp_YOUR_TOKEN_HERE
supabase link --project-ref unrfdcxkmelafypuyruk
supabase db push
```

---

## Seed the Brands Table (optional)

After applying the schema, populate the `brands` table from the leaderboard data:

```bash
node scripts/seed-brands.mjs
```

---

## Dev Notes

- **Local waitlist fallback**: While the Supabase schema is not applied, the `/api/waitlist`
  endpoint saves sign-ups to `data/waitlist-local.json`. No leads are lost.
  
- **Leaderboard data**: Loaded from `data/leaderboard_v1.json` at build time (SSG).
  100 brands, all ranked, with per-LLM scores and gap analysis.
  
- **Live scoring** (Week 2): The `scorer/` Python CLI runs real API queries to replace
  the static v1 scores with live data.

---

## Environment Variables

All required env vars are in `.env.local`. For production (Vercel), copy them to
your Vercel project's Environment Variables settings.

| Variable | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Database (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Waitlist API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout |
| `STRIPE_SECRET_KEY` | Checkout API |
| `STRIPE_STARTER_PRICE_ID` | $39/mo plan |
| `STRIPE_PRO_PRICE_ID` | $89/mo plan |

---

## Routes

| Route | Description |
|---|---|
| `/` | Homepage with hero, how-it-works, pricing, waitlist |
| `/leaderboard` | AI Visibility Index — 100 brand leaderboard |
| `POST /api/waitlist` | Save email to Supabase waitlist table |
| `POST /api/checkout` | Create Stripe checkout session |
