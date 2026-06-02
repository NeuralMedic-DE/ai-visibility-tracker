/**
 * GET  /api/cron/weekly   (Vercel Cron — 09:00 UTC Monday)
 * POST /api/cron/weekly   (manual trigger — development / ops)
 *
 * Runs inline TypeScript scoring for every active/trialing customer who
 * hasn't been scored in the last 6 days.  Results are written to
 * customer_scoring_runs and scoring_jobs rows are marked done so that
 * /api/cron/weekly-digest (10:00 UTC Monday) can send the digest emails.
 *
 * Previously this endpoint only enqueued scoring_jobs rows (status=pending)
 * and relied on a never-built external worker.  It now runs the TypeScript
 * scorer (lib/scorer.ts) inline, exactly as /api/run-now does, iterating
 * all eligible customers in parallel.
 *
 * Authentication:
 *   • GET  (Vercel Cron): header `Authorization: Bearer <CRON_SECRET>`
 *   • POST (manual):      header `X-Cron-Secret: <CRON_SECRET>`
 *                         OR     `Authorization: Bearer <CRON_SECRET>`
 *
 * Invoke manually (e.g. to test scoring after onboarding a new customer):
 *   curl -X POST https://neuralreach.de/api/cron/weekly \
 *     -H "X-Cron-Secret: <CRON_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreForCustomer } from "@/lib/scorer";
import { reportError } from "@/lib/error-reporter";

// 5 minutes — runs scoring for all eligible customers in parallel.
// Each per-customer scorer takes 30–90 s (25–100 prompts × 4 LLMs).
// At ≤~8 concurrent customers this fits comfortably inside 300 s.
// If the customer base grows, split into per-customer invocations.
export const maxDuration = 300;
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

// ── Per-customer scorer ───────────────────────────────────────────────────────

interface CustomerScoreOutcome {
  customerId: string;
  email: string;
  result: "scored" | "skipped" | "failed";
  reason?: string;
  avsBrand?: number;
}

async function scoreOneCustomer(
  customerId: string,
  email: string
): Promise<CustomerScoreOutcome> {
  const admin = createAdminClient();

  // --- Skip if no tracked brand ------------------------------------------------
  const { data: brand } = await admin
    .from("tracked_brands")
    .select("id")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!brand) {
    return { customerId, email, result: "skipped", reason: "no tracked brand" };
  }

  // --- Skip if already scored within the last 6 days ---------------------------
  const cutoffDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: recentRun } = await admin
    .from("customer_scoring_runs")
    .select("run_date")
    .eq("customer_id", customerId)
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentRun && recentRun.run_date >= cutoffDate) {
    return {
      customerId,
      email,
      result: "skipped",
      reason: `last_scored=${recentRun.run_date} (within 6-day window)`,
    };
  }

  // --- Skip (or pick up) if a job already exists --------------------------------
  // If status=running, another process is already scoring — skip.
  // If status=pending AND trigger=weekly, that's a stale row (previously enqueued
  // but never processed by a worker that never existed); pick it up.
  // Ignore pending manual jobs — those belong to /api/run-now, not the weekly cron.
  const { data: existingJob } = await admin
    .from("scoring_jobs")
    .select("id, status, trigger")
    .eq("customer_id", customerId)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingJob?.status === "running") {
    return {
      customerId,
      email,
      result: "skipped",
      reason: "job already running (concurrent guard)",
    };
  }

  // --- Insert (or reuse) a scoring_jobs row as 'running' -----------------------
  // Only pick up existing pending jobs that were originally enqueued by the weekly
  // cron (trigger='weekly').  Leave manual pending jobs for /api/run-now.
  const canPickUp =
    existingJob?.status === "pending" && existingJob?.trigger === "weekly";
  let jobId: string | null = canPickUp ? existingJob!.id : null;

  if (jobId) {
    // Pick up the existing pending job.
    await admin
      .from("scoring_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
    console.log(`[cron/weekly] Picked up pending job ${jobId} for ${email}`);
  } else {
    const { data: newJob, error: insertErr } = await admin
      .from("scoring_jobs")
      .insert({
        customer_id: customerId,
        status: "running",
        trigger: "weekly",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr || !newJob) {
      // Unique-constraint violation means another concurrent run beat us — skip.
      if (insertErr?.code === "23505") {
        return {
          customerId,
          email,
          result: "skipped",
          reason: "job insert race (23505) — another invocation took it",
        };
      }
      return {
        customerId,
        email,
        result: "failed",
        reason: `job insert error: ${insertErr?.message ?? "unknown"}`,
      };
    }
    jobId = newJob.id as string;
  }

  // --- Run inline TypeScript scorer --------------------------------------------
  try {
    console.log(`[cron/weekly] Scoring ${email} (job=${jobId})…`);
    const scoreResult = await scoreForCustomer(customerId, admin);

    // Mark job done.
    await admin
      .from("scoring_jobs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", jobId);

    // Update last_scored_at for UI display.
    await admin
      .from("tracked_brands")
      .update({ last_scored_at: new Date().toISOString() })
      .eq("customer_id", customerId);

    console.log(
      `[cron/weekly] ✅ ${email} scored — AVS=${scoreResult.avsBrand}/100`
    );
    return {
      customerId,
      email,
      result: "scored",
      avsBrand: scoreResult.avsBrand,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cron/weekly] ❌ Scoring failed for ${email}: ${errMsg}`);

    reportError(err instanceof Error ? err : new Error(errMsg), {
      route: "cron/weekly",
      step: "scorer",
      customerId,
    });

    // Mark job failed so it is not retried endlessly.
    await admin
      .from("scoring_jobs")
      .update({
        status: "failed",
        error: errMsg.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { customerId, email, result: "failed", reason: errMsg.slice(0, 200) };
  }
}

// ── Core handler ─────────────────────────────────────────────────────────────

async function runWeeklyScoring(req: NextRequest): Promise<NextResponse> {
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

  console.log("[cron/weekly] Starting weekly inline scoring run");

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
    console.log("[cron/weekly] No active/trialing customers — nothing to score");
    return NextResponse.json({ scored: 0, skipped: 0, failed: 0 });
  }

  console.log(
    `[cron/weekly] Processing ${customers.length} customer(s) in parallel`
  );

  // 2. Run all customers in parallel — scoreOneCustomer handles its own guards.
  //    Promise.allSettled ensures one failure doesn't abort the others.
  const settledResults = await Promise.allSettled(
    (customers as { id: string; email: string }[]).map((c) =>
      scoreOneCustomer(c.id, c.email)
    )
  );

  const outcomes: CustomerScoreOutcome[] = settledResults.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    // Unexpected rejection (should not happen — scoreOneCustomer catches internally)
    const cust = (customers as { id: string; email: string }[])[i];
    console.error(`[cron/weekly] Unexpected rejection for ${cust.email}:`, r.reason);
    return {
      customerId: cust.id,
      email: cust.email,
      result: "failed" as const,
      reason: String(r.reason),
    };
  });

  const scored = outcomes.filter((o) => o.result === "scored").length;
  const skipped = outcomes.filter((o) => o.result === "skipped").length;
  const failed = outcomes.filter((o) => o.result === "failed").length;

  console.log(
    `[cron/weekly] Done — scored=${scored}, skipped=${skipped}, failed=${failed}`
  );

  return NextResponse.json({ scored, skipped, failed, details: outcomes });
}

// ── Route exports ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return runWeeklyScoring(req);
}

export async function POST(req: NextRequest) {
  return runWeeklyScoring(req);
}
