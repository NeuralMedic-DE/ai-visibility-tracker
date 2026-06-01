/**
 * NeuralReach Scoring Worker
 *
 * Always-on service that polls the scoring_jobs queue and runs the TypeScript
 * scorer (lib/scorer.ts) for each pending job.
 *
 * Deploy on Railway, Fly, or Render as a separate service alongside the
 * Next.js app. No Python runtime required — scoring is done entirely in
 * TypeScript using the native fetch() API.
 *
 * Required env vars (set in your deployment platform):
 *   NEXT_PUBLIC_SUPABASE_URL      Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     Service role key — full DB access
 *   OPENAI_API_KEY                For ChatGPT (GPT-4o) queries
 *   ANTHROPIC_API_KEY             For Claude (Haiku) queries
 *   PERPLEXITY_API_KEY            For Perplexity (sonar-pro) queries
 *   SERPAPI_KEY                   For Google AI Overview checks
 *
 * Optional tuning:
 *   WORKER_POLL_INTERVAL_MS       How often to poll for new jobs (default: 30000)
 *   WORKER_STALE_JOB_MINUTES      Reset 'running' jobs stuck > N minutes (default: 15)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "path";
import * as dotenv from "dotenv";
import { scoreForCustomer } from "../lib/scorer";

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const WORKER_DIR = __dirname;
const REPO_ROOT = path.resolve(WORKER_DIR, "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

// ── Configuration ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const POLL_INTERVAL_MS = parseInt(
  process.env.WORKER_POLL_INTERVAL_MS ?? "30000",
  10
);
const STALE_JOB_MINUTES = parseInt(
  process.env.WORKER_STALE_JOB_MINUTES ?? "15",
  10
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "[worker] FATAL: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"
  );
  process.exit(1);
}

// ── Supabase client ───────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// ── Stale job recovery ────────────────────────────────────────────────────────

/**
 * Resets any scoring_jobs that have been stuck in 'running' for longer than
 * STALE_JOB_MINUTES. This handles worker restarts mid-job.
 */
async function resetStaleJobs(): Promise<void> {
  const staleThreshold = new Date(
    Date.now() - STALE_JOB_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("scoring_jobs")
    .update({ status: "pending", started_at: null })
    .eq("status", "running")
    .lt("started_at", staleThreshold)
    .select("id");

  if (error) {
    console.warn("[worker] Failed to reset stale jobs:", error.message);
  } else if (data && data.length > 0) {
    console.log(`[worker] Reset ${data.length} stale job(s) to pending`);
  }
}

// ── Job processing ────────────────────────────────────────────────────────────

/**
 * Claims and processes one pending scoring job using the TypeScript scorer.
 * Returns true if a job was found (even if it failed), false if the queue
 * was empty (caller should wait before polling again).
 */
async function processNextJob(): Promise<boolean> {
  // 1. Find the oldest pending job
  const { data: pending } = await supabase
    .from("scoring_jobs")
    .select("id, customer_id, trigger")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!pending || pending.length === 0) {
    return false; // queue empty
  }

  const job = pending[0] as {
    id: string;
    customer_id: string;
    trigger: string;
  };

  // 2. Atomically claim the job: only updates if it's still 'pending'
  //    (guards against two worker replicas racing on the same job)
  const { data: claimed } = await supabase
    .from("scoring_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    console.log(
      `[worker] Job ${job.id} already claimed by another instance — skipping`
    );
    return true; // there may be more jobs
  }

  console.log(
    `[worker] Claimed job ${job.id} | customer=${job.customer_id} | trigger=${job.trigger}`
  );

  // 3. Run TypeScript scorer (replaces Python subprocess)
  try {
    await scoreForCustomer(job.customer_id, supabase);

    // 4a. Mark done
    await supabase
      .from("scoring_jobs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", job.id);

    // 4b. Update tracked_brands.last_scored_at for UI display
    await supabase
      .from("tracked_brands")
      .update({ last_scored_at: new Date().toISOString() })
      .eq("customer_id", job.customer_id);

    console.log(
      `[worker] ✅ Job ${job.id} completed for customer ${job.customer_id}`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[worker] ❌ Job ${job.id} failed for customer ${job.customer_id}:`,
      errMsg
    );

    // 4c. Mark failed with error message (truncated to fit DB column)
    await supabase
      .from("scoring_jobs")
      .update({
        status: "failed",
        error: errMsg.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  return true; // processed a job — check for more immediately
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

let pollCount = 0;

async function poll(): Promise<void> {
  pollCount++;

  try {
    // Every 10 polls (~5 min at default interval), recover stale jobs
    if (pollCount % 10 === 1) {
      await resetStaleJobs();
    }

    // Drain the queue: process jobs back-to-back until it's empty
    let hasMore = true;
    while (hasMore) {
      hasMore = await processNextJob();
    }
  } catch (err) {
    console.error("[worker] Unexpected error in poll loop:", err);
  }

  // Schedule next poll
  setTimeout(poll, POLL_INTERVAL_MS);
}

// ── Startup ───────────────────────────────────────────────────────────────────

console.log("[worker] ─────────────────────────────────────────────────────");
console.log("[worker] NeuralReach Scoring Worker starting (TypeScript scorer)");
console.log(`[worker] Repo root     : ${REPO_ROOT}`);
console.log(`[worker] Supabase URL  : ${SUPABASE_URL}`);
console.log(`[worker] Poll interval : ${POLL_INTERVAL_MS}ms`);
console.log(`[worker] Stale reset   : ${STALE_JOB_MINUTES}min`);
console.log("[worker] ─────────────────────────────────────────────────────");

// Start the first poll immediately
poll().catch((err) => {
  console.error("[worker] Fatal startup error:", err);
  process.exit(1);
});
