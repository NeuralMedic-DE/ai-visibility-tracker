-- ============================================================
-- NeuralReach — Enforce lowercase emails at DB level
-- Migration: 0010_email_lowercase_check
-- Created: 2026-06-01
--
-- Belt-and-suspenders guard for H4 (email case-sensitivity bug).
-- The app already normalises emails to lower(trim()) before any
-- DB write, but this constraint makes it impossible for a future
-- code regression to silently store a mixed-case email.
--
-- Strategy: CHECK constraint (no extension needed, no type change).
-- ============================================================

-- ── 1. Back-fill any pre-existing mixed-case rows ─────────────
-- In practice there should be zero such rows (app always
-- lowercased), but run it defensively before adding the constraint.
update public.customers
   set email = lower(trim(email))
 where email <> lower(trim(email));

-- ── 2. Add CHECK constraint ───────────────────────────────────
-- Rejects any INSERT/UPDATE that would store a non-lowercase
-- or untrimmed email address.  The `if not exists` guard is not
-- supported on constraints; the `do $$ … $$` block makes the
-- migration idempotent.
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

comment on constraint customers_email_lowercase on public.customers is
  'Enforces that emails are stored lower(trim()) — matches app-level normalisation. '
  'Prevents silent mis-match between login (lowercased) and webhook (raw Stripe email).';
