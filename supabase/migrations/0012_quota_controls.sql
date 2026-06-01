-- ============================================================
-- NeuralReach — Quota controls & cost tracking
-- Migration: 0012_quota_controls
-- Created: 2026-06-01
--
-- Changes:
--   1. Unique partial index on scoring_jobs(customer_id) WHERE
--      status IN ('pending','running') — prevents concurrent scorer
--      processes for the same customer (race-condition fix for
--      /api/run-now and /api/onboarding double-submit).
--
--   2. prompt_count column on customer_scoring_runs — records how
--      many prompts the scorer actually ran (plan-gated: 25 or 100).
--
--   3. estimated_cost_usd column on customer_scoring_runs — records
--      actual API cost for each run, enabling the global daily spend
--      circuit-breaker in scorer/run_for_customer.py.
--
--   4. Index on (run_date, estimated_cost_usd) for the daily-spend
--      aggregation query in _check_daily_spend_limit().
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Prevent concurrent active jobs per customer
--
-- Two simultaneous POST /api/run-now requests can both pass the
-- "check for pending job" guard before either inserts — classic
-- TOCTOU race. This index makes the INSERT atomic: the second
-- concurrent insert gets PG error 23505, which the route handler
-- catches and converts to HTTP 429.
--
-- Partial: only one (pending OR running) row per customer is
-- blocked; completed (done/failed) rows are not constrained so
-- the queue can accumulate history.
-- ────────────────────────────────────────────────────────────
create unique index if not exists scoring_jobs_one_active_per_customer
  on public.scoring_jobs (customer_id)
  where status in ('pending', 'running');

comment on index public.scoring_jobs_one_active_per_customer is
  'Prevents concurrent scorer processes for the same customer. '
  'A second INSERT while status=pending|running yields PG 23505, '
  'caught by the API route and returned as HTTP 429.';

-- ────────────────────────────────────────────────────────────
-- 2. prompt_count — how many prompts the scorer ran this cycle
--
-- Starter plan: 25 prompts/run
-- Pro plan:    100 prompts/run
-- Stored so dashboard / admin can verify plan-gated delivery.
-- ────────────────────────────────────────────────────────────
alter table public.customer_scoring_runs
  add column if not exists prompt_count integer;

comment on column public.customer_scoring_runs.prompt_count is
  'Total prompts scored (across all LLMs) for this run. '
  'Starter=25, Pro=100 per LLM × 4 LLMs.';

-- ────────────────────────────────────────────────────────────
-- 3. estimated_cost_usd — actual API spend for this run
--
-- Written by scorer/run_for_customer.py after completion using
-- cost_tracker.total_cost() (real token counts) or the plan
-- estimate fallback if dry_run is used.
-- Used by _check_daily_spend_limit() to enforce the global
-- SCORER_DAILY_COST_LIMIT_USD circuit-breaker.
-- ────────────────────────────────────────────────────────────
alter table public.customer_scoring_runs
  add column if not exists estimated_cost_usd numeric(8, 4);

comment on column public.customer_scoring_runs.estimated_cost_usd is
  'Actual API cost for this scoring run in USD (from cost_tracker). '
  'Used by the global daily spend circuit-breaker.';

-- ────────────────────────────────────────────────────────────
-- 4. Index for daily spend aggregation
--
-- Query: SELECT SUM(estimated_cost_usd) FROM customer_scoring_runs
--        WHERE run_date = <today>
-- This partial index makes that aggregation O(runs_today) not O(all_runs).
-- ────────────────────────────────────────────────────────────
create index if not exists scoring_runs_run_date_cost
  on public.customer_scoring_runs (run_date, estimated_cost_usd)
  where estimated_cost_usd is not null;

comment on index public.scoring_runs_run_date_cost is
  'Supports daily spend aggregation for the global cost circuit-breaker.';
