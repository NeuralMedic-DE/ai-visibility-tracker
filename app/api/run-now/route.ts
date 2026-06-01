import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerByUser } from "@/lib/customer";
import { reportError } from "@/lib/error-reporter";

// ── POST /api/run-now ─────────────────────────────────────────────────────────
// Auth-protected. Enqueues a scoring_jobs row (status=pending) for the signed-in
// customer. The always-on worker service (Railway/Fly/Render) picks up the job
// and runs the Python scorer out-of-band.
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
// Returns 202 Accepted immediately; scoring results appear on /dashboard when done.

// Per-plan monthly on-demand run caps.
// Weekly cron runs don't count against this limit (they use trigger='weekly').
const MONTHLY_ON_DEMAND_CAPS: Record<string, number> = {
  starter: 4,  // ~1/week matches "Weekly report" pitch
  pro: 8,      // generous on-demand allowance within cost budget
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

  // 3. Only allow active/trialing customers with a payment method.
  // "active"   = paying — Stripe confirmed payment method.
  // "trialing" = trial started — payment method may or may not be on file
  //              depending on checkout configuration (collect card = yes).
  // Both statuses are acceptable; past_due / canceled / none are not.
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

  // 5c. Monthly on-demand cap — count completed runs for the current month.
  // This prevents abuse via automated retry loops and keeps API costs bounded.
  // Weekly cron runs (trigger='weekly') are not counted against on-demand quota.
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
      `[run-now] Monthly cap OK: ${monthlyCount ?? 0}/${monthlyCap} runs used (${plan})`
    );
  }

  // 6. Enqueue a scoring job (trigger=manual, worker picks it up).
  //
  // Race-condition fix: the DB has a unique partial index
  //   scoring_jobs_one_active_per_customer ON scoring_jobs(customer_id)
  //   WHERE status IN ('pending', 'running')
  // so two simultaneous POSTs will only insert ONE row; the second gets
  // PG error 23505 (unique_violation) which we catch and return 429.
  const { error: jobErr } = await admin.from("scoring_jobs").insert({
    customer_id: customer.id,
    status: "pending",
    trigger: "manual",
  });

  if (jobErr) {
    if (jobErr.code === "23505") {
      // Unique violation → a concurrent request already inserted a pending job.
      // Return 429 (not 500) — this is expected under double-click or retry storms.
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

  console.info(
    `[run-now] Scoring job enqueued for customer ${customer.id} (brand: ${brand.brand_name})`
  );

  return NextResponse.json(
    {
      success: true,
      message: `Scoring queued for ${brand.brand_name}. Results will appear on your dashboard within ~5 minutes.`,
    },
    { status: 202 }
  );
}
