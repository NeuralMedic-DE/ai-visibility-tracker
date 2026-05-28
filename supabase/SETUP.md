# Supabase Setup — NeuralReach
**Status:** ⚠️ Schema not yet applied  
**Action needed:** Run the SQL below in the Supabase Dashboard SQL editor

---

## Step 1 — Apply the base schema (1 minute)

1. Go to: https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/sql/new  
2. Paste the entire contents of `supabase/migrations/0001_init.sql`
3. Click **Run** (▶)
4. You should see: `Success. No rows returned.`

That creates four tables: `waitlist`, `brands`, `runs`, `scores`.

## Step 1b — Apply the customers/subscriptions schema

1. In a new SQL editor tab, paste the contents of `supabase/migrations/0002_customers.sql`
2. Click **Run** (▶)
3. You should see: `Success. No rows returned.`

That creates the `customers` table (written by the Stripe webhook on checkout).  
Verify at: https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/editor?table=customers

---

## Step 2 — Seed the 100 brands (optional but recommended)

After the schema is applied, run the seed script to populate the `brands` table
from the leaderboard data:

```bash
cd ai-visibility-tracker
node scripts/seed-brands.mjs
```

This inserts all 100 B2B SaaS brands from `data/leaderboard_v1.json` into the
`brands` table so the app can reference them later.

---

## Step 3 — Verify everything works

```bash
# From the project root:
pnpm dev
```

Then open http://localhost:3000 and submit the waitlist form.
You should see the entry appear at:  
https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/editor?table=waitlist

---

## Alternative: CLI push (requires Supabase personal access token)

If you prefer the CLI approach:

```bash
# 1. Get a personal access token from:
#    https://supabase.com/dashboard/account/tokens
# 2. Login:
supabase login --token sbp_YOUR_TOKEN_HERE
# 3. Link project:
supabase link --project-ref unrfdcxkmelafypuyruk
# 4. Push migrations:
supabase db push
```

---

## What the schema creates

| Table | Purpose | RLS |
|---|---|---|
| `waitlist` | Email captures from landing page | Service role only |
| `brands` | 100-brand index + customer brands | Public read |
| `runs` | Per-brand weekly scoring runs | Service role only |
| `scores` | Per-LLM visibility scores | Public read |
| `customers` | Paying/trialing Stripe subscribers | Service role only |
