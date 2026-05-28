-- ============================================================
-- NeuralReach — Email Tracking
-- Migration: 0004_email_tracking
-- Created: 2026-05-28
-- ============================================================
-- Adds welcome_email_id column to customers so we can track
-- whether the welcome email was successfully sent / deduped.

alter table public.customers
  add column if not exists welcome_email_id text;

comment on column public.customers.welcome_email_id is
  'Resend message_id for the welcome email. Null until email is sent.';
