-- ============================================================
-- NeuralReach — scoring_jobs: add trigger column
-- Migration: 0008_scoring_jobs_trigger
-- Created: 2026-06-01
--
-- Distinguishes on-demand (manual) jobs from weekly-cron jobs
-- so the weekly-digest cron can find the right jobs to email.
-- ============================================================

alter table public.scoring_jobs
  add column if not exists trigger text not null default 'manual'
    check (trigger in ('manual', 'weekly'));

comment on column public.scoring_jobs.trigger is
  'Source of the scoring request: ''manual'' (run-now or onboarding) or ''weekly'' (cron enqueue).';

-- Index used by the weekly-digest cron to find completed weekly jobs
create index if not exists scoring_jobs_weekly_done
  on public.scoring_jobs (trigger, status, finished_at)
  where trigger = 'weekly' and status = 'done';
