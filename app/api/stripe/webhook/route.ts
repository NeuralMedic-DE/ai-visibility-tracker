import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates/welcome";
import { trialEndingEmail } from "@/lib/email-templates/trial-ending";

// Tell Next.js not to parse the body — Stripe needs the raw bytes for signature verification.
export const dynamic = "force-dynamic";

// ── Helper: resolve current_period_end safely ──────────────────────────────────
//
// Stripe API ≥ 2025-01-27.acacia (we pin 2025-02-24.acacia) moved
// `current_period_end` from the Subscription root to
// `items.data[0].current_period_end`. If the field is missing or not a valid
// number, `new Date(undefined * 1000)` produces an Invalid Date whose
// `.toISOString()` throws a RangeError → 500 → Stripe retries forever.
//
// This helper reads both locations, returning null rather than throwing.
function resolveCurrentPeriodEnd(sub: Stripe.Subscription): string | null {
  // Stripe API ≥ 2025-01-27.acacia moved `current_period_end` from the
  // Subscription root to each SubscriptionItem. The TypeScript types for the
  // pinned API version (2025-02-24.acacia) may not expose the field on either
  // object, so we cast through `unknown` to read both locations safely.
  //
  // 1. Item-level (current — API ≥ 2025-01-27)
  const itemEpoch = (
    sub.items?.data?.[0] as unknown as { current_period_end?: number }
  )?.current_period_end;
  // 2. Top-level (legacy — API < 2025-01-27 / cached event objects)
  const legacyEpoch = (sub as unknown as { current_period_end?: number })
    .current_period_end;

  const epochSecs = itemEpoch ?? legacyEpoch;
  if (typeof epochSecs !== "number" || !isFinite(epochSecs)) return null;
  return new Date(epochSecs * 1000).toISOString();
}

