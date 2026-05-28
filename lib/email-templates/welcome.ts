/**
 * lib/email-templates/welcome.ts
 *
 * Welcome email sent on checkout.session.completed.
 * Plain-HTML so no react-email dependency is needed.
 * Always include the text fallback to avoid Gmail clipping.
 */

interface WelcomeParams {
  appUrl: string;
}

export function welcomeEmail({ appUrl }: WelcomeParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject =
    "Welcome to NeuralReach — add your brand to start tracking";

  const onboardingUrl = `${appUrl}/dashboard/onboarding`;
  const dashboardUrl = `${appUrl}/dashboard`;
  const supportEmail = "support@neuralreach.de";

  // ── HTML ──────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:32px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                NeuralReach
              </span>
              <div style="color:#94a3b8;font-size:13px;margin-top:4px;">AI Visibility Tracker</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">
                You're in. 🎉
              </h1>

              <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
                Welcome to NeuralReach! Your 14-day free trial is now active.
                We'll scan how your brand appears in <strong>ChatGPT, Claude,
                Perplexity, and Google AI Overviews</strong> — and show you
                exactly where you're invisible and how to fix it.
              </p>

              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
                To kick off your first report, add your brand and up to
                3 competitors on the onboarding page:
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#2563eb;border-radius:8px;">
                    <a href="${onboardingUrl}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;
                              font-weight:600;text-decoration:none;border-radius:8px;">
                      Add my brand →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What happens next -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;
                            margin:0 0 32px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px;font-size:14px;font-weight:600;
                               color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">
                      What happens next
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#374151;">
                          <span style="color:#2563eb;font-weight:700;margin-right:8px;">1.</span>
                          Add your brand + competitors on the onboarding page
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#374151;">
                          <span style="color:#2563eb;font-weight:700;margin-right:8px;">2.</span>
                          We run your first AI visibility scan (takes ~2 minutes)
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#374151;">
                          <span style="color:#2563eb;font-weight:700;margin-right:8px;">3.</span>
                          Your dashboard shows your score across all 4 AI engines
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#374151;">
                          <span style="color:#2563eb;font-weight:700;margin-right:8px;">4.</span>
                          Every Monday you get a fresh weekly report by email
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6;">
                Questions? Reply to this email or reach us at
                <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
              </p>

              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
                — The NeuralReach team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                NeuralReach · AI Visibility Tracker for B2B SaaS ·
                <a href="${dashboardUrl}" style="color:#6b7280;">Dashboard</a>
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
  const text = `Welcome to NeuralReach!

Your 14-day free trial is now active.

We'll scan how your brand appears in ChatGPT, Claude, Perplexity, and
Google AI Overviews — and show you exactly where you're invisible and how
to fix it.

ADD YOUR BRAND NOW:
${onboardingUrl}

What happens next:
1. Add your brand + competitors on the onboarding page
2. We run your first AI visibility scan (takes ~2 minutes)
3. Your dashboard shows your score across all 4 AI engines
4. Every Monday you get a fresh weekly report by email

Questions? Reply to this email or write to ${supportEmail}.

— The NeuralReach team

---
NeuralReach · AI Visibility Tracker for B2B SaaS
Dashboard: ${dashboardUrl}
`;

  return { subject, html, text };
}
