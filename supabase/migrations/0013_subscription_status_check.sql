-- ============================================================
-- NeuralReach — subscription_status CHECK constraint
-- Migration: 0013_subscription_status_check
-- Created: 2026-06-01
-- Resolves: audit finding M3
-- ============================================================

-- Add a CHECK constraint that restricts customers.subscription_status
-- to the union of:
--   • our own sentinel: 'none'
--   • all known Stripe subscription statuses as of API version 2025-02-24:
--       trialing, active, past_due, canceled, incomplete,
--       incomplete_expired, unpaid, paused
--
-- Stripe occasionally adds new statuses in minor API versions.
-- If a webhook tries to write an unrecognised value the insert/update
-- will fail with a constraint violation (logged to Sentry via B3 fix).
-- Add the new value here + to STATUS_CONFIG (dashboard/page.tsx) before
-- deploying any API version bump.

alter table public.customers
  add constraint customers_subscription_status_check
  check (
    subscription_status in (
      'none',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )
  );

comment on column public.customers.subscription_status is
  'Stripe subscription status. Allowed values: none | trialing | active | '
  'past_due | canceled | incomplete | incomplete_expired | unpaid | paused. '
  'Constrained by customers_subscription_status_check.';