// ── Helper: update a customers row by stripe_customer_id with sub_id fallback ─
//
// H5 fix: subscription.updated / .deleted previously matched ONLY by
// stripe_customer_id. If that column was never written (race during checkout,
// legacy row) the update touches 0 rows silently → canceled user retains access.
//
// Strategy:
//   1. Update by stripe_customer_id (primary — always present in well-formed events)
//   2. If 0 rows affected, fall back to stripe_subscription_id (the sub.id from
//      the event object itself, always reliable)
//   3. If still 0 rows, log a warning but return success (200) — returning 500
//      would cause Stripe to retry forever for a customer that genuinely doesn't
//      exist in our DB (e.g. created outside this app or already deleted).
//
// Returns true if at least one row was updated.
async function updateCustomerByStripeIds(
  supabase: ReturnType<typeof createAdminClient>,
  {
    stripeCustomerId,
    stripeSubscriptionId,
    payload,
    eventType,
  }: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    payload: Record<string, unknown>;
    eventType: string;
  }
): Promise<boolean> {
  // Attempt 1: match by stripe_customer_id
  const { data: byCustomer, error: err1 } = await supabase
    .from("customers")
    .update(payload)
    .eq("stripe_customer_id", stripeCustomerId)
    .select("id");

  if (err1) {
    // Real DB error — caller should propagate 500
    console.error(
      `[webhook] ${eventType} DB error (by customer_id):`,
      err1.message
    );
    throw new Error(err1.message);
  }

  if (byCustomer && byCustomer.length > 0) {
    return true; // happy path
  }

  // Attempt 2: fallback by stripe_subscription_id
  console.warn(
    `[webhook] ${eventType} — 0 rows matched stripe_customer_id=${stripeCustomerId}; ` +
      `trying stripe_subscription_id=${stripeSubscriptionId}`
  );

  const { data: bySubscription, error: err2 } = await supabase
    .from("customers")
    .update(payload)
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .select("id");

  if (err2) {
    console.error(
      `[webhook] ${eventType} DB error (by subscription_id):`,
      err2.message
    );
    throw new Error(err2.message);
  }

  if (bySubscription && bySubscription.length > 0) {
    return true;
  }

  // 0 rows on both attempts — log a warning but do NOT error (would cause Stripe retries)
  console.warn(
    `[webhook] ⚠️ ${eventType} — no customer row matched ` +
      `stripe_customer_id=${stripeCustomerId} OR stripe_subscription_id=${stripeSubscriptionId}. ` +
      `Possible race condition or orphaned subscription. Acknowledging to Stripe (200).`
  );
  return false;
}

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
            // H6: use helper to safely read current_period_end (guards against
            // undefined when Stripe API moves field to items level)
            currentPeriodEnd = resolveCurrentPeriodEnd(sub);
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
      //
      // H5: also fall back to stripe_subscription_id if stripe_customer_id
      //     matches 0 rows (race / missing field).
      // H6: use resolveCurrentPeriodEnd() to guard against undefined.
      // ──────────────────────────────────────────────────────────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const stripeSubscriptionId = sub.id;

        // Resolve plan from subscription metadata (set at checkout creation time)
        const plan =
          (sub.metadata?.plan as "starter" | "pro" | undefined) ?? undefined;

        // H6: guard current_period_end against undefined / Invalid Date
        const currentPeriodEnd = resolveCurrentPeriodEnd(sub);

        const updatePayload: Record<string, unknown> = {
          subscription_status: sub.status,
          updated_at: new Date().toISOString(),
        };
        if (currentPeriodEnd) updatePayload.current_period_end = currentPeriodEnd;
        if (plan) updatePayload.plan = plan;
        if (sub.trial_end) {
          updatePayload.trial_ends_at = new Date(
            sub.trial_end * 1000
          ).toISOString();
        }

        // H5: update with customer_id fallback to subscription_id
        try {
          const matched = await updateCustomerByStripeIds(supabase, {
            stripeCustomerId,
            stripeSubscriptionId,
            payload: updatePayload,
            eventType: "customer.subscription.updated",
          });

          if (matched) {
            console.log(
              `[webhook] ✅ Subscription updated for customer ${stripeCustomerId}: status=${sub.status}`
            );
          }
        } catch (dbErr) {
          console.error("[webhook] Subscription update DB error:", dbErr);
          return NextResponse.json(
            { error: "DB write failed" },
            { status: 500 }
          );
        }
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // customer.subscription.deleted — canceled / expired
      //
      // H5: also fall back to stripe_subscription_id if stripe_customer_id
      //     matches 0 rows.
      // ──────────────────────────────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const stripeSubscriptionId = sub.id;

        const cancelPayload: Record<string, unknown> = {
          subscription_status: "canceled",
          updated_at: new Date().toISOString(),
        };

        // H5: update with customer_id fallback to subscription_id
        try {
          const matched = await updateCustomerByStripeIds(supabase, {
            stripeCustomerId,
            stripeSubscriptionId,
            payload: cancelPayload,
            eventType: "customer.subscription.deleted",
          });

          if (matched) {
            console.log(
              `[webhook] ✅ Subscription canceled for customer ${stripeCustomerId}`
            );
          }
        } catch (dbErr) {
          console.error("[webhook] Subscription cancel DB error:", dbErr);
          return NextResponse.json(
            { error: "DB write failed" },
            { status: 500 }
          );
        }
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // customer.subscription.trial_will_end — fires 3 days before trial ends
      //
      // M4: send a "trial ending soon" email so the customer knows they'll be
      // billed (or can cancel). Stripe sends this event exactly once per trial.
      // ──────────────────────────────────────────────────────────────────────
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const stripeSubscriptionId = sub.id;

        // Look up the customer's email (needed to send the email)
        let email: string | null = null;

        const { data: byCustomer } = await supabase
          .from("customers")
          .select("email")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();

        if (byCustomer?.email) {
          email = byCustomer.email;
        } else {
          // Fallback by subscription ID
          const { data: bySub } = await supabase
            .from("customers")
            .select("email")
            .eq("stripe_subscription_id", stripeSubscriptionId)
            .maybeSingle();
          email = bySub?.email ?? null;
        }

        if (!email) {
          console.warn(
            `[webhook] trial_will_end — no customer row for customer_id=${stripeCustomerId} / sub_id=${stripeSubscriptionId}. Cannot send trial-ending email.`
          );
          break;
        }

        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? "https://neuralreach.de";

        // Format the trial end date in a human-readable way
        const trialEndDate = sub.trial_end
          ? new Date(sub.trial_end * 1000).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "soon";

        const tmpl = trialEndingEmail({ trialEndDate, appUrl });
        const { id: emailId, error: emailErr } = await sendEmail({
          to: email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
          replyTo: "jonas@neuralreach.de",
        });

        if (emailErr) {
          console.error("[webhook] Failed to send trial-ending email:", emailErr);
        } else {
          console.log(
            `[webhook] ✉️  Trial-ending email sent to ${email} | id=${emailId}`
          );
        }
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // invoice.paid — first payment or renewal
      //
      // M4: confirm subscription is active after successful payment.
      // This is belt-and-suspenders alongside subscription.updated; it ensures
      // that if subscription.updated is missed or delayed, the customer still
      // gets their access reinstated promptly.
      // ──────────────────────────────────────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string;
        const stripeSubscriptionId =
          (invoice.subscription as string | null) ?? "";

        // Derive period end from the invoice's first line item
        // (more reliable than invoice.period_end which covers the billing window,
        // not the subscription access window)
        const lineItemPeriodEnd = (
          invoice.lines?.data?.[0]?.period?.end
        ) as number | undefined;

        const updatePayload: Record<string, unknown> = {
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        };

        if (typeof lineItemPeriodEnd === "number" && isFinite(lineItemPeriodEnd)) {
          updatePayload.current_period_end = new Date(
            lineItemPeriodEnd * 1000
          ).toISOString();
        }

        if (stripeSubscriptionId) {
          try {
            const matched = await updateCustomerByStripeIds(supabase, {
              stripeCustomerId,
              stripeSubscriptionId,
              payload: updatePayload,
              eventType: "invoice.paid",
            });

            if (matched) {
              console.log(
                `[webhook] ✅ invoice.paid — customer ${stripeCustomerId} status set to active`
              );
            }
          } catch (dbErr) {
            console.error("[webhook] invoice.paid DB error:", dbErr);
            return NextResponse.json(
              { error: "DB write failed" },
              { status: 500 }
            );
          }
        } else {
          // One-off invoice (no subscription) — nothing to update in customers
          console.log(
            `[webhook] invoice.paid — no subscription attached to invoice ${invoice.id}; skipping customers update`
          );
        }
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // invoice.payment_failed — mark past_due (Stripe also fires sub.updated)
      // ──────────────────────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string;
        const stripeSubscriptionId =
          (invoice.subscription as string | null) ?? "";

        if (stripeSubscriptionId) {
          try {
            await updateCustomerByStripeIds(supabase, {
              stripeCustomerId,
              stripeSubscriptionId,
              payload: {
                subscription_status: "past_due",
                updated_at: new Date().toISOString(),
              },
              eventType: "invoice.payment_failed",
            });
          } catch (dbErr) {
            console.error("[webhook] invoice.payment_failed DB error:", dbErr);
            // Non-fatal: Stripe's customer.subscription.updated will also fire
          }
        }

        console.log(
          `[webhook] ⚠️ Payment failed for customer ${stripeCustomerId}`
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
