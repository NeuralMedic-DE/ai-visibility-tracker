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

# Or paste the migrations in order into the Supabase SQL editor:
# supabase/migrations/0001_init.sql
# supabase/migrations/0002_customers.sql
# supabase/migrations/0003_tracked_brands.sql
# supabase/migrations/0004_email_tracking.sql   ← adds welcome_email_id
# supabase/migrations/0005_email_log.sql        ← adds email_log table
```

## Transactional email (Resend)

Welcome and weekly digest emails are sent via [Resend](https://resend.com).
Emails are sent **from the `send.neuralreach.de` subdomain** — this isolates
the DKIM/SPF records from the founder's `@neuralreach.de` mailbox, so a
Resend misconfiguration can never hurt deliverability of personal email.

### Setup

1. **Create a Resend account** at [resend.com](https://resend.com) and generate an API key
   with _Sending access_ scoped to `send.neuralreach.de`.
2. **Add the subdomain** `send.neuralreach.de` in the Resend dashboard → **Domains** →
   **Add Domain**. Do NOT add `neuralreach.de` directly.
3. **Copy the DNS records** Resend shows (TXT for DKIM, MX/TXT for SPF, optional DMARC)
   to your registrar / DNS host for `send.neuralreach.de` and click **Verify**.
4. **Set `RESEND_API_KEY`** in Vercel environment variables  
   (Vercel → Project → Settings → Environment Variables → add `RESEND_API_KEY`).  
   Also add it to `.env.local` for local development.

### Local development (dry-run mode)

Set `EMAIL_DRY_RUN=1` in `.env.local` (already the default). Emails are printed
to the console instead of sent — no Resend quota burned during development.

### Smoke-test the integration

Once the `send.neuralreach.de` domain is verified in Resend **and** the
`jonas@neuralreach.de` mailbox is live (MX records active), run:

```bash
npm run test:email
# or directly:
npx tsx scripts/test_resend.ts
```

This sends one test email to `jonas@neuralreach.de` and prints the Resend
message ID. Check the inbox and the [Resend Logs](https://resend.com/emails)
dashboard to confirm delivery.

⚠️  **Do not run** `test:email` before the `jonas@neuralreach.de` mailbox exists —
the send will succeed on Resend's end but bounce at the receiving MTA.

## Scheduling the weekly cron

The weekly scoring + digest email runs at `POST /api/cron/weekly-digest`,
protected by `X-Cron-Secret` header matching the `CRON_SECRET` env var.

### Vercel Cron (recommended)

The `vercel.json` already includes a cron entry at **Monday 09:00 UTC**:

```json
"crons": [
  { "path": "/api/cron/weekly-digest", "schedule": "0 9 * * 1" }
]
```

Vercel Cron calls the endpoint automatically. The call arrives without auth
headers by default — **you must add the `X-Cron-Secret` header via a Vercel
Cron override**, or use a public-facing cron service (below).

#### Option A — External cron service (cron-job.org, EasyCron, GitHub Actions)

This is the easiest approach and works on Vercel Hobby:

```
URL:    https://neuralreach.de/api/cron/weekly-digest
Method: POST
Header: X-Cron-Secret: <your CRON_SECRET value>
Schedule: 0 9 * * 1   (Monday 09:00 UTC)
```

1. Go to [cron-job.org](https://cron-job.org) (free) → **New cron job**.
2. Set the URL, method POST, and add the `X-Cron-Secret` header.
3. Set the cron schedule to `0 9 * * 1`.

#### Option B — GitHub Actions (zero new services)

Add `.github/workflows/weekly-cron.yml`:

```yaml
name: Weekly scoring cron
on:
  schedule:
    - cron: "0 9 * * 1"  # Monday 09:00 UTC
  workflow_dispatch:

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sf -X POST https://neuralreach.de/api/cron/weekly-digest \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```

Store `CRON_SECRET` as a GitHub Actions secret.

### Manual test

```bash
curl -X POST http://localhost:3000/api/cron/weekly-digest \
  -H "X-Cron-Secret: $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

With `EMAIL_DRY_RUN=1` the emails are printed to your terminal — no Resend
calls made.

### Vercel function timeout

The cron route has `maxDuration: 300` in `vercel.json` (requires Vercel Pro).
Each customer scorer run takes up to ~90 s. On the Hobby plan (60 s max), keep
the active customer count to 1-2 per run or move to an async job queue.
