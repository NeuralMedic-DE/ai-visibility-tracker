-- ============================================================
-- NeuralReach — Scoring Jobs Queue + last_scored_at
-- Migration: 0007_scoring_jobs
-- Created: 2026-06-01
-- ============================================================

-- Add last_scored_at to tracked_brands so we know when scoring last ran
alter table public.tracked_brands
  add column if not exists last_scored_at timestamptz;

comment on column public.tracked_brands.last_scored_at is
  'UTC timestamp of the last completed scoring run for this brand. NULL = never scored.';

-- ────────────────────────────────────────────────────────────
-- scoring_jobs
-- Lightweight queue. One row = one pending/running/done job.
-- The onboarding API inserts a pending row; the Python scorer
-- or cron can pick it up. Customer can also see their job status.
-- ────────────────────────────────────────────────────────────
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

-- Row Level Security
alter table public.scoring_jobs enable row level security;

-- Customers can read their own jobs
create policy "scoring_jobs_own_select" on public.scoring_jobs
  for select using (
    customer_id in (
      select id from public.customers
      where email = auth.jwt() ->> 'email'
    )
  );

-- Service role gets full access (scorer + cron write, API reads)
create policy "scoring_jobs_service_all" on public.scoring_jobs
  for all using (auth.role() = 'service_role');

-- Indexes
create index if not exists scoring_jobs_customer_status
  on public.scoring_jobs (customer_id, status, created_at desc);

create index if not exists scoring_jobs_pending
  on public.scoring_jobs (status, created_at)
  where status = 'pending';
