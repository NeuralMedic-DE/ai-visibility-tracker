/**
 * POST /api/cron/weekly
 *
 * Runs the weekly AI visibility scoring loop for every active/trialing
 * customer, then sends each one a weekly digest email.
 *
 * Authentication: requires header X-Cron-Secret matching env CRON_SECRET.
 *
 * Invoke manually:
 *   curl -X POST https://neuralreach.de/api/cron/weekly \
 *     -H "X-Cron-Secret: <CRON_SECRET>"
 *
 * Scheduled on Vercel Cron: see vercel.json (Monday 09:00 UTC).
 *
 * Timeout note: set maxDuration=300 in vercel.json for this route.
 * Each scorer run takes up to ~90 s; the endpoint processes customers
 * sequentially. For >3 customers on Vercel Pro, consider moving to a
 * background queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import {
  weeklyDigestEmail,
  type GapPrompt,
} from "@/lib/email-templates/weekly-digest";
import { spawn } from "child_process";
import path from "path";

// Allow long-running execution on Vercel Pro (seconds)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerRow {
  id: string;
  email: string;
  plan: "starter" | "pro";
  subscription_status: string;
}

interface ScoringRunRow {
  id: string;
  customer_id: string;
  run_date: string;
  avs_brand: number;
  per_llm: Record<string, number>;
  gap_prompts: GapPrompt[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Spawns python3 -m scorer.run_for_customer for the given customer and waits
 * for the process to exit (up to timeoutMs milliseconds).
 */
function runScorer(
  customerId: string,
  workspaceRoot: string,
  timeoutMs = 120_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "python3",
      ["-m", "scorer.run_for_customer", "--customer-id", customerId],
      {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      }
    );

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(
        new Error(
          `Scorer timed out after ${timeoutMs / 1000}s for customer ${customerId}`
        )
      );
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Scorer spawn error: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        console.log(
          `[cron/weekly] Scorer finished for customer ${customerId} (stdout tail: ${stdout.slice(-200)})`
        );
        resolve();
      } else {
        reject(
          new Error(
            `Scorer exited with code ${code} for customer ${customerId}.\nstderr: ${stderr.slice(-500)}`
          )
        );
      }
    });
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Authenticate the cron caller
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/weekly] CRON_SECRET env var not set");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 }
    );
  }

  const incomingSecret = req.headers.get("x-cron-secret");
  if (incomingSecret !== cronSecret) {
    console.warn("[cron/weekly] Unauthorized cron attempt — bad secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://neuralreach.de";
  const workspaceRoot = path.resolve(process.cwd());

  console.log("[cron/weekly] Starting weekly scoring + email run");

  // 2. Fetch all active/trialing customers
  const { data: customers, error: customersErr } = await supabase
    .from("customers")
    .select("id, email, plan, subscription_status")
    .in("subscription_status", ["trialing", "active"]);

  if (customersErr) {
    console.error("[cron/weekly] Failed to fetch customers:", customersErr);
    return NextResponse.json(
      { error: "DB fetch failed" },
      { status: 500 }
    );
  }

  if (!customers || customers.length === 0) {
    console.log("[cron/weekly] No active/trialing customers — nothing to do");
    return NextResponse.json({ processed: 0 });
  }

  console.log(
    `[cron/weekly] Processing ${customers.length} customer(s)`
  );

  const results: Array<{
    customerId: string;
    email: string;
    status: "ok" | "error" | "skipped";
    reason?: string;
  }> = [];

  // 3. Process each customer sequentially
  for (const customer of customers as CustomerRow[]) {
    const { id: customerId, email, plan } = customer;

    // 3a. Check the customer has a tracked brand
    const { data: trackedBrand } = await supabase
      .from("tracked_brands")
      .select("id, brand_name")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!trackedBrand) {
      console.log(
        `[cron/weekly] No tracked brand for customer ${customerId} — skipping`
      );
      results.push({
        customerId,
        email,
        status: "skipped",
        reason: "no tracked brand",
      });
      continue;
    }

    // 3b. Run the scorer
    console.log(
      `[cron/weekly] Running scorer for customer ${customerId} (${email}, brand: ${trackedBrand.brand_name})`
    );
    try {
      await runScorer(customerId, workspaceRoot);
    } catch (scorerErr) {
      const reason =
        scorerErr instanceof Error ? scorerErr.message : String(scorerErr);
      console.error(
        `[cron/weekly] Scorer failed for customer ${customerId}:`,
        reason
      );
      results.push({ customerId, email, status: "error", reason });

      // Log the failure to email_log
      await supabase.from("email_log").insert({
        customer_id: customerId,
        email_type: "weekly_digest",
        recipient: email,
        error: `Scorer failed: ${reason.slice(0, 500)}`,
      });
      continue;
    }

    // 3c. Fetch latest 2 scoring runs (for delta calculation)
    const { data: runs, error: runsErr } = await supabase
      .from("customer_scoring_runs")
      .select("id, customer_id, run_date, avs_brand, per_llm, gap_prompts")
      .eq("customer_id", customerId)
      .order("run_date", { ascending: false })
      .limit(2);

    if (runsErr || !runs || runs.length === 0) {
      const reason = `No scoring runs after scorer completed (${runsErr?.message ?? "empty result"})`;
      console.error(`[cron/weekly] ${reason} for customer ${customerId}`);
      results.push({ customerId, email, status: "error", reason });
      await supabase.from("email_log").insert({
        customer_id: customerId,
        email_type: "weekly_digest",
        recipient: email,
        error: reason,
      });
      continue;
    }

    const latestRun = runs[0] as ScoringRunRow;
    const previousRun = runs.length > 1 ? (runs[1] as ScoringRunRow) : null;

    const prevAvsBrand = previousRun?.avs_brand ?? null;

    // 3d. Build + send the weekly digest email
    const tmpl = weeklyDigestEmail({
      appUrl,
      brandName: trackedBrand.brand_name as string,
      avsBrand: Number(latestRun.avs_brand),
      prevAvsBrand: prevAvsBrand !== null ? Number(prevAvsBrand) : null,
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

    // 3e. Log the send (success or failure)
    await supabase.from("email_log").insert({
      customer_id: customerId,
      email_type: "weekly_digest",
      recipient: email,
      message_id: messageId ?? null,
      error: emailErr ?? null,
    });

    if (emailErr) {
      console.error(
        `[cron/weekly] Email send failed for ${email}:`,
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
        `[cron/weekly] ✅ Weekly digest sent to ${email} | id=${messageId}`
      );
      results.push({ customerId, email, status: "ok" });
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errCount = results.filter((r) => r.status === "error").length;
  const skipCount = results.filter((r) => r.status === "skipped").length;

  console.log(
    `[cron/weekly] Done — ok=${okCount}, errors=${errCount}, skipped=${skipCount}`
  );

  return NextResponse.json({
    processed: customers.length,
    ok: okCount,
    errors: errCount,
    skipped: skipCount,
    results,
  });
}
