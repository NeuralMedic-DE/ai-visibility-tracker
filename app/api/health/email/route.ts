/**
 * GET /api/health/email
 *
 * Canonical email-pipeline health probe.
 *
 * Calls resend.emails.send() with a live probe message and returns Resend's
 * raw API response verbatim.  If the call succeeds → 200.  If it fails for
 * any reason (bad key, bad domain, EMAIL_DRY_RUN, network) → 503 with the
 * error payload.
 *
 * Required env vars (set in Vercel + .env.local):
 *   RESEND_API_KEY         — Resend API key with sending scope
 *   RESEND_FROM            — e.g. "NeuralReach <hello@mail.neuralreach.de>"
 *   RESEND_HEALTHCHECK_TO  — probe recipient, e.g. heinzmann.jonas@icloud.com
 *
 * Usage:
 *   curl https://neuralreach.de/api/health/email
 *   → 200 { "id": "...", "resend_raw": {...}, "dry_run_active": false }
 *   → 503 { "error": "...", "dry_run_active": true }
 *
 * IMPORTANT: this route bypasses the lib/email.ts wrapper intentionally so
 * that EMAIL_DRY_RUN cannot silently short-circuit the probe.  If dry-run is
 * active it is surfaced explicitly in the response rather than being hidden.
 */

import { Resend } from "resend";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM ?? "NeuralReach <hello@mail.neuralreach.de>";
  const to = process.env.RESEND_HEALTHCHECK_TO;

  const dryRunActive =
    process.env.EMAIL_DRY_RUN === "1" &&
    process.env.NODE_ENV === "production";

  // Surface misconfiguration clearly instead of silently returning ok.
  if (dryRunActive) {
    return NextResponse.json(
      {
        status: "broken",
        error:
          "EMAIL_DRY_RUN=1 is set in production — no emails will be delivered. " +
          "Remove it from Vercel Settings → Environment Variables → Production and redeploy.",
        dry_run_active: true,
        checked_at: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        status: "broken",
        error: "RESEND_API_KEY env var is not set.",
        dry_run_active: false,
        checked_at: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  if (!to) {
    return NextResponse.json(
      {
        status: "broken",
        error:
          "RESEND_HEALTHCHECK_TO env var is not set. " +
          "Add it to Vercel (e.g. heinzmann.jonas@icloud.com).",
        dry_run_active: false,
        checked_at: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  const resend = new Resend(apiKey);

  try {
    // Call resend.emails.send() directly and return the raw response verbatim.
    // Do NOT route through lib/email.ts — we want an unfiltered diagnostic.
    const raw = await resend.emails.send({
      from,
      to,
      subject: "NeuralReach email probe",
      text: "ok — this is an automated deliverability probe from /api/health/email",
    });

    if (raw.error) {
      console.error("[health/email] Resend API returned error:", raw.error);
      return NextResponse.json(
        {
          status: "broken",
          error: raw.error,
          resend_raw: raw,
          from,
          to,
          dry_run_active: false,
          checked_at: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    console.log(
      `[health/email] Probe sent → ${to} | id=${raw.data?.id}`
    );

    return NextResponse.json(
      {
        status: "ok",
        id: raw.data?.id,
        resend_raw: raw,
        from,
        to,
        dry_run_active: false,
        commit_sha: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
        checked_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[health/email] Unexpected error:", msg);
    return NextResponse.json(
      {
        status: "broken",
        error: msg,
        from,
        to,
        dry_run_active: false,
        checked_at: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
