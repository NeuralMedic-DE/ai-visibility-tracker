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
//   4a. No active/pending job in last 12h (scoring_jobs table)
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

  // 5a. Block if there's already a pending or running job in the queue
  const { data: activeJob } = await admin
    .from("scoring_jobs")
    .select("id, status, created_at")
    .eq("customer_id", customer.id)
    .in("status", ["pending", "running"])
    .gte("created_at", twelveHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeJob) {
    return NextResponse.json(
      {
        error:
          activeJob.status === "running"
            ? "Scoring is already in progress. Please check back shortly."
            : "A scoring job is already queued. Please wait a few minutes.",
        job_status: activeJob.status,
      },
      { status: 429 }
    );
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

  // 6. Insert a scoring_jobs row (status=pending).
  //    Race-condition fix: unique partial index prevents concurrent double-submit.
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

  const jobId = jobRow?.id as string | undefined;

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
