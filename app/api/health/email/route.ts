/**
 * GET /api/health/email
 *
 * Diagnoses email deliverability by checking the four DNS records that Resend
 * requires for mail.neuralreach.de to be verified.
 *
 * Returns:
 *   200  { status: "ok"      } — all records present and correctly formatted
 *   503  { status: "broken"  } — one or more records are missing/malformed
 *
 * Safe to make public — only reads DNS, no secrets exposed.
 *
 * Record layout for domain mail.neuralreach.de registered in Resend:
 *   DKIM   TXT  resend._domainkey.mail.neuralreach.de  →  "v=DKIM1; k=rsa; p=..."
 *   SPF    TXT  send.mail.neuralreach.de               →  "v=spf1 include:amazonses.com ~all"
 *   RPTH   MX   send.mail.neuralreach.de               →  feedback-smtp.eu-west-1.amazonses.com
 *   DMARC  TXT  _dmarc.neuralreach.de                  →  "v=DMARC1; p=quarantine ..."
 */

import { promises as dns } from "dns";
import { NextResponse } from "next/server";

const DOMAIN = "neuralreach.de";

interface RecordCheck {
  host: string;
  type: "TXT" | "MX";
  expected_contains: string;
  description: string;
}

const CHECKS: RecordCheck[] = [
  {
    host: `resend._domainkey.mail.${DOMAIN}`,
    type: "TXT",
    expected_contains: "v=DKIM1",
    description: "Resend DKIM — must start with v=DKIM1; k=rsa; p=…",
  },
  {
    host: `send.mail.${DOMAIN}`,
    type: "TXT",
    expected_contains: "v=spf1 include:amazonses.com",
    description: "Resend SPF — must contain include:amazonses.com",
  },
  {
    host: `send.mail.${DOMAIN}`,
    type: "MX",
    expected_contains: "feedback-smtp",
    description: "Resend Return-Path MX — must point to feedback-smtp.eu-west-1.amazonses.com",
  },
  {
    host: `_dmarc.${DOMAIN}`,
    type: "TXT",
    expected_contains: "v=DMARC1",
    description: "DMARC — must contain v=DMARC1",
  },
];

interface CheckResult {
  host: string;
  type: string;
  description: string;
  ok: boolean;
  found?: string;
  error?: string;
  fix?: string;
}

async function checkRecord(c: RecordCheck): Promise<CheckResult> {
  try {
    let values: string[] = [];

    if (c.type === "TXT") {
      const records = await dns.resolveTxt(c.host);
      // resolveTxt returns string[][] — join chunks within each record
      values = records.map((chunks) => chunks.join(""));
    } else if (c.type === "MX") {
      const records = await dns.resolveMx(c.host);
      values = records.map((r) => r.exchange);
    }

    const matching = values.find((v) => v.includes(c.expected_contains));

    if (matching) {
      return { host: c.host, type: c.type, description: c.description, ok: true, found: matching };
    }

    // Record exists but value is wrong
    const dkimFixHint =
      c.host.startsWith("resend._domainkey") && values.length > 0 && values[0].startsWith("p=")
        ? `Record exists but is MISSING the required prefix. ` +
          `Change the TXT value from "${values[0].slice(0, 60)}…" ` +
          `to "v=DKIM1; k=rsa; ${values[0].slice(0, 60)}…" in your DNS registrar (UDAG). ` +
          `This is the only remaining fix needed for Resend to verify the domain.`
        : undefined;

    return {
      host: c.host,
      type: c.type,
      description: c.description,
      ok: false,
      found: values.length ? values.join(" | ") : "(no matching record found)",
      fix: dkimFixHint,
    };
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      (err.message.includes("ENOTFOUND") ||
        err.message.includes("ENODATA") ||
        err.message.includes("ESERVFAIL"));

    return {
      host: c.host,
      type: c.type,
      description: c.description,
      ok: false,
      error: isNotFound ? "Record not found in DNS" : (err instanceof Error ? err.message : String(err)),
    };
  }
}

export async function GET() {
  const results: CheckResult[] = await Promise.all(CHECKS.map(checkRecord));

  const failed = results.filter((r) => !r.ok);
  const allOk = failed.length === 0;

  // Check for EMAIL_DRY_RUN leaking into production
  const dryRunActive =
    process.env.EMAIL_DRY_RUN === "1" && process.env.NODE_ENV === "production";

  const body = {
    status: allOk && !dryRunActive ? "ok" : "broken",
    domain: `mail.${DOMAIN}`,
    from_address: "hello@mail.neuralreach.de",
    checks_total: results.length,
    checks_ok: results.filter((r) => r.ok).length,
    ...(dryRunActive && {
      warning_dry_run:
        "EMAIL_DRY_RUN=1 is set in production — no emails will be delivered. " +
        "Remove it from Vercel Settings → Environment Variables → Production.",
    }),
    records: results.map((r) => ({
      host: r.host,
      type: r.type,
      description: r.description,
      ok: r.ok,
      ...(r.found !== undefined && { found: r.found }),
      ...(r.error !== undefined && { error: r.error }),
      ...(r.fix !== undefined && { fix: r.fix }),
    })),
    checked_at: new Date().toISOString(),
    ...(failed.length > 0 && {
      action_needed: failed.map((r) => ({
        host: r.host,
        type: r.type,
        fix: r.fix ?? `Add/correct ${r.type} record at ${r.host} — see runbook: state/artifacts/runbooks/resend_dns_fix_DEFINITIVE_2026-06-10.md`,
      })),
    }),
  };

  return NextResponse.json(body, { status: allOk && !dryRunActive ? 200 : 503 });
}
