/**
 * GET  /api/cron/weekly-digest  (Vercel Cron — 10:00 UTC Monday)
 * POST /api/cron/weekly-digest  (manual trigger — development / ops)
 *
 * Sends the weekly AI visibility digest email for every customer whose
 * weekly scoring job completed today and who hasn't already received the
 * digest today.
 *
 * Pre-condition: /api/cron/weekly ran at 09:00 and ran inline scoring for all
 * eligible customers, writing results directly to customer_scoring_runs. This
 * route reads those rows to send digest emails. No external worker is involved.
 *
 * Authentication:
 *   • GET  (Vercel Cron): header `Authorization: Bearer <CRON_SECRET>`
 *   • POST (manual):      header `X-Cron-Secret: <CRON_SECRET>`
 *                         OR     `Authorization: Bearer <CRON_SECRET>`
 *
 * Invoke manually (simulate digest after scoring):
 *   curl -X POST https://neuralreach.de/api/cron/weekly-digest \
 *     -H "X-Cron-Secret: <CRON_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import {
  weeklyDigestEmail,
  type GapPrompt,
} from "@/lib/email-templates/weekly-digest";

export const maxDuration = 60; // email sends only — no Python subprocess
export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoringRunRow {
  id: string;
  customer_id: string;
  run_date: string;
  avs_brand: number;
  per_llm: Record<string, number>;
  gap_prompts: GapPrompt[];
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function authenticateCron(
  req: NextRequest,
  cronSecret: string
): NextResponse | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === cronSecret) return null; // ✅
    console.warn("[cron/weekly-digest] Unauthorized — bad Bearer token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const xSecret = req.headers.get("x-cron-secret");
  if (xSecret !== null) {
    if (xSecret === cronSecret) return null; // ✅
    console.warn("[cron/weekly-digest] Unauthorized — bad X-Cron-Secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.warn("[cron/weekly-digest] Unauthorized — no auth header");
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ── Core handler ─────────────────────────────────────────────────────────────

async function sendWeeklyDigests(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/weekly-digest] CRON_SECRET env var not set");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 }
    );
  }

  const authError = authenticateCron(req, cronSecret);
  if (authError) return authError;

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neuralreach.de";

  // "Today" in UTC — used to find jobs completed today and guard against
  // sending duplicate digests.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  console.log(
    `[cron/weekly-digest] Looking for completed weekly jobs since ${todayStartIso}`
  );

  // 1. Find all weekly scoring jobs completed today
  const { data: doneJobs, error: jobsErr } = await admin
    .from("scoring_jobs")
    .select("id, customer_id, finished_at")
    .eq("status", "done")
    .eq("trigger", "weekly")
    .gte("finished_at", todayStartIso)
    .order("finished_at", { ascending: true });

  if (jobsErr) {
    console.error(
      "[cron/weekly-digest] Failed to fetch completed jobs:",
      jobsErr
    );
    return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
  }

  if (!doneJobs || doneJobs.length === 0) {
    console.log(
      "[cron/weekly-digest] No completed weekly scoring jobs from today — nothing to send"
    );
    return NextResponse.json({ sent: 0, skipped: 0, errors: 0 });
  }

  console.log(
    `[cron/weekly-digest] Processing ${doneJobs.length} completed job(s)`
  );

  const results: Array<{
    customerId: string;
    email: string;
    status: "sent" | "skipped" | "error";
    reason?: string;
  }> = [];

  for (const job of doneJobs as {
    id: string;
    customer_id: string;
    finished_at: string;
  }[]) {
    const { customer_id: customerId } = job;

    // 2. Load customer info
    const { data: customer } = await admin
      .from("customers")
      .select("id, email, plan")
      .eq("id", customerId)
      .maybeSingle();

    const email = customer?.email ?? `<unknown:${customerId}>`;

    if (!customer) {
      console.warn(
        `[cron/weekly-digest] Customer ${customerId} not found — skipping`
      );
      results.push({ customerId, email, status: "skipped", reason: "customer not found" });
      continue;
    }

    const { plan } = customer;

    // 3. Guard: don't send a second digest if one already went out today
    const { data: alreadySent } = await admin
      .from("email_log")
      .select("id")
      .eq("customer_id", customerId)
      .eq("email_type", "weekly_digest")
      .gte("created_at", todayStartIso)
      .limit(1)
      .maybeSingle();

    if (alreadySent) {
      console.log(
        `[cron/weekly-digest] Digest already sent to ${email} today — skipping`
      );
      results.push({
        customerId,
        email,
        status: "skipped",
        reason: "already sent today",
      });
      continue;
    }

    // 4. Load tracked brand name
    const { data: trackedBrand } = await admin
      .from("tracked_brands")
      .select("brand_name")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!trackedBrand) {
      console.log(
        `[cron/weekly-digest] No tracked brand for ${email} — skipping`
      );
      results.push({
        customerId,
        email,
        status: "skipped",
        reason: "no tracked brand",
      });
      continue;
    }

    // 5. Fetch latest 2 scoring runs (for delta calculation)
    const { data: runs, error: runsErr } = await admin
      .from("customer_scoring_runs")
      .select("id, customer_id, run_date, avs_brand, per_llm, gap_prompts")
      .eq("customer_id", customerId)
      .order("run_date", { ascending: false })
      .limit(2);

    if (runsErr || !runs || runs.length === 0) {
      const reason = `No scoring runs found after job completed (${
        runsErr?.message ?? "empty result"
      })`;
      console.error(`[cron/weekly-digest] ${reason} for ${email}`);
      await admin.from("email_log").insert({
        customer_id: customerId,
        email_type: "weekly_digest",
        recipient: email,
        error: reason,
      });
      results.push({ customerId, email, status: "error", reason });
      continue;
    }

    const latestRun = runs[0] as ScoringRunRow;
    const previousRun = runs.length > 1 ? (runs[1] as ScoringRunRow) : null;

    // 6. Build + send weekly digest email
    const tmpl = weeklyDigestEmail({
      appUrl,
      brandName: trackedBrand.brand_name as string,
      avsBrand: Number(latestRun.avs_brand),
      prevAvsBrand: previousRun !== null ? Number(previousRun.avs_brand) : null,
      perLlm: latestRun.per_llm as Record<string, number>,
      gapPrompts: (latestRun.gap_prompts as GapPrompt[]) ?? [],
      plan,
      runDate: latestRun.run_date,
    });

    const { id: messageId, error: emailErr } = await sendEmail({
      to: email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });

    // 7. Log the send (success or failure)
    await admin.from("email_log").insert({
      customer_id: customerId,
      email_type: "weekly_digest",
      recipient: email,
      message_id: messageId ?? null,
      error: emailErr ?? null,
    });

    if (emailErr) {
      console.error(
        `[cron/weekly-digest] Email send failed for ${email}:`,
        emailErr
      );
      results.push({
        customerId,
        email,
        status: "error",
        reason: `email: ${emailErr}`,
      });
    } else {
      console.log(
        `[cron/weekly-digest] ✅ Weekly digest sent to ${email} | id=${messageId}`
      );
      results.push({ customerId, email, status: "sent" });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  console.log(
    `[cron/weekly-digest] Done — sent=${sent}, skipped=${skipped}, errors=${errors}`
  );

  return NextResponse.json({ sent, skipped, errors, results });
}

// ── Route exports ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return sendWeeklyDigests(req);
}

export async function POST(req: NextRequest) {
  return sendWeeklyDigests(req);
}
