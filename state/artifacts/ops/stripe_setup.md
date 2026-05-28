# Stripe Setup — NeuralReach
**Date:** 2026-05-27  
**Status:** 🔴 Pending founder action  
**Account:** Test mode (switch to Live before first real customer)

---

## What is already done ✅

The Stripe test account is connected and the core products/prices are already created. The following env vars are populated in `ai-visibility-tracker/.env.local`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_51TYYiCC…` |
| `STRIPE_SECRET_KEY` | `sk_test_51TYYiCC…` |
| `STRIPE_STARTER_PRICE_ID` | `price_1TbiI6CHqSugfd1PD4rMDKZh` |
| `STRIPE_PRO_PRICE_ID` | `price_1TbiIHCHqSugfd1PZCifH3Zr` |

---

## What still needs doing (founder action required)

| # | Step | Urgency |
|---|---|---|
| 1 | Create hosted Payment Links for Starter & Pro | Before pricing page goes live |
| 2 | Enable Stripe Tax (EU + US) | Before first paying customer |
| 3 | Enable Customer Portal | Before first paying customer |
| 4 | Add Webhook endpoint → get `STRIPE_WEBHOOK_SECRET` | Before any Stripe event can reach the app |
| 5 | Activate Live mode (KYC) | Before first real charge |

---

## Step-by-step runbook

### Prerequisites
- Log into: https://dashboard.stripe.com  
- Stay in **Test mode** (toggle top-right) while doing steps 1–4.  
- Switch to **Live mode** for step 5 only.

---

### Step 1 — Verify existing Products & Prices

1. Sidebar → **Product catalog**
2. Confirm you see two products:

| Product name | Price | Billing | Expected Price ID |
|---|---|---|---|
| **Starter** | $39.00 | Monthly recurring | `price_1TbiI6CHqSugfd1PD4rMDKZh` |
| **Pro** | $89.00 | Monthly recurring | `price_1TbiIHCHqSugfd1PZCifH3Zr` |

3. If either is missing, create it:  
   - Click **+ Add product**  
   - Name: `Starter` (or `Pro`)  
   - Pricing model: **Standard pricing** → Recurring → Monthly  
   - Price: `39` USD (or `89`)  
   - Click **Save product**  
   - Copy the new `price_xxx` ID and update `.env.local` accordingly.

---

### Step 2 — Create Hosted Payment Links

Payment Links give you a static URL you can paste anywhere (pricing page, cold emails, LinkedIn DMs).

**Starter link:**
1. Sidebar → **Payment Links** → **+ New**
2. Select product: **Starter** → price `$39.00/month`
3. Under **Options**:
   - ✅ Collect customer email address
   - ✅ Allow promotion codes (optional but recommended)
   - After payment → redirect to: `https://neuralreach.de/dashboard?checkout=success`
4. Click **Create link**
5. Copy the resulting URL (looks like `https://buy.stripe.com/test_XXXXXX`)  
   → Label it: **STARTER_CHECKOUT_LINK**

**Pro link:**
1. Same flow, select **Pro** → `$89.00/month`
2. After payment → redirect to: `https://neuralreach.de/dashboard?checkout=success`
3. Copy URL → Label it: **PRO_CHECKOUT_LINK**

Paste both URLs into `.env.local`:

```
STRIPE_STARTER_CHECKOUT_LINK=https://buy.stripe.com/test_XXXXXX
STRIPE_PRO_CHECKOUT_LINK=https://buy.stripe.com/test_YYYYYY
```

_(Also add these to the pricing page `<a href=...>` buttons as a static fallback while the dynamic checkout API route is finalized.)_

---

### Step 3 — Enable Stripe Tax

1. Sidebar → **Tax** → **Get started** (or **Settings** if already visited)
2. Click **Enable Stripe Tax**
3. Under **Origin address** → enter your business address (NeuralMedic):
   - Country: Germany (or your legal jurisdiction)
   - Address: `[YOUR_BUSINESS_ADDRESS]`
4. Under **Tax registrations** → **+ Add registration**:
   - Add **United States** → select **Automatic** (Stripe handles state nexus)
   - Add **European Union** → select **One-Stop Shop (OSS)** via Germany
