-- ============================================================
-- NeuralReach — Initial Schema
-- Migration: 0001_init
-- Created: 2026-05-27
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- waitlist
-- Captures early-access sign-ups before product launch.
-- ────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id           uuid primary key default uuid_generate_v4(),
  email        text not null unique,
  brand_interest text,                    -- optional: what brand they want tracked
  signed_up_at timestamptz not null default now(),
  converted_at timestamptz,               -- set when they become a paying customer
  notes        text
);

comment on table public.waitlist is 'Early-access sign-ups from landing page and leaderboard CTAs.';

-- ────────────────────────────────────────────────────────────
-- brands
-- The B2B SaaS brands being tracked.
-- ────────────────────────────────────────────────────────────
create table if not exists public.brands (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,       -- e.g. "notion", "linear"
  name        text not null,
  website     text,
  category    text,                       -- e.g. "Project Management"
  description text,
  logo_url    text,
  is_seed     boolean not null default false,  -- true for the 100-brand public index
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.brands is 'B2B SaaS brands tracked in the AI Visibility Index and by paying customers.';

-- ────────────────────────────────────────────────────────────
-- runs
-- Each weekly (or on-demand) scoring run for a brand.
-- ────────────────────────────────────────────────────────────
create table if not exists public.runs (
  id          uuid primary key default uuid_generate_v4(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'pending'  -- pending | running | complete | failed
                check (status in ('pending', 'running', 'complete', 'failed')),
  error_msg   text,
  prompt_count int,
  created_at  timestamptz not null default now()
);

comment on table public.runs is 'Scoring runs — one row per brand per weekly (or manual) trigger.';

-- ────────────────────────────────────────────────────────────
-- scores
-- Per-LLM visibility scores for a brand, per run.
-- ────────────────────────────────────────────────────────────
create table if not exists public.scores (
  id           uuid primary key default uuid_generate_v4(),
  run_id       uuid not null references public.runs(id) on delete cascade,
  brand_id     uuid not null references public.brands(id) on delete cascade,
  llm          text not null              -- chatgpt | claude | perplexity | google_aio
                check (llm in ('chatgpt', 'claude', 'perplexity', 'google_aio')),
  score        numeric(5,2) not null,     -- 0–100
  mention_count int,                      -- how many prompts mentioned the brand
  prompt_count  int,                      -- total prompts run for this LLM
  raw_results   jsonb,                    -- optional: store raw API responses
  created_at   timestamptz not null default now()
);

comment on table public.scores is 'Visibility scores per brand, per LLM, per run.';

-- Composite index for time-series queries
create index if not exists scores_brand_llm_created
  on public.scores (brand_id, llm, created_at desc);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- Waitlist: only service role can read (no public exposure)
-- Brands / scores: public read, service role write
-- ────────────────────────────────────────────────────────────
alter table public.waitlist  enable row level security;
alter table public.brands    enable row level security;
alter table public.runs      enable row level security;
alter table public.scores    enable row level security;

-- waitlist: only service role (no anon access)
drop policy if exists "waitlist_service_only" on public.waitlist;
create policy "waitlist_service_only" on public.waitlist
  for all using (auth.role() = 'service_role');

-- brands: anyone can read
drop policy if exists "brands_public_read" on public.brands;
create policy "brands_public_read" on public.brands
  for select using (true);

-- brands: only service role can write
drop policy if exists "brands_service_write" on public.brands;
create policy "brands_service_write" on public.brands
  for all using (auth.role() = 'service_role');

-- runs: only service role
drop policy if exists "runs_service_only" on public.runs;
create policy "runs_service_only" on public.runs
  for all using (auth.role() = 'service_role');

-- scores: anyone can read
drop policy if exists "scores_public_read" on public.scores;
create policy "scores_public_read" on public.scores
  for select using (true);

-- scores: only service role can write
drop policy if exists "scores_service_write" on public.scores;
create policy "scores_service_write" on public.scores
  for all using (auth.role() = 'service_role');
