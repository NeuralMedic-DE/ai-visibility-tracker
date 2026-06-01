# Stripe Checkout — End-to-End Test Guide

This document describes how to verify the Stripe integration works in local dev
before pointing real customers at it.

---

## Prerequisites

1. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`,
   `STRIPE_PRO_PRICE_ID` are set in `.env.local`
2. Supabase `customers` table exists (migration `0002_customers.sql` applied)
3. Stripe CLI is installed: `brew install stripe/stripe-cli/stripe`

---

## Step 1 — Start the dev server

```bash
cd ai-visibility-tracker
npm run dev
```

App runs at http://localhost:3000

---

## Step 2 — Forward Stripe webhooks to localhost

In a **second terminal**, run the Stripe CLI listener. This gives you a live
`STRIPE_WEBHOOK_SECRET` for local testing (overrides the one in `.env.local`):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` secret it prints and paste it into `.env.local` as
`STRIPE_WEBHOOK_SECRET`, then restart the dev server.

---

## Step 3 — Trigger a test checkout

1. Go to http://localhost:3000/pricing
2. Click **"Start Starter — $39/mo"** or **"Start Pro — $89/mo"**
3. You'll be redirected to Stripe Checkout (test mode)
4. Use Stripe test card: **4242 4242 4242 4242**, any future expiry, any CVC, any ZIP
5. Complete the checkout

---

## Step 4 — Verify the webhook fires

In the Stripe CLI terminal you should see:

```
--> checkout.session.completed [evt_...]
<-- [200] POST http://localhost:3000/api/stripe/webhook
```

And in the **Next.js dev server** terminal:

```
[webhook] Received event: checkout.session.completed (evt_...)
[webhook] ✅ Customer you@example.com → plan=starter, status=trialing
```

---

## Step 5 — Verify Supabase was updated

Check the `customers` table in the Supabase dashboard:
https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/editor?table=customers

You should see a row with:
- `email` = the email you used at checkout
- `stripe_customer_id` = `cus_...`
- `stripe_subscription_id` = `sub_...`
- `plan` = `starter` (or `pro`)
- `subscription_status` = `trialing`
- `trial_ends_at` = 14 days from now

---

## Step 6 — Verify the success page

After completing the Stripe checkout you'll be redirected to:
```
http://localhost:3000/dashboard?checkout=success&session_id=cs_test_...
```

The page should show a green checkmark and "You're in! 🎉" confirmation.

---

## Additional test scenarios

### Simulate trial → active (charge after 14 days)

```bash
stripe trigger customer.subscription.updated \
  --add subscription:status=active
```

### Simulate cancellation

```bash
stripe trigger customer.subscription.deleted
```

### Simulate trial-ending warning email

```bash
stripe trigger customer.subscription.trial_will_end
```

Check that a "trial ending soon" email lands in your inbox (or EMAIL_DRY_RUN log).

### Simulate successful payment / renewal

```bash
stripe trigger invoice.paid
```

### Use a card that declines

Use card `4000 0000 0000 9995` (insufficient funds) to test the decline flow.

### Test subscription ID fallback (H5 fix)

If `stripe_customer_id` is null in `customers` but `stripe_subscription_id` is
set (e.g. due to a race during checkout), the webhook now falls back to matching
by `stripe_subscription_id`. To verify: temporarily set
`stripe_customer_id = null` for a test row, then trigger
`customer.subscription.updated` — the row should still be updated and a
`[webhook] … trying stripe_subscription_id=…` warning logged.

---

## Webhook events handled

| Event | Effect |
|---|---|
| `checkout.session.completed` | UPSERT customers row with plan + status=trialing/active; send welcome email |
| `customer.subscription.updated` | UPDATE status, current_period_end, plan; fallback match by sub ID if customer ID missing |
| `customer.subscription.deleted` | UPDATE status=canceled; fallback match by sub ID |
| `customer.subscription.trial_will_end` | Send "trial ending soon" email (Stripe fires 3 days before trial end) |
| `invoice.paid` | UPDATE status=active + current_period_end (belt-and-suspenders for renewals) |
| `invoice.payment_failed` | UPDATE status=past_due |

> **Note:** Ensure all six events above are enabled in the Stripe webhook endpoint
> configuration (Dashboard → Developers → Webhooks → select endpoint → Add events).
> The two new events (`customer.subscription.trial_will_end` and `invoice.paid`)
> must be added if the webhook was configured before 2026-06-01.

### Simulate new lifecycle events locally

```bash
# Trial ending soon (fires 3 days before trial_end)
stripe trigger customer.subscription.trial_will_end

# Successful renewal payment
stripe trigger invoice.paid
```
