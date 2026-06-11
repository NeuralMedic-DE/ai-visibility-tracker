import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { waitlistConfirmEmail } from "@/lib/email-templates/waitlist-confirm";
import fs from "fs";
import path from "path";

// ── Local dev fallback ────────────────────────────────────────────────────────
// When the Supabase waitlist table hasn't been created yet (schema not applied),
// this writes sign-ups to data/waitlist-local.json so you never lose leads.
// In production (NODE_ENV=production), this fallback is skipped entirely.

function saveLocalFallback(
  email: string,
  brand_interest: string | null,
  interested_plan: string | null
) {
  if (process.env.NODE_ENV === "production") return;
  try {
    const filePath = path.join(process.cwd(), "data", "waitlist-local.json");
    const existing: Array<{
      email: string;
      brand_interest: string | null;
      interested_plan: string | null;
      signed_up_at: string;
    }> = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
      : [];
    // dedupe
    if (!existing.find((e) => e.email === email)) {
      existing.push({ email, brand_interest, interested_plan, signed_up_at: new Date().toISOString() });
      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
    }
    console.log("[waitlist] Saved to local fallback:", email);
  } catch (err) {
    console.error("[waitlist] Local fallback write error:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, brand_interest, interested_plan } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedBrand = brand_interest?.trim() || null;
    // Only store known plan values; discard anything unexpected
    const normalizedPlan =
      interested_plan === "starter" || interested_plan === "pro"
        ? interested_plan
        : null;

    const supabase = createAdminClient();

    const { error } = await supabase.from("waitlist").upsert(
      {
        email: normalizedEmail,
        brand_interest: normalizedBrand,
        interested_plan: normalizedPlan,
        signed_up_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    if (error) {
      console.error("[waitlist] Supabase error:", error.message, error.code);

      // If the table doesn't exist yet (schema not applied), use local fallback in dev
      // PGRST205 = PostgREST table not found in schema cache
      // 42P01    = PostgreSQL "undefined_table" error
      if (
        process.env.NODE_ENV !== "production" &&
        (error.code === "PGRST205" ||
          error.code === "42P01" ||
          error.message?.includes("does not exist") ||
          error.message?.includes("schema cache"))
      ) {
        saveLocalFallback(normalizedEmail, normalizedBrand, normalizedPlan);
        return NextResponse.json(
          {
            success: true,
            _dev_note:
              "Supabase table not found — saved to data/waitlist-local.json. Apply supabase/migrations/0001_init.sql to fix.",
          },
          { status: 201 }
        );
      }

      return NextResponse.json(
        { error: "Failed to join waitlist. Please try again." },
        { status: 500 }
      );
    }

    // Fire-and-await the confirmation email. We don't fail the signup if
    // Resend hiccups — the row is already in the DB, so the lead is safe.
    // But we DO log the result so /api/health/email and the QA sweep can
    // distinguish "no signup" from "signup but email broken".
    try {
      const appUrl = appUrlForSuccessRedirect(req);
      const { subject, html, text } = waitlistConfirmEmail({
        appUrl,
        brandInterest: normalizedBrand,
        interestedPlan: normalizedPlan,
      });
      const result = await sendEmail({
        to: normalizedEmail,
        subject,
        html,
        text,
        replyTo: "jonas@neuralreach.de",
      });
      if (result.error) {
        console.error("[waitlist] confirmation email failed:", result.error);
      } else {
        console.log(`[waitlist] confirmation email sent: id=${result.id}`);
      }
    } catch (emailErr) {
      // Defensive: any throw from the email path must NOT break the 201 to the user.
      console.error("[waitlist] email pipeline threw (signup still succeeded):", emailErr);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[waitlist] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Resolve the canonical app URL for links inside emails. Mirrors the logic
 * in app/api/checkout/route.ts so the leaderboard link in the confirmation
 * email never points at http://localhost:3000 in production.
 */
function appUrlForSuccessRedirect(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin && !origin.includes("localhost")) return origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const appUrlEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrlEnv && !appUrlEnv.includes("localhost")) return appUrlEnv;
  return "https://neuralreach.de";
}
