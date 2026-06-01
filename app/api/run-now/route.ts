import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerByUser } from "@/lib/customer";

// ── POST /api/run-now ─────────────────────────────────────────────────────────
// Auth-protected. Enqueues a scoring_jobs row (status=pending) for the signed-in
// customer. The always-on worker service (Railway/Fly/Render) picks up the job
// and runs the Python scorer out-of-band.
//
// Rate limit: 1 run per customer per 12 hours.
// Returns 202 Accepted immediately; scoring results appear on /dashboard when done.

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
    "id, subscription_status, plan"
  );

  if (!customer) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 403 }
    );
  }

  // 3. Only allow active/trialing customers
  const allowedStatuses = ["trialing", "active"];
  if (!allowedStatuses.includes(customer.subscription_status)) {
    return NextResponse.json(
      { error: "Subscription must be active or trialing to run scoring" },
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

  // 6. Enqueue a scoring job (trigger=manual, worker picks it up)
  const { error: jobErr } = await admin.from("scoring_jobs").insert({
    customer_id: customer.id,
    status: "pending",
    trigger: "manual",
  });

  if (jobErr) {
    console.error("[run-now] Failed to insert scoring_jobs row:", jobErr);
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