5. Click **Save**
6. Back in **Product catalog**, open each product:
   - Starter → Edit → Tax code: `txcd_10103001` (SaaS / software subscription)
   - Pro → same
7. On your Checkout sessions (in `app/api/checkout/route.ts`) — the eng agent will add `automatic_tax: { enabled: true }`. No action needed here.

---

### Step 4 — Enable Customer Portal

The customer portal lets subscribers cancel, upgrade, or update their card without emailing you.

1. Sidebar → **Settings** (gear icon) → **Billing** → **Customer portal**
2. Click **Activate test link** (top right)
3. Configure:
   - ✅ Allow customers to cancel subscriptions  
   - ✅ Allow customers to update payment methods  
   - ✅ Allow customers to view invoices  
   - Subscription cancellation: **At end of billing period**
   - Business name: `NeuralReach`
   - Logo: upload `ai-visibility-tracker/public/logo.png` if available
   - Return URL: `https://neuralreach.de/dashboard`
4. Click **Save**
5. Copy the **Test portal link** (looks like `https://billing.stripe.com/p/login/test_XXXXXX`) — paste it somewhere in your notes. The app will generate per-customer portal sessions via the API.

---

### Step 5 — Add Webhook Endpoint

The app's `/api/stripe-webhook` route needs to receive events when subscriptions are created, updated, or cancelled.

1. Sidebar → **Developers** → **Webhooks** → **+ Add endpoint**
2. **Endpoint URL:**
   - Test (now): `https://neuralreach.de/api/stripe-webhook`
   - _(If Vercel deploy isn't live yet, use a temporary tunnel like `npx stripe listen --forward-to localhost:3000/api/stripe-webhook` for local dev — see below)_
3. **Events to listen for** — select:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. On the endpoint detail page, click **Reveal** under **Signing secret**
6. Copy the `whsec_XXXXXX` value
7. Paste into `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXX
   ```

**Local dev webhook (run this in terminal while developing):**
```bash
npx stripe listen --forward-to localhost:3000/api/stripe-webhook
```
This gives you a temporary local `whsec_` that you can use for local testing.

---

### Step 6 — Activate Live Mode (Do this before first real customer)

This requires Stripe KYC — they'll ask for:
- Legal name & date of birth
- Business address
- Bank account IBAN (for payouts)
- Government ID (passport or ID card)

1. Top-right toggle → switch to **Live mode**
2. Follow the activation wizard at https://dashboard.stripe.com/account/onboarding
3. After activation, **repeat steps 1–5 in Live mode** to get:
   - Live `pk_live_` and `sk_live_` keys
   - Live price IDs (separate from test prices)
   - Live Payment Links
   - Live webhook endpoint + `whsec_` live secret
4. Create a `.env.production` file (or update Vercel env vars) with the live values.

---

## Summary of values to paste into `.env.local` after completing steps above

```bash
# Stripe webhook secret (from Step 5)
STRIPE_WEBHOOK_SECRET=whsec_[PASTE_HERE]

# Hosted Payment Links (from Step 2)
STRIPE_STARTER_CHECKOUT_LINK=https://buy.stripe.com/test_[PASTE_HERE]
STRIPE_PRO_CHECKOUT_LINK=https://buy.stripe.com/test_[PASTE_HERE]
```

---

## Price IDs (already set, do not change unless recreating products)

```
STRIPE_STARTER_PRICE_ID=price_1TbiI6CHqSugfd1PD4rMDKZh   # $39/mo Starter
STRIPE_PRO_PRICE_ID=price_1TbiIHCHqSugfd1PZCifH3Zr       # $89/mo Pro
```

---

## After founder completes these steps

Ping the ops/eng agent with:  
> "Stripe steps 1–5 done. Webhook secret: `whsec_XXX`. Starter link: `https://buy.stripe.com/...`. Pro link: `https://buy.stripe.com/...`."

The eng agent will:
1. Wire the Payment Links into the pricing page buttons
2. Add `automatic_tax: { enabled: true }` to the checkout session
3. Implement the `/api/stripe-webhook` route for subscription lifecycle events
