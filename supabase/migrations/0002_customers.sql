-- ============================================================
-- NeuralReach — Customers / Subscriptions
-- Migration: 0002_customers
-- Created: 2026-05-27
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- customers
-- Created/updated by the Stripe webhook on subscription events.
-- Keyed on email (Stripe customer_details.email after checkout).
-- ────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id                    uuid primary key default uuid_generate_v4(),
  email                 text not null unique,
  stripe_customer_id    text unique,          -- cus_xxx
  stripe_subscription_id text unique,         -- sub_xxx
  plan                  text check (plan in ('starter', 'pro')),
  subscription_status   text not null default 'none',
    -- none | trialing | active | past_due | canceled | incomplete | unpaid
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.customers is
  'Paying/trialing customers. Written by Stripe webhook, never exposed publicly.';

-- Index for webhook lookups by Stripe IDs
create index if not exists customers_stripe_customer_id
  on public.customers (stripe_customer_id);

create index if not exists customers_stripe_subscription_id
  on public.customers (stripe_subscription_id);

-- Row Level Security — service role only (webhook uses service role)
alter table public.customers enable row level security;

drop policy if exists "customers_service_only" on public.customers;
create policy "customers_service_only" on public.customers
  for all using (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- updated_at auto-update trigger
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();
