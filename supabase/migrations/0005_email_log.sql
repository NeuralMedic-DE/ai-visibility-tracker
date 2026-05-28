-- ============================================================
-- NeuralReach — Email Log
-- Migration: 0005_email_log
-- Created: 2026-05-28
-- ============================================================
-- Records every transactional email send attempt (success or failure).
-- Written by the Stripe webhook (welcome) and the weekly cron.

-- Enable uuid extension if not already enabled
create extension if not exists "uuid-ossp";

create table if not exists public.email_log (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid references public.customers(id) on delete set null,
  email_type    text not null,
    -- 'welcome' | 'weekly_digest'
  recipient     text not null,
  message_id    text,     -- Resend message_id (null on failure or dry-run)
  error         text,     -- error message if send failed, null on success
  sent_at       timestamptz not null default now()
);

comment on table public.email_log is
  'Audit log of all transactional emails sent by NeuralReach.';

-- Index for looking up sends by customer
create index if not exists email_log_customer_id
  on public.email_log (customer_id);

-- Index for looking up sends by type + date (monitoring, dedup)
create index if not exists email_log_type_sent
  on public.email_log (email_type, sent_at desc);

-- Row Level Security — service role only
alter table public.email_log enable row level security;

create policy "email_log_service_only" on public.email_log
  for all using (auth.role() = 'service_role');
