/**
 * lib/email-templates/welcome.ts
 *
 * Welcome email sent on checkout.session.completed.
 *
 * Design: "CEO email" pattern (plain text body, minimal chrome).
 * Copy sourced from state/artifacts/marketing/email_nurture_sequence.md — Email #1.
 * Sender: NeuralReach <hello@mail.neuralreach.de> (transactional subdomain)
 * ReplyTo: jonas@neuralreach.de (founder inbox — humanises the thread)
 */

interface WelcomeParams {
  appUrl: string;
}

export function welcomeEmail({ appUrl }: WelcomeParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your NeuralReach account is ready — here's what happens next";

  const dashboardUrl = `${appUrl}/dashboard`;

  // ── Plain text (primary) ───────────────────────────────────────────────────
  // Plain-text CEO-style copy from email_nurture_sequence.md Email #1.
  // No first_name available at webhook time — use generic greeting.
  const text = `Hi there,

Your NeuralReach account is live — you can log in here:
${dashboardUrl}

Quick question before you dive in: what's the #1 brand you want to track?
Reply here and I'll make sure the prompt set we suggest actually fits your category.

(If you don't see this email or the login link, check spam — it comes from jonas@neuralreach.de)

— Jonas
Founder, NeuralReach
`;

  // ── HTML (lightweight wrapper so email clients render it nicely) ───────────
  // Intentionally minimal — mirrors the plain-text feel to signal a human sender.
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

  <p>Your NeuralReach account is live — you can log in here:<br />
     <a href="${dashboardUrl}" style="color:#2563eb;">${dashboardUrl}</a>
  </p>

  <p>Quick question before you dive in: <strong>what's the #1 brand you want to track?</strong><br />
     Reply here and I'll make sure the prompt set we suggest actually fits your category.
  </p>

  <p style="color:#6b7280;font-size:14px;">
    (If you don't see this email or the login link, check spam — it comes from
    <a href="mailto:jonas@neuralreach.de" style="color:#6b7280;">jonas@neuralreach.de</a>)
  </p>

  <p style="margin-top:32px;">— Jonas<br />
     <span style="color:#6b7280;">Founder, NeuralReach</span>
  </p>

</body>
</html>`;

  return { subject, html, text };
}
