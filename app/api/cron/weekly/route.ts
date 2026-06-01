/**
 * GET  /api/cron/weekly   (Vercel Cron — 09:00 UTC Monday)
 * POST /api/cron/weekly   (manual trigger — development / ops)
 *
 * Enqueues scoring_jobs rows (trigger='weekly', status='pending') for every
 * active/trialing customer who hasn't been scored in the last 6 days.
 *
 * The always-on worker service (Railway/Fly/Render) picks up pending jobs and
 * runs the Python scorer out-of-band. Email delivery is handled by the
 * /api/cron/weekly-digest endpoint scheduled ~1 hour later (10:00 UTC Monday).
 *
 * This endpoint does NOT run the scorer itself — it is enqueue-only, so it
 * finishes in seconds and never needs a long Vercel function timeout.
 *
 * Authentication:
 *   • GET  (Vercel Cron): header `Authorization: Bearer <CRON_SECRET>`
 *   • POST (manual):      header `X-Cron-Secret: <CRON_SECRET>`
 *                         OR     `Authorization: Bearer <CRON_SECRET>`
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30; // just DB queries — no Python subprocess
export const dynamic = "force-dynamic";

// ── Auth helper ───────────────────────────────────────────────────────────────

function authenticateCron(
  req: NextRequest,
  cronSecret: string
): NextResponse | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === cronSecret) return null; // ✅
    console.warn("[cron/weekly] Unauthorized — bad Bearer token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const xSecret = req.headers.get("x-cron-secret");
  if (xSecret !== null) {
    if (xSecret === cronSecret) return null; // ✅
    console.warn("[cron/weekly] Unauthorized — bad X-Cron-Secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.warn("[cron/weekly] Unauthorized — no auth header");
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ── Core handler ─────────────────────────────────────────────────────────────

async function enqueueWeeklyScoringJobs(
  req: NextRequest
): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/weekly] CRON_SECRET env var not set");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 }
    );
  }

  const authError = authenticateCron(req, cronSecret);
  if (authError) return authError;

  const admin = createAdminClient();

  console.log("[cron/weekly] Starting weekly scoring enqueue run");

  // 1. Fetch all active/trialing customers
  const { data: customers, error: customersErr } = await admin
    .from("customers")
    .select("id, email")
    .in("subscription_status", ["trialing", "active"]);

  if (customersErr) {
    console.error("[cron/weekly] Failed to fetch customers:", customersErr);
    return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
  }

  if (!customers || customers.length === 0) {
    console.log("[cron/weekly] No active/trialing customers — nothing to enqueue");
    return NextResponse.json({ enqueued: 0, skipped: 0 });
  }

  console.log(`[cron/weekly] Checking ${customers.length} customer(s)`);

  // 6-day cutoff: skip customers scored within the last 6 days
  const cutoffDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const details: Array<{
    customerId: string;
    email: string;
    result: "enqueued" | "skipped";
    reason?: string;
  }> = [];

  let enqueued = 0;
  let skipped = 0;

  for (const customer of customers as { id: string; email: string }[]) {
    const { id: customerId, email } = customer;

    // 2a. Skip if no tracked brand
    const { data: brand } = await admin
      .from("tracked_brands")
      .select("id")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!brand) {
      skipped++;
      details.push({ customerId, email, result: "skipped", reason: "no tracked brand" });
      continue;
    }

    // 2b. Skip if already scored within the last 6 days
    const { data: recentRun } = await admin
      .from("customer_scoring_runs")
      .select("run_date")
      .eq("customer_id", customerId)
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentRun && recentRun.run_date >= cutoffDate) {
      skipped++;
      details.push({
        customerId,
        email,
        result: "skipped",
        reason: `last_scored_at=${recentRun.run_date} within 6-day window`,
      });
      continue;
    }

    // 2c. Skip if a pending or running job already exists (avoid duplicates)
    const { data: activeJob } = await admin
      .from("scoring_jobs")
      .select("id, status")
      .eq("customer_id", customerId)
      .in("status", ["pending", "running"])
      .limit(1)
      .maybeSingle();

    if (activeJob) {
      skipped++;
      details.push({
        customerId,
        email,
        result: "skipped",
        reason: `job already ${activeJob.status}`,
      });
      continue;
    }

    // 2d. Enqueue a weekly scoring job
    const { error: jobErr } = await admin.from("scoring_jobs").insert({
      customer_id: customerId,
      status: "pending",
      trigger: "weekly",
    });

    if (jobErr) {
      console.error(
        `[cron/weekly] Failed to enqueue job for customer ${customerId}:`,
        jobErr
      );
      skipped++;
      details.push({
        customerId,
        email,
        result: "skipped",
        reason: `insert error: ${jobErr.message}`,
      });
    } else {
      enqueued++;
      details.push({ customerId, email, result: "enqueued" });
      console.log(`[cron/weekly] Enqueued weekly scoring job for ${email}`);
    }
  }

  console.log(
    `[cron/weekly] Done — enqueued=${enqueued}, skipped=${skipped}`
  );

  return NextResponse.json({ enqueued, skipped, details });
}

// ── Route exports ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return enqueueWeeklyScoringJobs(req);
}

export async function POST(req: NextRequest) {
  return enqueueWeeklyScoringJobs(req);
}
