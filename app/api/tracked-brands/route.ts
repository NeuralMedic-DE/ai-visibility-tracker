import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── POST /api/tracked-brands ──────────────────────────────────────────────────
// Auth-protected. Upserts a tracked_brands row for the signed-in customer.
// Body: { brand_name, brand_url, competitors, category?, segment? }
// Returns 201 on success, 401/403/500 on error.

export async function POST(request: NextRequest) {
  // 1. Verify session
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate body
  let body: {
    brand_name?: string;
    brand_url?: string;
    competitors?: Array<{ name: string; url: string }>;
    category?: string | null;
    segment?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brand_name, brand_url, competitors = [], category, segment } = body;

  if (!brand_name?.trim()) {
    return NextResponse.json({ error: "brand_name is required" }, { status: 400 });
  }
  if (!brand_url?.trim()) {
    return NextResponse.json({ error: "brand_url is required" }, { status: 400 });
  }
  if (!Array.isArray(competitors)) {
    return NextResponse.json({ error: "competitors must be an array" }, { status: 400 });
  }
  if (competitors.length > 3) {
    return NextResponse.json({ error: "Max 3 competitors allowed" }, { status: 400 });
  }

  // 3. Look up customer row (by email — customers are keyed on email)
  const admin = createAdminClient();
  const { data: customer, error: customerErr } = await admin
    .from("customers")
    .select("id, subscription_status")
    .eq("email", user.email)
    .maybeSingle();

  if (customerErr) {
    console.error("[tracked-brands] customer lookup error:", customerErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!customer) {
    return NextResponse.json(
      { error: "No active subscription found for this account" },
      { status: 403 }
    );
  }

  // 4. Only allow active/trialing customers
  const allowed = ["trialing", "active", "past_due"];
  if (!allowed.includes(customer.subscription_status)) {
    return NextResponse.json(
      { error: "Subscription is not active" },
      { status: 403 }
    );
  }

  // 5. Upsert tracked_brands row (one per customer)
  const { error: upsertErr } = await admin
    .from("tracked_brands")
    .upsert(
      {
        customer_id: customer.id,
        brand_name: brand_name.trim(),
        brand_url: brand_url.trim(),
        competitors: competitors,
        category: category?.trim() || null,
        segment: segment?.trim() || null,
      },
      { onConflict: "customer_id" }
    );

  if (upsertErr) {
    console.error("[tracked-brands] upsert error:", upsertErr);
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// ── GET /api/tracked-brands ───────────────────────────────────────────────────
// Returns the tracked brand for the signed-in customer (if any).

export async function GET(_request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ brand: null });
  }

  const { data: brand, error } = await admin
    .from("tracked_brands")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (error) {
    console.error("[tracked-brands GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ brand });
}
