# NeuralReach — AI Visibility Tracker

Track how your B2B SaaS brand appears in ChatGPT, Claude, Perplexity, and Google AI Overviews.

## Quick start

```bash
# Install dependencies
pnpm install

# Copy env template and fill in values
cp .env.example .env.local

# Run dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the homepage.
Open [http://localhost:3000/leaderboard](http://localhost:3000/leaderboard) to see the static leaderboard.

## Project structure

```
app/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Homepage (marketing)
│   ├── globals.css
│   ├── leaderboard/
│   │   └── page.tsx        # AI Visibility Index leaderboard
│   └── api/
│       ├── checkout/
│       │   └── route.ts    # POST /api/checkout — Stripe checkout session
│       └── waitlist/
│           └── route.ts    # POST /api/waitlist — insert email into Supabase
├── components/
│   ├── WaitlistForm.tsx    # Client component — email capture
│   ├── LeaderboardTable.tsx # Leaderboard display
│   └── PricingCard.tsx     # Pricing plan card
├── data/
│   └── leaderboard-fixture.json  # Static seed data for leaderboard
├── lib/
│   ├── cn.ts               # clsx + tailwind-merge utility
│   ├── stripe.ts           # Stripe server client + plan config
│   └── supabase/
│       ├── client.ts       # Browser Supabase client
│       ├── server.ts       # Server Supabase client (SSR-safe)
│       └── admin.ts        # Service-role admin client
└── supabase/
    └── migrations/
        └── 0001_init.sql   # Waitlist, brands, runs, scores tables
```

## Environment variables

See `.env.example` for all required variables with documentation.

Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (browser-safe)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server only)
- `STRIPE_SECRET_KEY` — Stripe secret key (server only)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (browser-safe)

## Deployment

Deploy to Vercel:
1. Push to GitHub
2. Connect repo in Vercel dashboard
3. Set environment variables from `.env.example`
4. Deploy

## Database

Run the migration against your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or paste supabase/migrations/0001_init.sql into the Supabase SQL editor
```
