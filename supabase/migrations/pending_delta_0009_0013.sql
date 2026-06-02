-- ============================================================
-- NeuralReach — PENDING DELTA: migrations 0009 through 0013
-- ============================================================
-- PURPOSE: Apply only the migrations that are MISSING from production.
--          Migrations 0001–0008 are confirmed applied.
--          This file applies 0009–0013 in order, fully idempotent.
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/sql/new
--   2. Paste the entire contents of this file.
--   3. Click "Run". Expected result: no errors, last SELECT lists all tables.
--
-- VERIFY AFTER:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--   -- Must include: stripe_events
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'customers'
--   ORDER BY ordinal_position;
--   -- Must include: user_id (from 0009), prompt_count / estimated_cost_usd on customer_scoring_runs (from 0012)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0009: user_id binding — customers → auth.users
-- ────────────────────────────────────────────────────────────
-- Add immutable UUID FK so Stripe subscriptions are linked by
-- auth identity (not fragile email). Partial unique index allows
-- multiple NULLs (legacy rows), enforces uniqueness otherwise.
-- RLS policies updated to use auth.uid() for performance + correctness.

alter table public.customers
  add column if not exists user_id uuid
    references auth.users(id) on delete set null;

create unique index if not exists customers_user_id_unique
  on public.customers (user_id)
  where user_id is not null;

comment on column public.customers.user_id is
  'FK to auth.users.id. Set at checkout via Stripe client_reference_id. '
  'NULL for legacy rows; lazy-linked on first dashboard load.';

-- Update RLS policies to use auth.uid() (immutable, fast, not spoofable)
drop policy if exists "tracked_brands_own_select" on public.tracked_brands;
do $$ begin
  create policy "tracked_brands_own_select" on public.tracked_brands
    for select using (
      customer_id in (
        select id from public.customers
        where user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

drop policy if exists "scoring_runs_own_select" on public.customer_scoring_runs;
do $$ begin
  create policy "scoring_runs_own_select" on public.customer_scoring_runs
    for select using (
      customer_id in (
        select id from public.customers
        where user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

drop policy if exists "scoring_jobs_own_select" on public.scoring_jobs;
do $$ begin
  create policy "scoring_jobs_own_select" on public.scoring_jobs
    for select using (
      customer_id in (
        select id from public.customers
        where user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────
-- 0010: Enforce lowercase emails at DB level (H4 hardening)
-- ────────────────────────────────────────────────────────────
-- Belt-and-suspenders guard: prevents a future code regression
-- from silently storing a mixed-case email address.

-- Back-fill any pre-existing mixed-case rows (should be zero in prod)
update public.customers
   set email = lower(trim(email))
 where email <> lower(trim(email));

-- Idempotent: only add the constraint if it doesn't already exist
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname  = 'customers_email_lowercase'
       and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_email_lowercase
      check (email = lower(trim(email)));
  end if;
end
$$;

comment on constraint customers_email_lowercase on public.customers is
  'Enforces that emails are stored lower(trim()) — matches app-level normalisation. '
  'Prevents silent mis-match between login (lowercased) and webhook (raw Stripe email).';

-- ────────────────────────────────────────────────────────────
-- 0011: stripe_events — webhook idempotency  *** CRITICAL ***
-- ────────────────────────────────────────────────────────────
-- Without this table every checkout.session.completed event returns
-- HTTP 500 (INSERT fails on missing table) → Stripe retries forever
-- → NO customer can ever successfully subscribe.

create table if not exists public.stripe_events (
  event_id      text        primary key,           -- evt_xxx
  event_type    text        not null,
  processed_at  timestamptz not null default now()
);

comment on table public.stripe_events is
  'Processed Stripe event IDs used for webhook idempotency. '
  'Webhook inserts here atomically; a duplicate-key error (23505) '
  'means the event was already handled — the handler no-ops and acks.';

comment on column public.stripe_events.event_id is
  'Stripe event object id (evt_xxx). Globally unique per Stripe event.';
comment on column public.stripe_events.event_type is
  'Stripe event type string, e.g. checkout.session.completed.';
comment on column public.stripe_events.processed_at is
  'Wall-clock UTC time the event was first successfully processed.';

-- Index for admin queries (show all events of a given type)
create index if not exists stripe_events_type_processed
  on public.stripe_events (event_type, processed_at desc);

-- RLS: service-role only — the webhook runs with the service key
alter table public.stripe_events enable row level security;

do $$
begin
  create policy "stripe_events_service_only" on public.stripe_events
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end
$$;

-- ────────────────────────────────────────────────────────────
-- 0012: Quota controls & cost tracking
-- ────────────────────────────────────────────────────────────
-- 1. Prevent concurrent active jobs per customer (race-condition fix)
create unique index if not exists scoring_jobs_one_active_per_customer
  on public.scoring_jobs (customer_id)
  where status in ('pending', 'running');

comment on index public.scoring_jobs_one_active_per_customer is
  'Prevents concurrent scorer processes for the same customer. '
  'A second INSERT while status=pending|running yields PG 23505, '
  'caught by the API route and returned as HTTP 429.';

-- 2. prompt_count — how many prompts the scorer ran this cycle
alter table public.customer_scoring_runs
  add column if not exists prompt_count integer;

comment on column public.customer_scoring_runs.prompt_count is
  'Total prompts scored across all LLMs for this run (25 for Starter, 100 for Pro).';

-- 3. estimated_cost_usd — actual API spend for this run
alter table public.customer_scoring_runs
  add column if not exists estimated_cost_usd numeric(8, 4);

comment on column public.customer_scoring_runs.estimated_cost_usd is
  'Actual API cost in USD (from cost_tracker). Used by the global daily spend circuit-breaker.';

-- 4. Index for daily spend aggregation
create index if not exists scoring_runs_run_date_cost
  on public.customer_scoring_runs (run_date, estimated_cost_usd)
  where estimated_cost_usd is not null;

comment on index public.scoring_runs_run_date_cost is
  'Supports daily spend aggregation for the global cost circuit-breaker.';

-- ────────────────────────────────────────────────────────────
-- 0013: subscription_status CHECK constraint
-- ────────────────────────────────────────────────────────────
-- Restrict subscription_status to our sentinel ('none') and all
-- known Stripe subscription statuses as of API version 2025-02-24.

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname  = 'customers_subscription_status_check'
       and conrelid = 'public.customers'::regclass
  ) then
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
  end if;
end
$$;

comment on column public.customers.subscription_status is
  'Stripe subscription status. Allowed values: none | trialing | active | '
  'past_due | canceled | incomplete | incomplete_expired | unpaid | paused. '
  'Constrained by customers_subscription_status_check.';

-- ────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES — run these to confirm success
-- ────────────────────────────────────────────────────────────

-- Should include: stripe_events in the list
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- stripe_events table should exist and be accessible
select count(*) from public.stripe_events;

-- customers columns should include user_id, prompt_count (on scoring runs)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'customers'
order by ordinal_position;
