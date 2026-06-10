import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerByUser } from "@/lib/customer";
import { reportError, reportMessage } from "@/lib/error-reporter";
import { scoreForCustomer } from "@/lib/scorer";

// ── POST /api/onboarding ──────────────────────────────────────────────────────
// Auth-protected. Saves brand info for a newly-onboarding customer, runs the
// TypeScript scorer inline (same as /api/run-now), and redirects to /dashboard.
//
// Scoring runs synchronously in this Vercel function — no worker service needed.
// maxDuration = 300 gives up to 5 minutes, which is enough for 25–100 prompts
// across 4 LLMs (~30–90s in practice). The client shows a "Setting up…" spinner
// while the function runs, then receives the redirect to /dashboard with results
// already available.
//
// Request body:
//   brand_name        string   required
//   domain            string   required  (bare domain or full URL)
//   competitor_domains string[] optional  max 3 items
//
// Success response: { success: true, redirect: '/dashboard' }
// Error responses:  401 | 400 | 403 | 500 with { error: string }

// Allow up to 5 minutes — scoring 25–100 prompts × 4 LLMs takes 30–90s.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // ── 1. Verify auth session ─────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse request body ──────────────────────────────────────────────────
  let body: {
    brand_name?: string;
    domain?: string;
    competitor_domains?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brand_name, domain, competitor_domains } = body;

  // ── 3. Validate inputs ─────────────────────────────────────────────────────
  if (!brand_name?.trim()) {
    return NextResponse.json(
      { error: "brand_name is required" },
      { status: 400 }
    );
  }
  if (!domain?.trim()) {
    return NextResponse.json(
      { error: "domain is required" },
      { status: 400 }
    );
  }
  if (competitor_domains !== undefined && !Array.isArray(competitor_domains)) {
    return NextResponse.json(
      { error: "competitor_domains must be an array" },
      { status: 400 }
    );
  }

  const rawCompetitors: string[] = Array.isArray(competitor_domains)
    ? competitor_domains
    : [];

  if (rawCompetitors.length > 3) {
    return NextResponse.json(
      { error: "Max 3 competitor domains allowed" },
      { status: 400 }
    );
  }

  // Validate each competitor entry is a string
  for (const c of rawCompetitors) {
    if (typeof c !== "string") {
      return NextResponse.json(
        { error: "Each competitor_domain must be a string" },
        { status: 400 }
      );
    }
  }

  // ── 4. Normalise URLs ──────────────────────────────────────────────────────
  const normaliseDomain = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  };

  const normalisedDomain = normaliseDomain(domain);
  const normalisedCompetitors = rawCompetitors
    .map((d) => d.trim())
    .filter(Boolean)
    .map(normaliseDomain);

  // ── 5. Look up customer row by user_id (lazy-link fallback for legacy rows) ─
  const customer = await getCustomerByUser(
    user.id,
    user.email,
    "id, subscription_status"
  );

  if (!customer) {
    return NextResponse.json(
      { error: "No subscription found for this account. Please subscribe first." },
      { status: 403 }
    );
  }

  // Only allow customers with an active/trialing/past_due subscription
  const allowedStatuses = ["trialing", "active", "past_due"];
  if (!allowedStatuses.includes(customer.subscription_status)) {
    return NextResponse.json(
      {
        error: `Subscription status '${customer.subscription_status}' does not allow onboarding. Please activate a subscription first.`,
      },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // ── 6. Upsert tracked_brands (one row per customer) ────────────────────────
  // competitor_domains are stored as a JSON array of bare domain strings.
  // The scorer will normalise them further when constructing BrandProfile.
  const { error: brandErr } = await admin.from("tracked_brands").upsert(
    {
      customer_id: customer.id,
      brand_name: brand_name.trim(),
      brand_url: normalisedDomain,
      // Store competitor domains as [{name: "", url: "https://..."} ] so the
      // existing scorer schema is satisfied (it expects {name, url} objects).
      competitors: normalisedCompetitors.map((url) => ({ name: "", url })),
      last_scored_at: null,
    },
    { onConflict: "customer_id" }
  );

  if (brandErr) {
    reportError(brandErr, {
      route: "onboarding",
      step: "tracked_brands_upsert",
      customerId: customer.id,
    });
    return NextResponse.json({ error: brandErr.message }, { status: 500 });
  }

  // ── 7. Insert a scoring_jobs row (status = pending) ────────────────────────
  // Non-fatal: if this fails we still redirect the user to /dashboard.
  //
  // 23505 unique_violation: the unique partial index
  //   scoring_jobs_one_active_per_customer ON scoring_jobs(customer_id)
  //   WHERE status IN ('pending','running')
  // prevents a double-submit (e.g. form submit twice) from creating two
  // concurrent scorer processes. Treat this as success — a job is already queued.
  const { error: jobErr } = await admin.from("scoring_jobs").insert({
    customer_id: customer.id,
    status: "pending",
    trigger: "onboarding",
  });

  if (jobErr) {
    if (jobErr.code === "23505") {
      // Unique violation: a concurrent submission already queued a job. Treat as success.
      console.info(
        `[onboarding] scoring_jobs duplicate blocked (23505) for customer ${customer.id} — job already queued`
      );
    } else {
      // Job insert failed for an unexpected reason. The brand was saved, so we
      // still redirect the user to /dashboard, but we surface the error so it
      // can be investigated (previously this was silently swallowed).
      reportError(jobErr, {
        route: "onboarding",
        step: "scoring_jobs_insert",
        customerId: customer.id,
        note: "Brand saved but scoring job was NOT queued — user will see spinner with no scan",
      });
      reportMessage(
        `Scoring job not queued for customer ${customer.id} after onboarding (${jobErr.message})`,
        "error",
        { route: "onboarding", customerId: customer.id }
      );
    }
  }

  // ── 8. Run the TypeScript scorer inline (no worker service required) ───────
  // We claim the pending job, run scoreForCustomer() synchronously, and update
  // the job status — the same pattern used by /api/run-now and /api/cron/weekly.
  // maxDuration = 300 (set above) gives enough headroom even for Pro plans.
  //
  // Retrieve the job id we just inserted so we can update its status.
  const { data: jobRow } = await admin
    .from("scoring_jobs")
    .select("id")
    .eq("customer_id", customer.id)
    .in("status", ["pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const jobId: string | null = jobRow?.id ?? null;

  // Mark the job as running before we start
  if (jobId) {
    await admin
      .from("scoring_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  console.info(
    `[onboarding] Starting inline TypeScript scorer for customer ${customer.id}`
  );

  try {
    await scoreForCustomer(customer.id, admin);

    // Mark job done
    if (jobId) {
      await admin
        .from("scoring_jobs")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    // Update tracked_brands.last_scored_at so dashboard shows a fresh timestamp
    await admin
      .from("tracked_brands")
      .update({ last_scored_at: new Date().toISOString() })
      .eq("customer_id", customer.id);

    console.info(
      `[onboarding] ✅ Initial scoring complete for customer ${customer.id}`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[onboarding] ❌ Initial scoring failed for customer ${customer.id}: ${errMsg}`
    );

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

    // Non-fatal: report the error but still redirect to /dashboard so the
    // user is not stuck. They can click "Run Now" to retry.
    reportError(err instanceof Error ? err : new Error(errMsg), {
      route: "onboarding",
      step: "inline_scorer",
      customerId: customer.id,
      note: "Initial scan failed — user redirected to /dashboard, can retry via Run Now",
    });
  }

  // ── 9. Respond with redirect target ───────────────────────────────────────
  return NextResponse.json(
    { success: true, redirect: "/dashboard" },
    { status: 201 }
  );
}
