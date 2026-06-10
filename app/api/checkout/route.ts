import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

type PlanKey = keyof typeof PLANS;

export async function POST(req: NextRequest) {
  // ── 0. Server-side subscriptions gate ─────────────────────────────────────
  // Mirror the same flag check used by the pricing page UI.
  // Prevents direct-POST bypass when the storefront shows "Notify me" buttons.
  const flagOn = process.env.SUBSCRIPTIONS_LIVE === "true";
  const dateReached = new Date().toISOString().slice(0, 10) >= "2026-06-04";
  if (!flagOn || !dateReached) {
    return NextResponse.json(
      { error: "Subscriptions are not yet open." },
      { status: 403 }
    );
  }

  // ── 1. Require an authenticated session ────────────────────────────────────
  // Users must register/log in before subscribing so we can bind their
  // Supabase user_id (immutable UUID) to the Stripe customer record.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json(
      { error: "Please sign in before subscribing." },
      { status: 401 }
    );
  }

  // ── 2. Validate plan ───────────────────────────────────────────────────────
  let plan: PlanKey;
  try {
    const body = await req.json();
    plan = body?.plan as PlanKey;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!plan || !["starter", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const selectedPlan = PLANS[plan];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // ── 3. Create Stripe Checkout session ─────────────────────────────────────
  // client_reference_id = auth user UUID → webhook writes this to customers.user_id
  // customer_email      = pre-fills the Stripe checkout form
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      // Bind auth identity so the webhook can link by UUID, not email
      client_reference_id: user.id,
      customer_email: user.email,
      success_url: `${appUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: {
        plan,
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          plan,
          supabase_user_id: user.id,
        },
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("[checkout] Error creating session:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
