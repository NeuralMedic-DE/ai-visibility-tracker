import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Tell Next.js not to parse the body — Stripe needs the raw bytes for signature verification.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Read raw body as text (App Router way)
  const rawBody = await req.text();

  // 2. Get Stripe-Signature header
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    console.error("[webhook] Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET env var not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // 3. Verify signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook] Signature verification failed:", msg);
    return NextResponse.json(
      { error: `Webhook signature failed: ${msg}` },
      { status: 400 }
    );
  }

  console.log(`[webhook] Received event: ${event.type} (${event.id})`);

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      // ──────────────────────────────────────────────────────────────────────
      // checkout.session.completed — fired when a customer finishes checkout
      // (either pays immediately OR starts a free trial)
      // ──────────────────────────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const email =
          session.customer_details?.email || session.customer_email;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        const plan = (session.metadata?.plan as "starter" | "pro") ?? "starter";

        if (!email) {
          console.error(
            "[webhook] checkout.session.completed — no email found, session:",
            session.id
          );
          break;
        }

        // Retrieve subscription to get accurate status + trial dates
        let subscriptionStatus = "trialing";
        let trialEndsAt: string | null = null;
        let currentPeriodEnd: string | null = null;

        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            subscriptionStatus = sub.status;
            if (sub.trial_end) {
              trialEndsAt = new Date(sub.trial_end * 1000).toISOString();
            }
            currentPeriodEnd = new Date(
              sub.current_period_end * 1000
            ).toISOString();
          } catch (subErr) {
            console.error(
              "[webhook] Could not retrieve subscription, defaulting to trialing:",
              subErr
            );
          }
        }

        const { error: upsertErr } = await supabase
          .from("customers")
          .upsert(
            {
              email,
              stripe_customer_id: customerId ?? undefined,
              stripe_subscription_id: subscriptionId ?? undefined,
              plan,
              subscription_status: subscriptionStatus,
              trial_ends_at: trialEndsAt,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email" }
          );

        if (upsertErr) {
          console.error("[webhook] DB upsert failed:", upsertErr);
          // Return 500 so Stripe retries
          return NextResponse.json(
            { error: "DB write failed" },
            { status: 500 }
          );
        }

        console.log(
          `[webhook] ✅ Customer ${email} → plan=${plan}, status=${subscriptionStatus}`
        );
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // customer.subscription.updated — trial → active, active → past_due, etc.
      // ──────────────────────────────────────────────────────────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        // Resolve plan from subscription metadata (set at checkout creation time)
        const plan =
          (sub.metadata?.plan as "starter" | "pro" | undefined) ?? undefined;

        const updatePayload: Record<string, unknown> = {
          subscription_status: sub.status,
          current_period_end: new Date(
            sub.current_period_end * 1000
          ).toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (plan) updatePayload.plan = plan;
        if (sub.trial_end) {
          updatePayload.trial_ends_at = new Date(
            sub.trial_end * 1000
          ).toISOString();
        }

        const { error: updateErr } = await supabase
          .from("customers")
          .update(updatePayload)
          .eq("stripe_customer_id", customerId);

        if (updateErr) {
          console.error("[webhook] Subscription update DB error:", updateErr);
          return NextResponse.json(
            { error: "DB write failed" },
            { status: 500 }
          );
        }

        console.log(
          `[webhook] ✅ Subscription updated for customer ${customerId}: status=${sub.status}`
        );
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // customer.subscription.deleted — canceled / expired
      // ──────────────────────────────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { error: cancelErr } = await supabase
          .from("customers")
          .update({
            subscription_status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        if (cancelErr) {
          console.error("[webhook] Subscription cancel DB error:", cancelErr);
          return NextResponse.json(
            { error: "DB write failed" },
            { status: 500 }
          );
        }

        console.log(
          `[webhook] ✅ Subscription canceled for customer ${customerId}`
        );
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // invoice.payment_failed — mark past_due (Stripe also fires sub.updated)
      // ──────────────────────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await supabase
          .from("customers")
          .update({
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        console.log(
          `[webhook] ⚠️ Payment failed for customer ${customerId}`
        );
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[webhook] Unhandled error in event handler:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
