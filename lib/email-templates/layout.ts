/**
 * Shared email layout — used by all four transactional templates so the
 * brand experience is consistent (waitlist confirm, welcome, trial ending,
 * weekly digest).
 *
 * Design tension solved here:
 *
 *   "Match the website" + "Don't get flagged as spam"
 *
 * Pure plain-text emails deliver best from a young sending domain like
 * mail.neuralreach.de, but they look unbranded. Marketing-rich emails look
 * great but trip spam filters. This layout is the middle ground:
 *
 *   - Wordmark header (TEXT, not an image). Single brand-color line at top.
 *   - White content card on a light slate background. No oversized banner,
 *     no hero image, no big logo.
 *   - Body text in dark gray, system font, line-height 1.6.
 *   - Optional ONE subtle button per email (brand-blue, modest padding).
 *   - Plain ASCII throughout — no em-dashes, no curly quotes, no emoji.
 *   - Footer with reply-to + a short legal/sender line. No "if this lands
 *     in spam mark not-spam" sentence (itself a spam signal).
 *
 * Result: looks branded enough that paying customers don't think "weird,
 * is this real?", stays simple enough that filters don't choke on it.
 */

const BRAND_BLUE = "#0284c7";       // brand-600 — matches site Tailwind theme
const BRAND_BLUE_DARK = "#075985";  // brand-800
const INK = "#1f2937";              // gray-800
const MUTED = "#64748b";            // slate-500
const HAIRLINE = "#e2e8f0";         // slate-200
const PAGE_BG = "#f8fafc";          // slate-50
const CARD_BG = "#ffffff";

/**
 * Wrap a body fragment in the standard NeuralReach email shell.
 *
 * @param bodyHtml      HTML fragment for the message body. Use the helpers
 *                      below (paragraph(), button(), divider(), footnote())
 *                      so styling stays consistent across templates.
 * @param preheader     Optional 1-2 sentence preview text shown by Gmail /
 *                      Apple Mail next to the subject line. If omitted the
 *                      first ~80 chars of the body fragment leak through —
 *                      almost always worth setting explicitly.
 * @param title         Document title (defaults to "NeuralReach"). Some
 *                      clients show this in tab strips.
 */
export function wrapEmail(
  bodyHtml: string,
  opts: { preheader?: string; title?: string } = {}
): string {
  const { preheader, title = "NeuralReach" } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};-webkit-text-size-adjust:100%;">
${preheader ? `<div style="display:none;font-size:1px;color:${PAGE_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAGE_BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${CARD_BG};border:1px solid ${HAIRLINE};border-radius:12px;">
<!-- Wordmark header -->
<tr><td style="padding:24px 32px 16px 32px;border-bottom:1px solid ${HAIRLINE};">
<div style="font-size:15px;font-weight:700;color:${BRAND_BLUE};letter-spacing:0.4px;">
NEURALREACH
</div>
<div style="font-size:12px;color:${MUTED};margin-top:2px;">
AI Search Visibility for B2B SaaS
</div>
</td></tr>
<!-- Body -->
<tr><td style="padding:28px 32px;font-size:16px;line-height:1.6;color:${INK};">
${bodyHtml}
</td></tr>
<!-- Footer -->
<tr><td style="padding:16px 32px 24px 32px;border-top:1px solid ${HAIRLINE};font-size:13px;line-height:1.5;color:${MUTED};">
<p style="margin:0 0 6px 0;">Jonas Heinzmann &nbsp;&middot;&nbsp; NeuralMedic / NeuralReach</p>
<p style="margin:0;">
Reply to this email or write to <a href="mailto:jonas@neuralreach.de" style="color:${BRAND_BLUE};text-decoration:none;">jonas@neuralreach.de</a>.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Standard paragraph. Use throughout the body fragment. */
export function paragraph(content: string): string {
  return `<p style="margin:0 0 14px 0;">${content}</p>`;
}

/** First paragraph variant — slightly larger, used to open the body. */
export function leadParagraph(content: string): string {
  return `<p style="margin:0 0 16px 0;font-size:17px;font-weight:500;">${content}</p>`;
}

/** Inline link in the brand color. */
export function link(href: string, text: string): string {
  return `<a href="${href}" style="color:${BRAND_BLUE};text-decoration:underline;">${text}</a>`;
}

/**
 * Subtle CTA button. Use at most one per email — multiple buttons in a
 * transactional email read as marketing and hurt deliverability.
 */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px 0;">
<tr><td style="border-radius:8px;background:${BRAND_BLUE};">
<a href="${href}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
</td></tr></table>`;
}

/** Small muted text — for asides or notes. */
export function footnote(content: string): string {
  return `<p style="margin:18px 0 0 0;font-size:13px;color:${MUTED};">${content}</p>`;
}

/** Horizontal divider. Use sparingly. */
export function divider(): string {
  return `<div style="height:1px;background:${HAIRLINE};margin:18px 0;"></div>`;
}

/** Sign-off block. Always use this so signatures are consistent. */
export function signoff(): string {
  return `<p style="margin:24px 0 0 0;">Jonas<br><span style="color:${MUTED};">NeuralReach</span></p>`;
}

// Re-export the palette so individual templates that need to render
// per-template tables (like the weekly digest's score grid) stay on-brand.
export const COLORS = {
  brandBlue: BRAND_BLUE,
  brandBlueDark: BRAND_BLUE_DARK,
  ink: INK,
  muted: MUTED,
  hairline: HAIRLINE,
  pageBg: PAGE_BG,
  cardBg: CARD_BG,
} as const;
