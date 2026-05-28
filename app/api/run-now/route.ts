import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spawn } from "child_process";
import path from "path";

// ── POST /api/run-now ─────────────────────────────────────────────────────────
// Auth-protected. Triggers run_for_customer.py for the signed-in customer.
// Rate limit: 1 run per customer per 12 hours.
// Returns 202 Accepted immediately; scoring runs in background subprocess.

export async function POST(_request: NextRequest) {
  // 1. Verify session
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Load customer
  const admin = createAdminClient();
  const { data: customer, error: customerErr } = await admin
    .from("customers")
    .select("id, subscription_status, plan")
    .eq("email", user.email)
    .maybeSingle();

  if (customerErr || !customer) {
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

  // 6. Fire-and-forget: spawn Python scorer subprocess
  //    We run from the workspace root so relative imports work.
  const workspaceRoot = path.resolve(process.cwd());

  try {
    const proc = spawn(
      "python3",
      ["-m", "scorer.run_for_customer", "--customer-id", customer.id],
      {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
        cwd: workspaceRoot,
        env: {
          ...process.env,
          // Ensure Python can find .env.local values
          PYTHONUNBUFFERED: "1",
        },
      }
    );
    proc.unref();
  } catch (spawnErr) {
    console.error("[run-now] Failed to spawn scorer subprocess:", spawnErr);
    // Don't fail the request — the subprocess attempt is best-effort for now.
    // In production this would queue a job. Log and continue.
  }

  return NextResponse.json(
    {
      success: true,
      message: `Scoring started for ${brand.brand_name}`,
    },
    { status: 202 }
  );
}
