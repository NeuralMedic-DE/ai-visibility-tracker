/**
 * GET  /api/cron/weekly-digest  ← Vercel Cron calls this (GET + Authorization: Bearer)
 * POST /api/cron/weekly-digest  ← manual trigger (X-Cron-Secret or Authorization: Bearer)
 *
 * Canonical weekly AI visibility scoring + email digest cron endpoint.
 * Runs the scorer for every active/trialing customer, then sends each one
 * a personalised weekly digest email via Resend.
 *
 * Authentication:
 *   Vercel Cron (GET):  Authorization: Bearer <CRON_SECRET>
 *   Manual    (POST):   X-Cron-Secret: <CRON_SECRET>
 *                       OR Authorization: Bearer <CRON_SECRET>
 *
 * Vercel Cron invokes this automatically on the schedule in vercel.json
 * (Monday 09:00 UTC). To test it manually:
 *
 *   # Simulate Vercel Cron (GET):
 *   curl https://neuralreach.de/api/cron/weekly-digest \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 *
 *   # Manual POST (legacy):
 *   curl -X POST https://neuralreach.de/api/cron/weekly-digest \
 *     -H "X-Cron-Secret: <CRON_SECRET>"
 *
 * With EMAIL_DRY_RUN=1 in .env.local the emails are printed to the terminal
 * and never sent — safe for local development.
 *
 * Implementation lives in /api/cron/weekly/route.ts (shared module).
 * This file is the public-facing endpoint registered in vercel.json.
 */

export {
  GET,
  POST,
  maxDuration,
  dynamic,
} from "@/app/api/cron/weekly/route";
