/**
 * lib/email-templates/trial-ending.ts
 *
 * Sent 3 days before a trial ends (customer.subscription.trial_will_end).
 * Goal: remind the user what they'll get billed, link to the dashboard,
 * and surface a reply-to-cancel escape hatch so they don't file a chargeback.
 *
 * Sender: NeuralReach <hello@mail.neuralreach.de> (transactional subdomain)
 * ReplyTo: jonas@neuralreach.de (founder inbox)
 */

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
  const subject = `Your NeuralReach trial ends on ${trialEndDate} — a quick heads-up`;
  const dashboardUrl = `${appUrl}/dashboard`;

  // ── Plain text ────────────────────────────────────────────────────────────────
  const text = `Hi there,

Just a heads-up: your NeuralReach free trial ends on ${trialEndDate}.

After that, your card will be charged automatically so your AI Visibility tracking keeps running without interruption.

If you'd like to cancel before being billed, just reply to this email or visit your dashboard:
${dashboardUrl}

No hard feelings either way — I'd love to know what's holding you back if you decide to cancel.

— Jonas
Founder, NeuralReach
`;

  // ── HTML ──────────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:40px 20px;background:#ffffff;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
             font-size:16px;line-height:1.7;color:#1f2937;max-width:600px;">

  <p>Hi there,</p>

  <p>Just a heads-up: your NeuralReach free trial ends on <strong>${trialEndDate}</strong>.</p>

  <p>After that, your card will be charged automatically so your AI Visibility tracking keeps running without interruption.</p>

  <p>If you'd like to cancel before being billed, just reply to this email or visit your dashboard:<br />
     <a href="${dashboardUrl}" style="color:#2563eb;">${dashboardUrl}</a>
  </p>

  <p style="color:#6b7280;font-size:14px;">
    No hard feelings either way — I'd love to know what's holding you back if you decide to cancel.
  </p>

  <p style="margin-top:32px;">— Jonas<br />
     <span style="color:#6b7280;">Founder, NeuralReach</span>
  </p>

</body>
</html>`;

  return { subject, html, text };
}
