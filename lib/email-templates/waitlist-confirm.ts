/**
 * lib/email-templates/waitlist-confirm.ts
 *
 * Confirmation email sent immediately after a waitlist signup.
 *
 * Why: the UI promises "Check your inbox for a confirmation" but until this
 * template + API wiring landed (2026-06-11), no email was being sent. This
 * closes that gap.
 *
 * Sender: NeuralReach <hello@mail.neuralreach.de> (transactional subdomain)
 * ReplyTo: jonas@neuralreach.de (founder inbox — humanises the thread)
 */

interface WaitlistConfirmParams {
  /** Public URL of the leaderboard for a "while you wait" CTA. */
  appUrl: string;
  /** Brand the visitor entered, if any. Used to personalise the body. */
  brandInterest: string | null;
  /** Plan they were interested in: 'starter' | 'pro' | null. */
  interestedPlan: string | null;
}

export function waitlistConfirmEmail({
  appUrl,
  brandInterest,
  interestedPlan,
}: WaitlistConfirmParams): { subject: string; html: string; text: string } {
  const subject = "You're on the NeuralReach waitlist";

  const planLine =
    interestedPlan === "pro"
      ? "We've noted you're interested in the Pro plan (100 prompts/week, 4 brands)."
      : interestedPlan === "starter"
      ? "We've noted you're interested in the Starter plan (25 prompts/week, 1 brand)."
      : "";

  const brandLine = brandInterest
    ? `You said the brand you want to track is "${brandInterest}". `
    : "";

  const leaderboardUrl = `${appUrl}/leaderboard`;

  // ── Plain-text body (primary) ──────────────────────────────────────────
  const text = `Hi there,

You're on the waitlist for NeuralReach. ${brandLine}${planLine}

What happens next:
- Public launch: Wednesday, June 17, 2026.
- You'll get an activation link 48 hours before sign-ups open (so on June 15).
- Reply to this email with anything you want me to know about your brand or
  competitors — it shapes the prompts we run for you on day one.

While you wait, you can browse the live AI Visibility Index of 100 B2B SaaS
brands here: ${leaderboardUrl}

If this email landed in spam, please mark it as "not spam" so the launch
link arrives in your inbox.

— Jonas
Founder, NeuralReach
jonas@neuralreach.de
`;

  // ── HTML body (fallback) ───────────────────────────────────────────────
  const html = `<!doctype html>
<html lang="en">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 16px; line-height: 1.55; color: #0f172a; margin: 0; padding: 32px 24px; background: #f8fafc;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
    <tr>
      <td style="padding: 32px;">
        <p>Hi there,</p>
        <p>You're on the waitlist for NeuralReach. ${brandLine}${planLine}</p>
        <p style="margin-top: 24px;"><strong>What happens next</strong></p>
        <ul style="padding-left: 18px; margin: 8px 0 24px 0;">
          <li>Public launch: <strong>Wednesday, June 17, 2026</strong>.</li>
          <li>You'll get an activation link 48 hours before sign-ups open (so on June 15).</li>
          <li>Reply to this email with anything you want me to know about your brand or competitors — it shapes the prompts we run for you on day one.</li>
        </ul>
        <p>While you wait, you can browse the live AI Visibility Index of 100 B2B SaaS brands:</p>
        <p>
          <a href="${leaderboardUrl}" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600;">See the AI Visibility Index</a>
        </p>
        <p style="font-size: 14px; color: #64748b; margin-top: 24px;">If this email landed in spam, please mark it as "not spam" so the launch link arrives in your inbox.</p>
        <p style="margin-top: 24px;">&mdash; Jonas<br/>Founder, NeuralReach<br/><a href="mailto:jonas@neuralreach.de" style="color: #0284c7;">jonas@neuralreach.de</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
