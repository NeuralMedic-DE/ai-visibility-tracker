/**
 * lib/email-templates/weekly-digest.ts
 *
 * Weekly digest email sent by /api/cron/weekly for every active/trialing
 * customer. Includes AVS score, week-over-week delta, top-3 gap prompts,
 * and a CTA link to the full dashboard report.
 * Plain-HTML for maximum email client compatibility.
 */

export interface GapPrompt {
  prompt_id?: string;
  prompt_text: string;
  category: string;
  llms_missed: string[];
}

export interface WeeklyDigestParams {
  appUrl: string;
  brandName: string;
  /** AI Visibility Score for this week (0–100) */
  avsBrand: number;
  /** Previous week's AVS, null if this is the first run */
  prevAvsBrand: number | null;
  /** Per-LLM scores map, e.g. { openai: 54.3, anthropic: 49.1, ... } */
  perLlm: Record<string, number>;
  /** Top-3 gap prompts where brand was not mentioned */
  gapPrompts: GapPrompt[];
  /** Customer plan — Pro tier unlocks fix report in dashboard */
  plan: "starter" | "pro";
  /** Run date ISO string, e.g. "2026-06-02" */
  runDate: string;
}

// Human-readable LLM label map
const LLM_LABELS: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  perplexity: "Perplexity",
  google: "Google AIO",
};

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`;
  if (delta < 0) return `${delta.toFixed(1)}`;
  return "±0.0";
}

function deltaColor(delta: number): string {
  if (delta > 0) return "#16a34a";
  if (delta < 0) return "#dc2626";
  return "#6b7280";
}

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

// Width % for a mini progress bar
function barWidth(score: number): number {
  return Math.max(4, Math.min(100, score));
}

export function weeklyDigestEmail(params: WeeklyDigestParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    appUrl,
    brandName,
    avsBrand,
    prevAvsBrand,
    perLlm,
    gapPrompts,
    plan,
    runDate,
  } = params;

  const delta =
    prevAvsBrand !== null ? avsBrand - prevAvsBrand : null;
  const dashboardUrl = `${appUrl}/dashboard`;
  const supportEmail = "support@neuralreach.de";

  // Format run date nicely
  const runDateDisplay = new Date(runDate + "T12:00:00Z").toLocaleDateString(
    "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  const subject = `NeuralReach weekly: ${brandName} scored ${avsBrand.toFixed(1)}/100${
    delta !== null
      ? ` (${delta >= 0 ? "↑" : "↓"}${Math.abs(delta).toFixed(1)} vs last week)`
      : ""
  }`;

  // ── Per-LLM rows (HTML) ────────────────────────────────────────────────────
  const llmRowsHtml = Object.entries(perLlm)
    .map(([key, score]) => {
      const label = LLM_LABELS[key] ?? key;
      const color = scoreColor(score);
      const width = barWidth(score);
      return `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#374151;width:120px;">${label}</td>
          <td style="padding:6px 0;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="background:#e2e8f0;border-radius:4px;height:8px;">
                  <div style="background:${color};width:${width}%;height:8px;border-radius:4px;"></div>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:6px 0 6px 12px;font-size:14px;font-weight:600;
                     color:${color};white-space:nowrap;width:60px;">
            ${score.toFixed(1)}/100
          </td>
        </tr>`;
    })
    .join("");

  // ── Gap prompt rows (HTML) ─────────────────────────────────────────────────
  const gapRowsHtml =
    gapPrompts.length > 0
      ? gapPrompts
          .map(
            (g, i) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
              <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:4px;">
                ${i + 1}. &ldquo;${g.prompt_text}&rdquo;
              </div>
              <div style="font-size:13px;color:#6b7280;">
                Missed by: ${g.llms_missed.map((k) => LLM_LABELS[k] ?? k).join(", ") || "all LLMs"}
                &nbsp;&middot;&nbsp; Category: ${g.category}
              </div>
            </td>
          </tr>`
          )
          .join("")
      : `<tr><td style="padding:10px 0;font-size:14px;color:#16a34a;">🎉 No significant gaps this week!</td></tr>`;

  // ── Pro upsell blurb ───────────────────────────────────────────────────────
  const proBlurbHtml =
    plan === "starter"
      ? `<table cellpadding="0" cellspacing="0" border="0" width="100%"
              style="background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;margin:24px 0;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1d4ed8;">
                Upgrade to Pro for a full Fix Report
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:#374151;line-height:1.5;">
                Pro subscribers get a personalised markdown Fix Report with
                schema markup, content gaps, and entity authority recommendations
                — generated by Claude for each weekly run.
              </p>
              <a href="${appUrl}/pricing"
                 style="font-size:13px;color:#2563eb;font-weight:600;text-decoration:none;">
                Upgrade to Pro →
              </a>
            </td>
          </tr>
        </table>`
      : "";

  // ── HTML body ──────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:28px 40px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:20px;font-weight:700;
                                 letter-spacing:-0.5px;">NeuralReach</span>
                    <div style="color:#94a3b8;font-size:12px;margin-top:2px;">
                      Weekly AI Visibility Report
                    </div>
                  </td>
                  <td align="right">
                    <span style="color:#64748b;font-size:12px;">${runDateDisplay}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Score hero -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">
                AI Visibility Score for
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#0f172a;">
                ${brandName}
              </h1>

              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:24px;">
                    <div style="font-size:52px;font-weight:800;
                                color:${scoreColor(avsBrand)};line-height:1;">
                      ${avsBrand.toFixed(1)}
                    </div>
                    <div style="font-size:14px;color:#6b7280;margin-top:2px;">
                      out of 100
                    </div>
                  </td>
                  ${
                    delta !== null
                      ? `<td>
                      <div style="font-size:28px;font-weight:700;
                                  color:${deltaColor(delta)};line-height:1;">
                        ${formatDelta(delta)}
                      </div>
                      <div style="font-size:13px;color:#6b7280;margin-top:2px;">
                        vs last week (${prevAvsBrand!.toFixed(1)})
                      </div>
                    </td>`
                      : `<td>
                      <div style="font-size:14px;color:#6b7280;padding-top:8px;">
                        First run — baseline established
                      </div>
                    </td>`
                  }
                </tr>
              </table>
            </td>
          </tr>

          <!-- Per-LLM breakdown -->
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0f172a;
                         text-transform:uppercase;letter-spacing:0.05em;">
                Per-engine scores
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${llmRowsHtml}
              </table>
            </td>
          </tr>

          <!-- Gap prompts -->
          <tr>
            <td style="padding:0 40px 8px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#0f172a;
                         text-transform:uppercase;letter-spacing:0.05em;">
                Top gaps this week
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">
                Prompts where ${brandName} was not mentioned
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${gapRowsHtml}
              </table>
            </td>
          </tr>

          ${proBlurbHtml ? `<tr><td style="padding:0 40px;">${proBlurbHtml}</td></tr>` : ""}

          <!-- CTA -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#0f172a;border-radius:8px;">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;
                              font-weight:600;text-decoration:none;border-radius:8px;">
                      View full report →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                NeuralReach · AI Visibility Tracker ·
                <a href="${dashboardUrl}" style="color:#6b7280;">Dashboard</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}/dashboard" style="color:#6b7280;">Manage subscription</a>
                &nbsp;·&nbsp;
                <a href="mailto:${supportEmail}" style="color:#6b7280;">Support</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ── Plain text fallback ────────────────────────────────────────────────────
  const llmTextLines = Object.entries(perLlm)
    .map(([key, score]) => `  ${(LLM_LABELS[key] ?? key).padEnd(14)} ${score.toFixed(1)}/100`)
    .join("\n");

  const gapTextLines =
    gapPrompts.length > 0
      ? gapPrompts
          .map(
            (g, i) =>
              `${i + 1}. "${g.prompt_text}"\n   Missed by: ${
                g.llms_missed.map((k) => LLM_LABELS[k] ?? k).join(", ") ||
                "all LLMs"
              } | Category: ${g.category}`
          )
          .join("\n\n")
      : "No significant gaps this week — great work!";

  const deltaText =
    delta !== null
      ? ` (${formatDelta(delta)} vs last week — previous score: ${prevAvsBrand!.toFixed(1)})`
      : " (first run — baseline established)";

  const text = `NeuralReach Weekly AI Visibility Report
${runDateDisplay}
${"═".repeat(50)}

Brand: ${brandName}
AI Visibility Score: ${avsBrand.toFixed(1)}/100${deltaText}

PER-ENGINE SCORES
─────────────────
${llmTextLines}

TOP GAPS THIS WEEK
──────────────────
(Prompts where ${brandName} was not mentioned)

${gapTextLines}
${
  plan === "starter"
    ? `
UPGRADE TO PRO
──────────────
Get a personalised Fix Report with schema markup, content gaps,
and entity authority recommendations generated by Claude.
${appUrl}/pricing
`
    : ""
}
VIEW FULL REPORT
${dashboardUrl}

MANAGE SUBSCRIPTION
${appUrl}/dashboard

─────────────────────────────────────────────────
NeuralReach · AI Visibility Tracker for B2B SaaS
Support: ${supportEmail}
`;

  return { subject, html, text };
}
