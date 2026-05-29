/**
 * scripts/test_resend.ts
 *
 * Sends one test email via Resend to confirm the API key and the
 * send.neuralreach.de sending domain are correctly configured.
 *
 * Usage:
 *   npx tsx scripts/test_resend.ts
 *   # or, using the package.json shortcut:
 *   npm run test:email
 *
 * Prerequisites:
 *   1. RESEND_API_KEY must be set in .env.local (get it from resend.com/api-keys)
 *   2. The domain send.neuralreach.de must be added + verified in the Resend
 *      dashboard (Resend → Domains → Add Domain → enter send.neuralreach.de).
 *      Copy the DKIM/SPF/DMARC records to your DNS host and click Verify.
 *   3. The receiving mailbox jonas@neuralreach.de must exist and have MX records
 *      pointing to a live mail server.
 *
 * ⚠  DO NOT RUN until the jonas@neuralreach.de mailbox is live.
 *    Running before the mailbox exists will produce a 550/user-unknown bounce
 *    from the receiving MTA. No Resend quota is wasted (Resend still counts the
 *    send), but you won't be able to confirm delivery either.
 *
 * The script exits 0 on success (Resend accepted the message) or 1 on any error.
 * A 0 exit only means Resend accepted the payload — delivery is async. Check the
 * inbox and/or the Resend Logs dashboard for the final delivery status.
 */

import path from "path";
import fs from "fs";

// ── Load .env.local without dotenv ───────────────────────────────────────────
// Parse key=value lines from .env.local and inject into process.env so this
// standalone script can be run with plain `tsx` without any extra dependencies.
function loadEnvLocal(filePath: string): void {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return; // .env.local not found — rely on existing process.env
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if present ("value" or 'value')
    const val =
      (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
      (rawVal.startsWith("'") && rawVal.endsWith("'"))
        ? rawVal.slice(1, -1)
        : rawVal;
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal(path.resolve(process.cwd(), ".env.local"));

// ── Import Resend AFTER env is loaded ────────────────────────────────────────
import { Resend } from "resend";

// ── Config ────────────────────────────────────────────────────────────────────

// ⚠️  Change TO_ADDRESS to "moritz@rmb.dev" for deliverability probes until
//     jonas@neuralreach.de mailbox has live MX records (see T-bbf10de1).
const TO_ADDRESS = "jonas@neuralreach.de";
const FROM_ADDRESS = "NeuralReach <no-reply@send.neuralreach.de>";
const SUBJECT = "[NeuralReach] Resend integration test ✅";

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "re_") {
    console.error(
      "\n[test_resend] ❌  RESEND_API_KEY is missing or placeholder.\n" +
        "  1. Go to https://resend.com/api-keys and create a key with\n" +
        '     "Sending access" for the domain send.neuralreach.de.\n' +
        "  2. Add  RESEND_API_KEY=re_xxxx  to .env.local\n" +
        "  3. Re-run this script.\n"
    );
    process.exit(1);
  }

  const now = new Date().toISOString();

  console.log(`[test_resend] Sending test email to ${TO_ADDRESS} …`);
  console.log(`[test_resend] From: ${FROM_ADDRESS}`);
  console.log(`[test_resend] API key prefix: ${apiKey.slice(0, 8)}…\n`);

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: TO_ADDRESS,
    subject: SUBJECT,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${SUBJECT}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
             background:#f4f4f5;margin:0;padding:40px 20px;">
  <table width="600" style="background:#fff;border-radius:12px;padding:40px;
                            margin:0 auto;max-width:600px;">
    <tr><td>
      <h2 style="color:#0f172a;margin:0 0 16px;">NeuralReach &mdash; Resend integration test</h2>
      <p style="color:#374151;">
        If you can read this, the <strong>Resend API key</strong> and the
        <strong>send.neuralreach.de</strong> sending domain are correctly wired. &#x1F389;
      </p>
      <table style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                    padding:16px;margin-top:16px;" width="100%">
        <tr><td style="font-family:monospace;font-size:13px;color:#374151;">
          Sent at: ${now}<br/>
          From:    ${FROM_ADDRESS}<br/>
          To:      ${TO_ADDRESS}
        </td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">
        This message was sent by <code>scripts/test_resend.ts</code>.
        It is safe to delete it.
      </p>
    </td></tr>
  </table>
</body>
</html>`,
    text: [
      "NeuralReach — Resend integration test",
      "",
      "If you can read this, the Resend API key and the send.neuralreach.de",
      "sending domain are correctly wired.",
      "",
      `Sent at: ${now}`,
      `From:    ${FROM_ADDRESS}`,
      `To:      ${TO_ADDRESS}`,
      "",
      "This message was sent by scripts/test_resend.ts. Safe to delete.",
    ].join("\n"),
  });

  if (error) {
    console.error("[test_resend] ❌  Resend returned an error:");
    console.error(JSON.stringify(error, null, 2));
    console.error(
      "\nCommon causes:\n" +
        "  • send.neuralreach.de not yet verified in Resend → add + verify the domain\n" +
        "  • API key has wrong scope → needs 'Sending access' for send.neuralreach.de\n" +
        "  • Resend API unreachable → check network / firewall\n"
    );
    process.exit(1);
  }

  console.log("[test_resend] ✅  Accepted by Resend!");
  console.log(`[test_resend]    Message ID : ${data?.id}`);
  console.log(`[test_resend]    Check inbox: ${TO_ADDRESS}`);
  console.log(
    "[test_resend]    Resend Logs: https://resend.com/emails (delivery status)\n"
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[test_resend] Unexpected error:", msg);
  process.exit(1);
});
