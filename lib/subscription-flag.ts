/**
 * Single source of truth for whether subscriptions are LIVE in production.
 *
 * Two requirements MUST both be true for subscriptions to enable:
 *
 *   1. `SUBSCRIPTIONS_LIVE=true` env var set (operational toggle in Vercel)
 *   2. The current date is at or past SUBSCRIPTIONS_LOCK_UNTIL (founder lock)
 *
 * The founder-lock is a hard-coded calendar date, not an env var. This is
 * defense in depth — if SUBSCRIPTIONS_LIVE gets flipped to "true" by accident
 * (bot approval mistake, Vercel UI fumble, env-var copy-paste), the date gate
 * still keeps subscriptions disabled until the planned launch.
 *
 * The lock can ONLY be lifted by editing this file and shipping a commit,
 * which forces a code review of the launch decision. After the lock date
 * passes, the flag becomes purely SUBSCRIPTIONS_LIVE-driven.
 *
 * Context: 2026-06-10 — founder moved subscription launch from 2026-06-04 to
 * 2026-06-17. Registration / waitlist signups stay open in the interim.
 */

export const SUBSCRIPTIONS_LOCK_UNTIL = new Date("2026-06-17T00:00:00Z");

export function subscriptionsLive(now: Date = new Date()): boolean {
  const flagOn = process.env.SUBSCRIPTIONS_LIVE === "true";
  const dateOk = now >= SUBSCRIPTIONS_LOCK_UNTIL;
  // Surface the mismatch loudly in server logs so an accidental
  // SUBSCRIPTIONS_LIVE=true before the launch date doesn't slip past silently.
  if (flagOn && !dateOk) {
    console.warn(
      `[subscription-flag] SUBSCRIPTIONS_LIVE=true but date-locked until ` +
        `${SUBSCRIPTIONS_LOCK_UNTIL.toISOString()}. Subscriptions remain disabled.`
    );
  }
  return flagOn && dateOk;
}

/** Reason text for ops/debugging — never shown to users. */
export function subscriptionsLiveReason(now: Date = new Date()): string {
  const flagOn = process.env.SUBSCRIPTIONS_LIVE === "true";
  const dateOk = now >= SUBSCRIPTIONS_LOCK_UNTIL;
  if (!flagOn && !dateOk) return "env-flag off + date-lock active";
  if (!flagOn) return "env-flag off";
  if (!dateOk) return `env-flag on but date-locked until ${SUBSCRIPTIONS_LOCK_UNTIL.toISOString()}`;
  return "LIVE";
}
