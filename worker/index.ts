/**
 * NeuralReach Scoring Worker
 *
 * Always-on service that polls the scoring_jobs queue and runs the Python
 * scorer (scorer.run_for_customer) for each pending job.
 *
 * Deploy on Railway, Fly, or Render as a separate service alongside the
 * Next.js app. The Dockerfile at worker/Dockerfile builds a single image
 * with both Node.js (for this worker) and Python 3 (for the scorer).
 *
 * Required env vars (set in your deployment platform):
 *   NEXT_PUBLIC_SUPABASE_URL      Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     Service role key — full DB access
 *   OPENAI_API_KEY                For the Python scorer (ChatGPT queries)
 *   ANTHROPIC_API_KEY             For the Python scorer (Claude queries)
 *   PERPLEXITY_API_KEY            For the Python scorer (Perplexity queries)
 *   SERPAPI_KEY                   For Google AI Overview checks
 *
 * Optional tuning:
 *   WORKER_POLL_INTERVAL_MS       How often to poll for new jobs (default: 30000)
 *   WORKER_SCORER_TIMEOUT_MS      Max time for one scoring job  (default: 300000)
 *   WORKER_STALE_JOB_MINUTES      Reset 'running' jobs stuck > N minutes (default: 15)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import path from "path";
import * as dotenv from "dotenv";

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Load .env.local / .env from the repo root for local development.
// In production the platform injects env vars directly — these calls are no-ops.
const WORKER_DIR = __dirname; // <repo-root>/worker
const REPO_ROOT = path.resolve(WORKER_DIR, ".."); // <repo-root>

dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

// ── Configuration ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const POLL_INTERVAL_MS = parseInt(
  process.env.WORKER_POLL_INTERVAL_MS ?? "30000",
  10
);
const SCORER_TIMEOUT_MS = parseInt(
  process.env.WORKER_SCORER_TIMEOUT_MS ?? "300000",
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

// ── Python scorer runner ──────────────────────────────────────────────────────

/**
 * Spawns `python3 -m scorer.run_for_customer --customer-id <id>` from the
 * repo root and waits for it to exit. Rejects on non-zero exit or timeout.
 */
function runScorer(customerId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[worker] Spawning scorer for customer ${customerId}`);

    const proc = spawn(
      "python3",
      ["-m", "scorer.run_for_customer", "--customer-id", customerId],
      {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      }
    );

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(
        new Error(
          `Scorer timed out after ${SCORER_TIMEOUT_MS / 1000}s for customer ${customerId}`
        )
      );
    }, SCORER_TIMEOUT_MS);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Scorer spawn error: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        console.log(
          `[worker] Scorer finished for customer ${customerId}. ` +
            `stdout tail: ${stdout.slice(-300)}`
        );
        resolve();
      } else {
        reject(
          new Error(
            `Scorer exited code ${code} for customer ${customerId}.\n` +
              `stderr: ${stderr.slice(-500)}`
          )
        );
      }
    });
  });
}

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
 * Claims and processes one pending scoring job.
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
    // Another worker claimed it first — skip and look for the next
    console.log(
      `[worker] Job ${job.id} already claimed by another instance — skipping`
    );
    return true; // there may be more jobs
  }

  console.log(
    `[worker] Claimed job ${job.id} | customer=${job.customer_id} | trigger=${job.trigger}`
  );

  // 3. Run scorer
  try {
    await runScorer(job.customer_id);

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
console.log("[worker] NeuralReach Scoring Worker starting");
console.log(`[worker] Repo root     : ${REPO_ROOT}`);
console.log(`[worker] Supabase URL  : ${SUPABASE_URL}`);
console.log(`[worker] Poll interval : ${POLL_INTERVAL_MS}ms`);
console.log(`[worker] Scorer timeout: ${SCORER_TIMEOUT_MS}ms`);
console.log(`[worker] Stale reset   : ${STALE_JOB_MINUTES}min`);
console.log("[worker] ─────────────────────────────────────────────────────");

// Start the first poll immediately
poll().catch((err) => {
  console.error("[worker] Fatal startup error:", err);
  process.exit(1);
});
