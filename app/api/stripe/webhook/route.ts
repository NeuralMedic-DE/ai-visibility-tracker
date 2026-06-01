import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates/welcome";

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

  // ── Idempotency gate ──────────────────────────────────────────────────────
  // Stripe may deliver the same event more than once (network retries,
  // Stripe's at-least-once guarantee). We INSERT the event_id as a primary
  // key into stripe_events before doing any work. Two outcomes:
  //   • Success (new row) → proceed with handler logic below.
  //   • PG error 23505 (unique violation) → already processed; ack and exit.
  //   • Any other DB error → return 500 so Stripe retries later.
  //
  // This is the primary replay defence. The welcome_email_id IS NULL guard
  // below is belt-and-suspenders for the edge case where a prior run sent
  // the email but crashed before writing the ID back.
  const { error: idempotencyErr } = await supabase
    .from("stripe_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (idempotencyErr) {
    if (idempotencyErr.code === "23505") {
      // Duplicate — this event was already processed successfully.
      console.log(`[webhook] Duplicate event ${event.id} (${event.type}) — no-op`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Unexpected DB error — let Stripe retry.
    console.error("[webhook] Idempotency insert error:", idempotencyErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  try {
    switch (event.type) {
      // ──────────────────────────────────────────────────────────────────────
      // checkout.session.completed — fired when a customer finishes checkout
      // (either pays immediately OR starts a free trial)
      // ──────────────────────────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // H4 — normalize email once at source so every downstream usage
        // (DB upserts, email sends, log lines) is guaranteed lowercase+trimmed.
        // Stripe can return mixed-case from customer_details.email when the
        // buyer types their address in the Stripe Checkout form.
        const emailRaw =
          session.customer_details?.email || session.customer_email;
        const email = emailRaw ? emailRaw.trim().toLowerCase() : null;

        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        const plan = (session.metadata?.plan as "starter" | "pro") ?? "starter";

        // client_reference_id is the Supabase auth user UUID (set by /api/checkout
        // when the user is authenticated before checkout). May be null for legacy
        // sessions created before the register-first flow was deployed.
        const supabaseUserId =
          (session.client_reference_id as string | null) ?? null;

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

        // ── Upsert strategy ────────────────────────────────────────────────
        // New flow (supabaseUserId present): register-first, bind by UUID.
        //   Step A: if a legacy row exists for this email without a user_id,
        //           bind the user_id now (handles customers who existed before
        //           this migration).
        //   Step B: upsert by user_id (immutable — survives email changes).
        //
        // Legacy flow (no supabaseUserId): fall back to email-keyed upsert.
        // ──────────────────────────────────────────────────────────────────

        let upsertErr: { message: string } | null = null;

        if (supabaseUserId) {
          // Step A: bind user_id to any existing email-only row
          const { error: bindErr } = await supabase
            .from("customers")
            .update({ user_id: supabaseUserId })
            .eq("email", email)
            .is("user_id", null);

          if (bindErr) {
            // Non-fatal; row may not exist yet — that's fine, step B will insert
            console.warn("[webhook] Step-A bind warning:", bindErr.message);
          }

          // Step B: upsert by user_id (conflict on customers_user_id_unique index)
          const { error } = await supabase
            .from("customers")
            .upsert(
              {
                user_id: supabaseUserId,
                email,
                stripe_customer_id: customerId ?? undefined,
                stripe_subscription_id: subscriptionId ?? undefined,
                plan,
                subscription_status: subscriptionStatus,
                trial_ends_at: trialEndsAt,
                current_period_end: currentPeriodEnd,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" }
            );
          upsertErr = error;
        } else {
          // Legacy fallback: upsert by email
          const { error } = await supabase
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
          upsertErr = error;
        }

        if (upsertErr) {
          console.error("[webhook] DB upsert failed:", upsertErr);
          // Return 500 so Stripe retries
          return NextResponse.json(
            { error: "DB write failed" },
            { status: 500 }
          );
        }

        console.log(
          `[webhook] ✅ Customer ${email} (user_id=${supabaseUserId ?? "legacy"}) → plan=${plan}, status=${subscriptionStatus}`
        );

        // ── Send welcome email ─────────────────────────────────────────────
        // Guard: only send if welcome_email_id IS NULL in the customers row.
        //
        // Primary replay protection is the stripe_events idempotency table
        // above. This IS NULL check is belt-and-suspenders for the edge case
        // where a prior invocation sent the email successfully but crashed
        // before the welcome_email_id write-back completed. Without this
        // guard that edge case would silently re-send the email.
        //
        // FROM: NeuralReach <hello@mail.neuralreach.de>  (transactional subdomain)
        // ReplyTo: jonas@neuralreach.de  (founder inbox — "CEO email" pattern)

        const custLookupQ = supabaseUserId
          ? supabase
              .from("customers")
              .select("welcome_email_id")
              .eq("user_id", supabaseUserId)
              .single()
          : supabase
              .from("customers")
              .select("welcome_email_id")
              .eq("email", email)
              .single();

        const { data: custRow, error: custLookupErr } = await custLookupQ;

        if (custLookupErr) {
          // Shouldn't happen — we just upserted. Log and attempt the send anyway
          // rather than silently skipping the welcome email.
          console.warn("[webhook] Could not fetch customer row for email guard:", custLookupErr);
        }

        if (custRow?.welcome_email_id) {
          // welcome_email_id already recorded → email was sent in a previous run.
          console.log(
            `[webhook] Welcome email already sent to ${email} (id=${custRow.welcome_email_id}) — skipping`
          );
        } else {
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL ?? "https://neuralreach.de";
          const tmpl = welcomeEmail({ appUrl });
          const { id: welcomeEmailId, error: emailErr } = await sendEmail({
            to: email,
            subject: tmpl.subject,
            html: tmpl.html,
            text: tmpl.text,
            replyTo: "jonas@neuralreach.de",
          });

          if (emailErr) {
            // Don't fail the webhook for an email error — log and continue.
            console.error("[webhook] Failed to send welcome email:", emailErr);
          } else {
            console.log(
              `[webhook] ✉️  Welcome email sent to ${email} | id=${welcomeEmailId}`
            );

            // Persist message_id in customers row (best-effort).
            // Subsequent replays use this to skip the send.
            if (welcomeEmailId) {
              const updateQuery = supabaseUserId
                ? supabase
                    .from("customers")
                    .update({ welcome_email_id: welcomeEmailId })
                    .eq("user_id", supabaseUserId)
                : supabase
                    .from("customers")
                    .update({ welcome_email_id: welcomeEmailId })
                    .eq("email", email);

              const { error: updateEmailIdErr } = await updateQuery;
              if (updateEmailIdErr) {
                console.warn(
                  "[webhook] Could not write welcome_email_id:",
                  updateEmailIdErr
                );
              }
            }
          }
        }
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
