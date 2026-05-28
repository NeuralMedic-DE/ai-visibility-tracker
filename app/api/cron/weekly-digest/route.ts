/**
 * POST /api/cron/weekly-digest
 *
 * Canonical weekly AI visibility scoring + email digest cron endpoint.
 * Runs the scorer for every active/trialing customer, then sends each one
 * a personalised weekly digest email via Resend.
 *
 * Authentication: the caller must supply the header
 *   X-Cron-Secret: <value of env CRON_SECRET>
 *
 * Vercel Cron invokes this automatically on the schedule in vercel.json
 * (Monday 09:00 UTC). To test it manually:
 *
 *   curl -X POST https://neuralreach.de/api/cron/weekly-digest \
 *     -H "X-Cron-Secret: $(grep CRON_SECRET .env.local | cut -d= -f2)"
 *
 * With EMAIL_DRY_RUN=1 in .env.local the emails are printed to the terminal
 * and never sent — safe for local development.
 *
 * Implementation lives in /api/cron/weekly/route.ts (shared module).
 * This file is the public-facing endpoint registered in vercel.json.
 */

export {
  POST,
  maxDuration,
  dynamic,
} from "@/app/api/cron/weekly/route";
