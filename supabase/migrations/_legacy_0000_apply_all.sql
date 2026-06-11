-- ============================================================
-- NeuralReach — CONSOLIDATED MIGRATION (apply ALL at once)
-- Run this in Supabase Dashboard → SQL Editor if starting fresh.
-- Combines migrations 0001 through 0013 in order.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- Enable UUID extension (needed by all tables)
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 0001: Base tables (waitlist, brands, runs, scores)
-- ────────────────────────────────────────────────────────────

create table if not exists public.waitlist (
  id           uuid primary key default uuid_generate_v4(),
  email        text not null unique,
  brand_interest text,
  signed_up_at timestamptz not null default now(),
  converted_at timestamptz,
  notes        text
);

comment on table public.waitlist is 'Early-access sign-ups from landing page and leaderboard CTAs.';

create table if not exists public.brands (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  name        text not null,
  website     text,
  category    text,
  description text,
  logo_url    text,
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.brands is 'B2B SaaS brands tracked in the AI Visibility Index and by paying customers.';

create table if not exists public.runs (
  id          uuid primary key default uuid_generate_v4(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'pending'
                check (status in ('pending', 'running', 'complete', 'failed')),
  error_msg   text,
  prompt_count int,
  created_at  timestamptz not null default now()
);

comment on table public.runs is 'Scoring runs — one row per brand per weekly (or manual) trigger.';

create table if not exists public.scores (
  id           uuid primary key default uuid_generate_v4(),
  run_id       uuid not null references public.runs(id) on delete cascade,
  brand_id     uuid not null references public.brands(id) on delete cascade,
  llm          text not null
                check (llm in ('chatgpt', 'claude', 'perplexity', 'google_aio')),
  score        numeric(5,2) not null,
  mention_count int,
  prompt_count  int,
  raw_results   jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.scores is 'Visibility scores per brand, per LLM, per run.';

create index if not exists scores_brand_llm_created
  on public.scores (brand_id, llm, created_at desc);

-- RLS for 0001 tables
alter table public.waitlist  enable row level security;
alter table public.brands    enable row level security;
alter table public.runs      enable row level security;
alter table public.scores    enable row level security;

do $$ begin
  create policy "waitlist_service_only" on public.waitlist
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "brands_public_read" on public.brands
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "brands_service_write" on public.brands
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "runs_service_only" on public.runs
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "scores_public_read" on public.scores
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "scores_service_write" on public.scores
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────
-- 0002: customers (Stripe webhook writes these)
-- ────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id                    uuid primary key default uuid_generate_v4(),
  email                 text not null unique,
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  plan                  text check (plan in ('starter', 'pro')),
  subscription_status   text not null default 'none',
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.customers is
  'Paying/trialing customers. Written by Stripe webhook, never exposed publicly.';

create index if not exists customers_stripe_customer_id
  on public.customers (stripe_customer_id);

create index if not exists customers_stripe_subscription_id
  on public.customers (stripe_subscription_id);

alter table public.customers enable row level security;

do $$ begin
  create policy "customers_service_only" on public.customers
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
drop trigger if exists customers_updated_at on public.customers;
  create trigger customers_updated_at
    before update on public.customers
    for each row execute procedure public.set_updated_at();
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────
-- 0003: tracked_brands + customer_scoring_runs
-- ────────────────────────────────────────────────────────────

create table if not exists public.tracked_brands (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  brand_name      text not null,
  brand_url       text not null,
  competitors     jsonb not null default '[]',
  category        text,
  segment         text,
  use_case_1      text,
  use_case_2      text,
  integration_1   text,
  integration_2   text,
  role_title      text,
  created_at      timestamptz not null default now(),
  unique (customer_id)
);

comment on table public.tracked_brands is
  'Per-customer brand being tracked. Written server-side via API route.';

alter table public.tracked_brands enable row level security;

do $$ begin
  create policy "tracked_brands_service_all" on public.tracked_brands
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

create index if not exists tracked_brands_customer_id
  on public.tracked_brands (customer_id);

create table if not exists public.customer_scoring_runs (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  run_date        date not null,
  avs_brand       numeric not null,
  per_llm         jsonb not null,
  gap_prompts     jsonb not null,
  fix_report_md   text,
  created_at      timestamptz not null default now(),
  unique (customer_id, run_date)
);

comment on table public.customer_scoring_runs is
  'Per-customer scoring run results. Written by scorer/run_for_customer.py.';

alter table public.customer_scoring_runs enable row level security;

do $$ begin
  create policy "scoring_runs_service_all" on public.customer_scoring_runs
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

create index if not exists scoring_runs_customer_id
  on public.customer_scoring_runs (customer_id);

create index if not exists scoring_runs_customer_date
  on public.customer_scoring_runs (customer_id, run_date desc);

-- ────────────────────────────────────────────────────────────
-- 0004: welcome_email_id column on customers
-- ────────────────────────────────────────────────────────────

alter table public.customers
  add column if not exists welcome_email_id text;

comment on column public.customers.welcome_email_id is
  'Resend message_id for the welcome email. Null until email is sent.';

-- ────────────────────────────────────────────────────────────
-- 0005: email_log
-- ────────────────────────────────────────────────────────────

create table if not exists public.email_log (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid references public.customers(id) on delete set null,
  email_type    text not null,
  recipient     text not null,
  message_id    text,
  error         text,
  sent_at       timestamptz not null default now()
);

comment on table public.email_log is
  'Audit log of all transactional emails sent by NeuralReach.';

create index if not exists email_log_customer_id
  on public.email_log (customer_id);

create index if not exists email_log_type_sent
  on public.email_log (email_type, sent_at desc);

alter table public.email_log enable row level security;

do $$ begin
  create policy "email_log_service_only" on public.email_log
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────
-- 0006: interested_plan column on waitlist
-- ────────────────────────────────────────────────────────────

alter table public.waitlist
  add column if not exists interested_plan text
    check (interested_plan in ('starter', 'pro'));

comment on column public.waitlist.interested_plan is
  'Plan the visitor was viewing when they joined the waitlist. NULL = general sign-up.';

-- ────────────────────────────────────────────────────────────
-- 0007: scoring_jobs queue + last_scored_at on tracked_brands
-- ────────────────────────────────────────────────────────────

alter table public.tracked_brands
  add column if not exists last_scored_at timestamptz;

comment on column public.tracked_brands.last_scored_at is
  'UTC timestamp of the last completed scoring run for this brand. NULL = never scored.';

create table if not exists public.scoring_jobs (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'running', 'done', 'failed')),
  error           text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);

comment on table public.scoring_jobs is
  'Per-customer scoring job queue. Inserted by /api/onboarding; processed by scorer subprocess or cron.';

alter table public.scoring_jobs enable row level security;

do $$ begin
  create policy "scoring_jobs_service_all" on public.scoring_jobs
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

create index if not exists scoring_jobs_customer_status
  on public.scoring_jobs (customer_id, status, created_at desc);

create index if not exists scoring_jobs_pending
  on public.scoring_jobs (status, created_at)
  where status = 'pending';

-- ────────────────────────────────────────────────────────────
-- 0008: scoring_jobs — add trigger column (manual vs weekly)
-- ────────────────────────────────────────────────────────────

alter table public.scoring_jobs
  add column if not exists trigger text not null default 'manual'
    check (trigger in ('manual', 'weekly'));

comment on column public.scoring_jobs.trigger is
  'Source of the scoring request: ''manual'' (run-now or onboarding) or ''weekly'' (cron enqueue).';

create index if not exists scoring_jobs_weekly_done
  on public.scoring_jobs (trigger, status, finished_at)
  where trigger = 'weekly' and status = 'done';

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

-- tracked_brands: read own rows via auth.uid()
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

-- customer_scoring_runs: read own rows via auth.uid()
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

-- scoring_jobs: read own rows via auth.uid()
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

-- Back-fill any pre-existing mixed-case rows (should be zero)
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
alter table public.customers drop constraint if exists customers_email_lowercase;
    alter table public.customers
      add constraint customers_email_lowercase
      check (email = lower(trim(email)));
  end if;
end
$$;

-- ────────────────────────────────────────────────────────────
-- 0011: stripe_events — webhook idempotency
-- ────────────────────────────────────────────────────────────

create table if not exists public.stripe_events (
  event_id      text        primary key,
  event_type    text        not null,
  processed_at  timestamptz not null default now()
);

comment on table public.stripe_events is
  'Processed Stripe event IDs. Webhook inserts here first; a duplicate-key '
  'error (23505) short-circuits all handlers so events are processed at-most-once.';

create index if not exists stripe_events_type_processed
  on public.stripe_events (event_type, processed_at desc);

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

-- ────────────────────────────────────────────────────────────
-- 0013: subscription_status CHECK constraint (audit M3)
-- ────────────────────────────────────────────────────────────
-- Restrict subscription_status to the known union of our sentinel
-- ('none') and all Stripe subscription statuses as of 2025-02-24.
-- Also update STATUS_CONFIG in dashboard/page.tsx to map every value.

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname  = 'customers_subscription_status_check'
       and conrelid = 'public.customers'::regclass
  ) then
alter table public.customers drop constraint if exists customers_subscription_status_check;
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
-- Verify: list all tables created
-- ────────────────────────────────────────────────────────────
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;
