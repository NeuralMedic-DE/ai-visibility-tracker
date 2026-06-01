-- ============================================================
-- NeuralReach — Stripe event idempotency table
-- Migration: 0011_stripe_events
-- Created: 2026-06-01
--
-- Prevents Stripe retry/duplicate webhook deliveries from
-- re-running handlers (e.g. sending a welcome email twice or
-- double-writing subscription state).
--
-- Flow in the webhook handler:
--   1. Verify Stripe signature (rejects tampered requests).
--   2. INSERT event_id → stripe_events (primary key = unique).
--      • Success  → proceed with handler logic.
--      • PG 23505 → already processed; return 200 no-op.
--      • Other DB error → return 500; Stripe will retry later.
--
-- Stripe guarantees event_id is globally unique per event
-- object (evt_xxx), so this is a safe idempotency key.
-- ============================================================

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

-- Index for admin queries like "show me all events of a given type"
create index if not exists stripe_events_type_processed
  on public.stripe_events (event_type, processed_at desc);

-- RLS: service-role only — the webhook runs with the service key.
alter table public.stripe_events enable row level security;

do $$
begin
  create policy "stripe_events_service_only" on public.stripe_events
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end
$$;
