import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerByUser } from "@/lib/customer";
import { reportError } from "@/lib/error-reporter";
import { scoreForCustomer } from "@/lib/scorer";

// ── POST /api/run-now ─────────────────────────────────────────────────────────
// Auth-protected. Runs the TypeScript scorer inline for the signed-in customer.
//
// This endpoint NO LONGER uses a Python subprocess or an async job queue.
// Scoring runs synchronously in the Vercel function using the TypeScript scorer
// (lib/scorer.ts), which calls OpenAI / Anthropic / Perplexity / SerpAPI via
// fetch() in parallel.
//
// Guards (in order):
//   1. Auth session required
//   2. Active/trialing subscription required
//   3. Tracked brand required
//   4a. No "running" job in last 12h (prevents concurrent execution).
//       If a "pending" job exists, it is PICKED UP and processed here rather
//       than rejected — there is no background worker in production.
//   4b. No completed run in last 12h (customer_scoring_runs table)
//   5. Monthly on-demand cap (starter=4, pro=8 completed runs/month)
//   6. DB INSERT with unique-partial-index on (customer_id) WHERE status IN
//      ('pending','running') — conflicts return 429 instead of 500.
//
// Returns 200 with the AVS score object on success.
// scoring_jobs row is kept in sync so ScanProgress polling works.

// Allow up to 5 minutes — scoring 25–100 prompts × 4 LLMs takes 30–90s.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Per-plan monthly on-demand run caps.
// Weekly cron runs don't count against this limit (they use trigger='weekly').
const MONTHLY_ON_DEMAND_CAPS: Record<string, number> = {
  starter: 4, // ~1/week matches "Weekly report" pitch
  pro: 8, // generous on-demand allowance within cost budget
};

