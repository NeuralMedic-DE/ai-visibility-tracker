-- ============================================================
-- NeuralReach — Waitlist signups per hour
-- Run this in Supabase SQL Editor (dashboard.supabase.com)
-- ============================================================

-- Hourly counts for the last 7 days
SELECT
  date_trunc('hour', signed_up_at AT TIME ZONE 'UTC') AS hour_utc,
  count(*)                                             AS new_signups,
  sum(count(*)) OVER (ORDER BY date_trunc('hour', signed_up_at AT TIME ZONE 'UTC')) AS running_total
FROM public.waitlist
WHERE signed_up_at >= now() - interval '7 days'
GROUP BY 1
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────
-- Quick launch-day snapshot (last 24 h, 1-hour buckets)
-- ─────────────────────────────────────────────────────────────
SELECT
  date_trunc('hour', signed_up_at AT TIME ZONE 'UTC') AS hour_utc,
  count(*)                                             AS signups
FROM public.waitlist
WHERE signed_up_at >= now() - interval '24 hours'
GROUP BY 1
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────
-- Total signups + today's count at a glance
-- ─────────────────────────────────────────────────────────────
SELECT
  count(*)                                                       AS total_signups,
  count(*) FILTER (WHERE signed_up_at >= current_date)          AS today,
  count(*) FILTER (WHERE signed_up_at >= now() - interval '1 hour') AS last_hour
FROM public.waitlist;
