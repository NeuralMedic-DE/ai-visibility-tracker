/**
 * lib/email-templates/welcome.ts
 *
 * Welcome email sent on checkout.session.completed. Uses the shared
 * NeuralReach email layout for consistent branding.
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
  link,
} from "./layout";

interface WelcomeParams {
  appUrl: string;
}

export function welcomeEmail({ appUrl }: WelcomeParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your NeuralReach account is live";
  const dashboardUrl = `${appUrl}/dashboard`;

  const openerText = "Welcome to NeuralReach. Your account is live.";
  const contextText =
    "First scan runs automatically in the background. You'll get the full report in your dashboard in about 10 minutes, and the first weekly digest by email next Monday.";
  const questionText =
    "One question before you dive in: what's the single brand you most want benchmarked, and which 2 or 3 competitors should we compare against? Just hit reply with the names.";

  // ── Plain-text body ────────────────────────────────────────────────────
  const text = `${openerText}

Your dashboard:
${dashboardUrl}

${contextText}

${questionText}

Jonas
NeuralReach
jonas@neuralreach.de
`;

  // ── HTML body ──────────────────────────────────────────────────────────
  const bodyHtml = [
    leadParagraph(openerText),
    paragraph(`Open your dashboard: ${link(dashboardUrl, "neuralreach.de/dashboard")}`),
    button(dashboardUrl, "Open Dashboard"),
    paragraph(contextText),
    paragraph(questionText),
    signoff(),
  ].join("\n");

  const preheader =
    "Your dashboard is ready. First scan runs in the background; full report in about 10 minutes.";

  const html = wrapEmail(bodyHtml, { preheader, title: subject });

  return { subject, html, text };
}
