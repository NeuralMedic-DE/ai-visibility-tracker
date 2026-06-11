/**
 * One-shot: render all 4 transactional templates and send each one to
 * a single preview address via Resend. Used for designer / founder review.
 *
 *   node_modules/.bin/tsx scripts/preview-emails.ts joh1391@thi.de
 */
import fs from "fs";
import path from "path";
import { waitlistConfirmEmail } from "../lib/email-templates/waitlist-confirm";
import { welcomeEmail } from "../lib/email-templates/welcome";
import { trialEndingEmail } from "../lib/email-templates/trial-ending";
import { weeklyDigestEmail } from "../lib/email-templates/weekly-digest";

// Load .env.local manually — tsx doesn't pick up Next's loader.
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    if (!process.env[k]) process.env[k] = rest.join("=");
  }
}

const RESEND_KEY = process.env.RESEND_API_KEY;
if (!RESEND_KEY) {
  console.error("RESEND_API_KEY missing in .env.local");
  process.exit(1);
}

const TO = process.argv[2] ?? "joh1391@thi.de";
const APP_URL = "https://www.neuralreach.de";

const renders = [
  {
    label: "waitlist-confirm",
    ...waitlistConfirmEmail({
      appUrl: APP_URL,
      brandInterest: "NeuralMedic GmbH",
      interestedPlan: null,
    }),
  },
  {
    label: "welcome",
    ...welcomeEmail({ appUrl: APP_URL }),
  },
  {
    label: "trial-ending",
    ...trialEndingEmail({
      trialEndDate: "June 25, 2026",
      appUrl: APP_URL,
    }),
  },
  {
    label: "weekly-digest (Starter, sample data)",
    ...weeklyDigestEmail({
      appUrl: APP_URL,
      brandName: "NeuralMedic GmbH",
      avsBrand: 47.3,
      prevAvsBrand: 44.8,
      perLlm: {
        openai: 52.0,
        anthropic: 38.0,
        perplexity: 51.8,
      },
      gapPrompts: [
        {
          prompt_id: "CD-01",
          prompt_text: "What is the best AI search visibility tool for B2B SaaS?",
          category: "category_discovery",
          llms_missed: ["openai", "anthropic"],
        },
        {
          prompt_id: "AL-01",
          prompt_text: "Alternatives to Conductor for AI visibility tracking",
          category: "alternatives",
          llms_missed: ["openai", "anthropic", "perplexity"],
        },
        {
          prompt_id: "UC-02",
          prompt_text: "How can a CMO track LLM mentions weekly?",
          category: "use_case",
          llms_missed: ["anthropic"],
        },
      ],
      plan: "starter",
      runDate: "2026-06-11",
    }),
  },
];

async function send(subject: string, html: string, text: string, label: string) {
  const tag = `[PREVIEW: ${label}] `;
  const payload = {
    from: "NeuralReach <hello@mail.neuralreach.de>",
    to: [TO],
    reply_to: "jonas@neuralreach.de",
    subject: tag + subject,
    html,
    text: tag + "\n\n" + text,
  };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`FAIL ${label}: HTTP ${resp.status} ${body.slice(0, 200)}`);
    return false;
  }
  const data: { id?: string } = await resp.json();
  console.log(`sent  ${label.padEnd(40)}  id=${data.id}`);
  return true;
}

(async () => {
  console.log(`Sending 4 previews to ${TO} ...\n`);
  let ok = 0;
  for (const r of renders) {
    if (await send(r.subject, r.html, r.text, r.label)) ok++;
    // small pause to avoid Resend's 5/sec rate limit
    await new Promise((res) => setTimeout(res, 350));
  }
  console.log(`\ndone. ${ok}/${renders.length} sent.`);
})();
