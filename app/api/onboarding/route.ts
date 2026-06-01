import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spawn } from "child_process";
import path from "path";

// ── POST /api/onboarding ──────────────────────────────────────────────────────
// Auth-protected. Saves brand info for a newly-onboarding customer, queues a
// scoring job, and fires off the scorer subprocess immediately (best-effort).
//
// Request body:
//   brand_name        string   required
//   domain            string   required  (bare domain or full URL)
//   competitor_domains string[] optional  max 3 items
//
// Success response: { success: true, redirect: '/dashboard' }
// Error responses:  401 | 400 | 403 | 500 with { error: string }

export async function POST(request: NextRequest) {
  // ── 1. Verify auth session ─────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
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

  // ── 5. Look up customer row ────────────────────────────────────────────────
  const admin = createAdminClient();
  const { data: customer, error: customerErr } = await admin
    .from("customers")
    .select("id, subscription_status")
    .eq("email", user.email)
    .maybeSingle();

  if (customerErr) {
    console.error("[onboarding] customer lookup error:", customerErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

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
    console.error("[onboarding] tracked_brands upsert error:", brandErr);
    return NextResponse.json({ error: brandErr.message }, { status: 500 });
  }

  // ── 7. Insert a scoring_jobs row (status = pending) ────────────────────────
  // Non-fatal: if this fails we still want the user to proceed to /dashboard.
  const { error: jobErr } = await admin.from("scoring_jobs").insert({
    customer_id: customer.id,
    status: "pending",
  });

  if (jobErr) {
    console.warn("[onboarding] scoring_jobs insert warning:", jobErr.message);
  }

  // ── 8. Fire-and-forget scorer subprocess ──────────────────────────────────
  // Best-effort: spawn the Python scorer in the background so the user sees
  // results as quickly as possible. The subprocess writes to
  // customer_scoring_runs when it completes. If it fails, the pending
  // scoring_jobs row can be picked up by the weekly cron.
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
          PYTHONUNBUFFERED: "1",
        },
      }
    );
    proc.unref();
    console.info(
      `[onboarding] scorer subprocess spawned for customer ${customer.id}`
    );
  } catch (spawnErr) {
    // Non-fatal — the pending scoring_jobs row will be picked up by cron.
    console.warn("[onboarding] scorer spawn warning:", spawnErr);
  }

  // ── 9. Respond with redirect target ───────────────────────────────────────
  return NextResponse.json(
    { success: true, redirect: "/dashboard" },
    { status: 201 }
  );
}
