-- Migration 0006: add interested_plan to waitlist
-- Tracks which plan (starter / pro) a visitor was looking at when they
-- joined the early-access waitlist from the /pricing page.
-- NULL means the sign-up came from the homepage general waitlist.

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS interested_plan TEXT
    CHECK (interested_plan IN ('starter', 'pro'));

COMMENT ON COLUMN public.waitlist.interested_plan IS
  'Plan the visitor was viewing when they joined the waitlist. NULL = general sign-up.';
