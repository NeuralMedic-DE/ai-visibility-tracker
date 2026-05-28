/**
 * lib/email.ts
 * Thin wrapper around the Resend SDK.
 *
 * Usage:
 *   import { sendEmail } from "@/lib/email"
 *   const { id, error } = await sendEmail({ to, subject, html, text })
 *
 * Set EMAIL_DRY_RUN=1 in .env.local to log emails to console instead of
 * actually sending them (useful during development to avoid burning Resend quota).
 */

import { Resend } from "resend";

// Lazily initialise so the module can be imported in tests without a real key.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Transactional emails are sent from the isolated send.neuralreach.de subdomain.
// DKIM/SPF records for that subdomain are independent of the founder mailbox
// (@neuralreach.de), so deliverability problems on one side don't bleed into
// the other. Add send.neuralreach.de (NOT neuralreach.de) as a domain in
// Resend and copy the provided DNS records to your registrar.
export const FROM_ADDRESS = "NeuralReach <hello@send.neuralreach.de>";
export const SUPPORT_EMAIL = "support@neuralreach.de";

export interface EmailPayload {
  to: string;
  subject: string;
  /** Full HTML body */
  html: string;
  /** Plain-text fallback (required — prevents Gmail clipping) */
  text: string;
  replyTo?: string;
}

export interface SendResult {
  /** Resend message ID (or a dry-run placeholder) */
  id?: string;
  error?: string;
}

/**
 * Send a transactional email via Resend.
 *
 * If EMAIL_DRY_RUN=1, the email is printed to console and never sent —
 * the function still resolves successfully so callers don't need special
 * branching in tests / local dev.
 */
export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const dryRun = process.env.EMAIL_DRY_RUN === "1";

  if (dryRun) {
    const divider = "─".repeat(60);
    console.log(`\n[email:dry-run] ${divider}`);
    console.log(`[email:dry-run] To:      ${payload.to}`);
    console.log(`[email:dry-run] Subject: ${payload.subject}`);
    console.log(`[email:dry-run] Text:\n${payload.text}`);
    console.log(`[email:dry-run] ${divider}\n`);
    return { id: `dry-run-${Date.now()}` };
  }

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { error: (error as { message?: string }).message ?? String(error) };
    }

    console.log(`[email] Sent → ${payload.to} | id=${data?.id}`);
    return { id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] Unexpected error:", msg);
    return { error: msg };
  }
}
