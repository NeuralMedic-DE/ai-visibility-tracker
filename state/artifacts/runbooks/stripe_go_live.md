# Runbook: Flip SUBSCRIPTIONS_LIVE=true — Go-Live in Vercel

**Created:** 2026-06-10  
**Author:** ops sub-agent  
**Approvals:**
- `A-8f5c3a1d` (pending) — flip with TEST keys first so M1 acceptance can run
- `A-9b2e4f1d` (approved but not yet actioned) — switch to LIVE Stripe keys after M1 PASS  
**Time estimate:** ~10 minutes  
**Cost:** $0

---

## ⛔ GATE CONDITION — DO NOT PROCEED UNLESS ALL OF THESE ARE TRUE

1. Task `T-add00010` (M1 Acceptance) has run and returned **PASS** (not FAIL)
2. A live Stripe test checkout completed end-to-end (checkout → webhook 200 → customers row → /dashboard shows subscription)
3. Email delivery confirmed working (Resend `mail.neuralreach.de` verified, test send succeeded)
4. Production Supabase schema is current (migrations 0001–0013 applied, verified via `stripe_events` table returning `[]` not PGRST205)

Current status as of 2026-06-10: **NOT READY — M1 blockers remain**

---

## Why SUBSCRIPTIONS_LIVE

`SUBSCRIPTIONS_LIVE=true` is a server-side environment variable read at render time by:
- `app/pricing/page.tsx` — shows Stripe Checkout buttons instead of "Notify me" waitlist
- `app/api/checkout/route.ts` — gates the checkout API against direct-POST bypass (added 2026-06-10)

When set to `false` (current prod state), both layers block subscriptions. Setting it to `true` enables real payments immediately on the next Vercel deployment.

---

## Live Stripe Keys (already in Vercel — do NOT re-enter unless missing)

These were provided via approval A-2c8e4f1b and should already be in Vercel Production env vars:

| Variable | Starts with |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_51TYYiC...` |
| `STRIPE_SECRET_KEY` | `sk_live_51TYYiC...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_qJ4Syvu4...` |
| `STRIPE_STARTER_PRICE_ID` | `price_1Tdaq2C...` |
| `STRIPE_PRO_PRICE_ID` | `price_1Tdar7C...` |

> **IMPORTANT:** These are LIVE keys — real money will be charged after flipping the flag.

---

## Step-by-Step

### Step 1 — Verify live Stripe webhook exists (2 min)

1. Go to [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Confirm you are in **Live mode** (toggle top-left — should NOT show "TEST MODE" banner)
3. Verify there is a webhook endpoint pointing to: `https://neuralreach.de/api/stripe/webhook`
4. If missing, create it:
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
   - Copy the signing secret (`whsec_...`) and update `STRIPE_WEBHOOK_SECRET` in Vercel

### Step 2 — Configure Customer Portal in Live mode (2 min)

1. Go to [https://dashboard.stripe.com/settings/billing/portal](https://dashboard.stripe.com/settings/billing/portal)
2. Confirm Live mode is active
3. Enable: Cancel subscriptions ✅ | Update payment method ✅ | View invoices ✅
4. Cancellation: **At end of billing period**
5. Return URL: `https://neuralreach.de/dashboard`
6. Business name: `NeuralReach`
7. Save

### Step 3 — Flip SUBSCRIPTIONS_LIVE in Vercel (2 min)

1. Go to [https://vercel.com](https://vercel.com) → `ai-visibility-tracker` → **Settings** → **Environment Variables**
2. Find `SUBSCRIPTIONS_LIVE` (currently `false`)
   - If it exists: click Edit → change value to `true` → scope to **Production** → Save
   - If missing: Add Variable → name `SUBSCRIPTIONS_LIVE`, value `true`, scope **Production only** → Save
3. Do NOT change Preview or Development scopes (keep staging isolated)

### Step 4 — Redeploy Vercel (1 min)

1. Click **Deployments** tab
2. Find the latest Production deployment (green dot)
3. Click ⋯ → **Redeploy** → uncheck "Use existing Build Cache" → **Redeploy**
4. Wait ~90 seconds for green checkmark ✅

### Step 5 — Smoke test (3 min)

1. Open [https://www.neuralreach.de/pricing](https://www.neuralreach.de/pricing) in an **incognito window**
2. **Expected:** "Get started" / "Start Starter for $39/mo" buttons visible (NOT "Notify me when subscriptions open")
3. Click "Start Starter for $39/mo" → should redirect to Stripe Checkout
4. **Confirm:** Stripe Checkout page shows **no "TEST MODE" badge** (live mode)
5. DO NOT complete a real payment unless you intend to be billed

---

## Rollback

If anything goes wrong after flipping:

1. Vercel → ai-visibility-tracker → Settings → Environment Variables
2. Set `SUBSCRIPTIONS_LIVE` back to `false`
3. Redeploy (same process as Step 4)
4. Site reverts to waitlist mode within ~2 minutes
5. Refund any accidental live charges at [https://dashboard.stripe.com/payments](https://dashboard.stripe.com/payments)

---

## Post-flip checklist

- [ ] `SUBSCRIPTIONS_LIVE=true` set and saved in Vercel Production
- [ ] Vercel redeploy succeeded (green checkmark)
- [ ] `/pricing` shows Stripe buttons (not "Notify me")
- [ ] Stripe Checkout page loads in Live mode (no TEST MODE badge)
- [ ] Live webhook endpoint confirmed in Stripe Live mode
- [ ] Customer Portal configured in Live mode
