-- ============================================================
-- NeuralReach — Bind auth.users.id to customers
-- Migration: 0009_user_id_binding
-- Created: 2026-06-01
--
-- Adds an immutable UUID foreign-key from customers → auth.users so
-- Stripe subscriptions are linked by user identity (not fragile email
-- string-match). Upgrades RLS policies on related tables to use
-- auth.uid() instead of the email-based JWT claim.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add user_id column to customers
-- ────────────────────────────────────────────────────────────
alter table public.customers
  add column if not exists user_id uuid
    references auth.users(id) on delete set null;

-- Unique constraint: allows multiple NULL values (legacy rows),
-- but guarantees no two customers share the same auth identity.
-- PostgreSQL treats NULL != NULL in unique constraints, so this is safe.
create unique index if not exists customers_user_id_unique
  on public.customers (user_id)
  where user_id is not null;

comment on column public.customers.user_id is
  'FK to auth.users.id. Set at checkout (via Stripe client_reference_id). '
  'NULL for legacy rows that pre-date register-first flow; lazy-linked on first dashboard load.';

-- ────────────────────────────────────────────────────────────
-- 2. Update RLS policies to use auth.uid() instead of email
--    (faster, immutable, not spoofable via JWT claim)
-- ────────────────────────────────────────────────────────────

-- tracked_brands
drop policy if exists "tracked_brands_own_select" on public.tracked_brands;
create policy "tracked_brands_own_select" on public.tracked_brands
  for select using (
    customer_id in (
      select id from public.customers
      where user_id = auth.uid()
    )
  );

-- customer_scoring_runs
drop policy if exists "scoring_runs_own_select" on public.customer_scoring_runs;
create policy "scoring_runs_own_select" on public.customer_scoring_runs
  for select using (
    customer_id in (
      select id from public.customers
      where user_id = auth.uid()
    )
  );

-- scoring_jobs
drop policy if exists "scoring_jobs_own_select" on public.scoring_jobs;
create policy "scoring_jobs_own_select" on public.scoring_jobs
  for select using (
    customer_id in (
      select id from public.customers
      where user_id = auth.uid()
    )
  );