export async function POST(_request: NextRequest) {
  // 1. Verify session
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Load customer by user_id (with lazy-link fallback for legacy rows)
  const customer = await getCustomerByUser(
    user.id,
    user.email,
    "id, subscription_status, plan, stripe_subscription_id"
  );

  if (!customer) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 403 }
    );
  }

  // 3. Only allow active/trialing customers.
  const allowedStatuses = ["trialing", "active"];
  if (!allowedStatuses.includes(customer.subscription_status)) {
    return NextResponse.json(
      {
        error: `Subscription status '${customer.subscription_status}' does not allow scoring. An active or trialing subscription is required.`,
      },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // 4. Check that a tracked brand exists
  const { data: brand } = await admin
    .from("tracked_brands")
    .select("id, brand_name")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json(
      { error: "No tracked brand found. Please add your brand first." },
      { status: 400 }
    );
  }

  // 5. Rate limit — max 1 run per 12 hours
  const twelveHoursAgo = new Date(
    Date.now() - 12 * 60 * 60 * 1000
  ).toISOString();

  // 5a. Block if there's already an active (pending or running) job.
  //
  //     NOTE: No time filter here — the unique partial index on scoring_jobs
  //     (customer_id) WHERE status IN ('pending','running') means there can only
  //     be ONE active job at a time regardless of age.  If we only looked at
  //     recent jobs and missed a stuck "running" job from 13h ago, the unique
  //     index would block a new insert with a confusing 23505 error.
  const { data: activeJob } = await admin
    .from("scoring_jobs")
    .select("id, status, created_at, started_at")
    .eq("customer_id", customer.id)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Stale-job threshold: if a "running" job was claimed longer ago than this,
  // the Vercel function that owned it has almost certainly died (Vercel kills
  // functions on connection drop or hard timeout).  Reset it so we can reclaim.
  const STALE_RUNNING_MS = 15 * 60 * 1_000; // 15 minutes

  // If a job is actively running, block to prevent concurrent execution.
  // If a job is still "pending" (no background worker picked it up), take it
  // over and process it inline — run-now IS the processor in this deployment.
  // If a "running" job is stale (> 15 min), the owning function died — reset
  // it to "pending" and reclaim it so the retry button always eventually works.
  let pendingJobId: string | null = null;
  if (activeJob) {
    if (activeJob.status === "running") {
      const startTime = activeJob.started_at
        ? new Date(activeJob.started_at).getTime()
        : new Date(activeJob.created_at).getTime();
      const msRunning = Date.now() - startTime;

      if (msRunning > STALE_RUNNING_MS) {
        // Stale running job — the Vercel function that claimed it has died.
        // Reset to "pending" with an optimistic guard (only update if still "running").
        console.info(
          `[run-now] Recovering stale job ${activeJob.id} ` +
          `(running for ${Math.round(msRunning / 60_000)} min) ` +
          `for customer ${customer.id}`
        );
        await admin
          .from("scoring_jobs")
          .update({ status: "pending", started_at: null })
          .eq("id", activeJob.id)
          .eq("status", "running"); // only reset if still in "running" state
        pendingJobId = activeJob.id;
      } else {
        return NextResponse.json(
          {
            error: "Scoring is already in progress. Please check back shortly.",
            job_status: "running",
          },
          { status: 429 }
        );
      }
    } else {
      // status === "pending": pick up and process this job inline.
      console.info(
        `[run-now] Picking up pending job ${activeJob.id} for customer ${customer.id}`
      );
      pendingJobId = activeJob.id;
    }
  }

  // 5b. Block if a completed run was created within the last 12 hours
  const { data: recentRun } = await admin
    .from("customer_scoring_runs")
    .select("id, created_at")
    .eq("customer_id", customer.id)
    .gte("created_at", twelveHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentRun) {
    const retryAfter = new Date(recentRun.created_at);
    retryAfter.setHours(retryAfter.getHours() + 12);
    return NextResponse.json(
      {
        error: "Rate limited: max 1 scoring run per 12 hours",
        retry_after: retryAfter.toISOString(),
      },
      { status: 429 }
    );
  }

  // 5c. Monthly on-demand cap
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: monthlyCount, error: countErr } = await admin
    .from("customer_scoring_runs")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id)
    .gte("created_at", startOfMonth);

  if (countErr) {
    reportError(countErr, {
      route: "run-now",
      step: "monthly_count",
      customerId: customer.id,
    });
    // Non-fatal: allow the run rather than blocking on a count failure
  } else {
    const plan = customer.plan ?? "starter";
    const monthlyCap =
      MONTHLY_ON_DEMAND_CAPS[plan] ?? MONTHLY_ON_DEMAND_CAPS["starter"];
    if ((monthlyCount ?? 0) >= monthlyCap) {
      return NextResponse.json(
        {
          error: `Monthly on-demand limit reached (${monthlyCap} runs for ${plan} plan). Resets on the 1st of next month. Upgrade to Pro for a higher limit.`,
          monthly_cap: monthlyCap,
          used: monthlyCount,
          plan,
        },
        { status: 429 }
      );
    }
    console.info(
      `[run-now] Monthly cap OK: ${monthlyCount ?? 0}/${monthlyCap} runs used (${customer.plan ?? "starter"})`
    );
  }

  // 6. Use the existing pending job (picked up above) or insert a new one.
  //    Race-condition fix: unique partial index prevents concurrent double-submit.
  let jobId: string | undefined = pendingJobId ?? undefined;

  if (!jobId) {
    const { data: jobRow, error: jobErr } = await admin
      .from("scoring_jobs")
      .insert({
        customer_id: customer.id,
        status: "pending",
        trigger: "manual",
      })
      .select("id")
      .single();

    if (jobErr) {
      if (jobErr.code === "23505") {
        console.warn(
          `[run-now] Duplicate job insert blocked (23505) for customer ${customer.id}`
        );
        return NextResponse.json(
          {
            error:
              "A scoring job is already queued. Please wait for it to complete.",
            job_status: "pending",
          },
          { status: 429 }
        );
      }
      reportError(jobErr, {
        route: "run-now",
        step: "scoring_jobs_insert",
        customerId: customer.id,
      });
      return NextResponse.json(
        { error: "Failed to queue scoring job. Please try again." },
        { status: 500 }
      );
    }
    jobId = jobRow?.id as string | undefined;
  }

  // 7. Mark job as running
  if (jobId) {
    await admin
      .from("scoring_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  console.info(
    `[run-now] Starting inline TypeScript scorer for customer ${customer.id} (brand: ${brand.brand_name})`
  );

  // 8. Run the TypeScript scorer inline — no Python subprocess, no file I/O.
  //    scoreForCustomer loads customer data, queries LLMs in parallel, and
  //    writes results to customer_scoring_runs.
  try {
    const result = await scoreForCustomer(customer.id, admin);

    // 9a. Mark job done
    if (jobId) {
      await admin
        .from("scoring_jobs")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    // 9b. Update tracked_brands.last_scored_at for UI display
    await admin
      .from("tracked_brands")
      .update({ last_scored_at: new Date().toISOString() })
      .eq("customer_id", customer.id);

    console.info(
      `[run-now] ✅ Scoring complete for customer ${customer.id}: AVS=${result.avsBrand}/100`
    );

    return NextResponse.json({
      success: true,
      avs_brand: result.avsBrand,
      per_llm: result.perLlm,
      gap_prompts: result.gapPrompts,
      prompt_count: result.promptCount,
      estimated_cost_usd: result.estimatedCostUsd,
      run_date: result.runDate,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[run-now] ❌ Scoring failed for customer ${customer.id}: ${errMsg}`
    );

    // Mark job failed
    if (jobId) {
      await admin
        .from("scoring_jobs")
        .update({
          status: "failed",
          error: errMsg.slice(0, 1000),
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    reportError(err instanceof Error ? err : new Error(errMsg), {
      route: "run-now",
      step: "scorer",
      customerId: customer.id,
    });

    return NextResponse.json(
      { error: `Scoring failed: ${errMsg.slice(0, 200)}` },
      { status: 500 }
    );
  }
}
