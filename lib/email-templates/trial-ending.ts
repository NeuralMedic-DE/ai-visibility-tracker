/**
 * lib/email-templates/trial-ending.ts
 *
 * Sent 3 days before a trial ends (customer.subscription.trial_will_end).
 * Uses the shared NeuralReach email layout for consistent branding.
 *
 * Sender:   NeuralReach <hello@mail.neuralreach.de>
 * Reply-To: jonas@neuralreach.de
 */

import {
  wrapEmail,
  paragraph,
  leadParagraph,
  button,
  signoff,
  footnote,
} from "./layout";

interface TrialEndingParams {
  /** Human-readable date string, e.g. "June 4, 2026" */
  trialEndDate: string;
  /** Full app origin, e.g. "https://neuralreach.de" */
  appUrl: string;
}

export function trialEndingEmail({
  trialEndDate,
  appUrl,
}: TrialEndingParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Heads-up: your NeuralReach trial ends ${trialEndDate}`;
  const dashboardUrl = `${appUrl}/dashboard`;

  const openerText = `A quick heads-up: your free trial ends on ${trialEndDate}.`;
  const billingText =
    "After that your card gets charged so your AI visibility tracking keeps running without interruption.";
  const cancelText =
    "If you want to cancel before being billed, you can do it from your dashboard or just hit reply. No hard feelings either way. If you decide to cancel, I'd love to hear what would have made it worth keeping.";

  // ── Plain-text body ────────────────────────────────────────────────────
  const text = `${openerText}

${billingText}

Your dashboard:
${dashboardUrl}

${cancelText}

Jonas
NeuralReach
jonas@neuralreach.de
`;

  // ── HTML body ──────────────────────────────────────────────────────────
  const bodyHtml = [
    leadParagraph(openerText),
    paragraph(billingText),
    button(dashboardUrl, "Open Dashboard"),
    paragraph(cancelText),
    signoff(),
    footnote("This is a one-time heads-up email tied to your active trial."),
  ].join("\n");

  const preheader = `Your trial ends ${trialEndDate}. Cancel from the dashboard or hit reply.`;

  const html = wrapEmail(bodyHtml, { preheader, title: subject });

  return { subject, html, text };
}
