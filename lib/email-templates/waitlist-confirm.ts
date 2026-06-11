/**
 * lib/email-templates/waitlist-confirm.ts
 *
 * Founder-voice confirmation email sent immediately after a waitlist signup.
 *
 * Rewritten 2026-06-11 because the previous version was getting flagged
 * SPAMMY by both iCloud and Gmail. The new version follows the patterns
 * proven to land in inbox for a new sending domain:
 *
 *   1. Subject does not contain "waitlist", "list", "you're on" or other
 *      templated mailing-list phrases.
 *   2. Body opens with something specific (the brand they entered) instead
 *      of a generic greeting like "Hi there".
 *   3. Asks a single question, inviting a reply. Replies are the strongest
 *      sender-reputation signal that exists.
 *   4. No "if this is in spam, mark not spam" sentence — itself a known
 *      spam-filter trigger.
 *   5. No big colored CTA button, no HTML card wrapper. HTML matches plain
 *      text exactly: short paragraphs, system font, no inline images.
 *   6. Plain ASCII only — no em-dashes or unicode quote marks. Some spam
 *      heuristics weight these heavily.
 *
 * Sender:   NeuralReach <hello@mail.neuralreach.de>
 * Reply-To: jonas@neuralreach.de
 */

interface WaitlistConfirmParams {
  appUrl: string;
  brandInterest: string | null;
  interestedPlan: string | null;
}

export function waitlistConfirmEmail({
  brandInterest,
}: WaitlistConfirmParams): { subject: string; html: string; text: string } {
  // ── Subject: deliberately conversational, no marketing phrasing ────────
  const subject = brandInterest
    ? `Got your signup for ${brandInterest}`
    : "Got your NeuralReach signup";

  // ── Body opener: leads with the brand they entered ─────────────────────
  const opener = brandInterest
    ? `Saw your NeuralReach signup. You're tracking ${brandInterest}.`
    : "Saw your NeuralReach signup. Thanks for getting on the list.";

  // ── Plain-text body ────────────────────────────────────────────────────
  const text = `${opener}

Quick context on what happens next: subscriptions open Wednesday June 17. I'll send you an activation link two days before that. Your first visibility report (25 buyer-intent prompts across ChatGPT, Claude, Perplexity, Google AI Overviews) is on me.

One question that would help me run a better report for you on day one: what are the 2 or 3 competitors you most care about being benchmarked against? Just hit reply with the names.

Jonas
NeuralReach
jonas@neuralreach.de
`;

  // ── HTML body: mirrors plain text exactly, no chrome ───────────────────
  // The HTML version exists because some mail clients (notably Outlook)
  // surface the text alternative differently. Keeping the HTML lean and
  // structurally identical to the text keeps the HTML/text ratio low.
  const html = `<!doctype html>
<html lang="en">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 16px; line-height: 1.55; color: #1f2937; max-width: 540px; margin: 0; padding: 24px;">
<p>${opener}</p>
<p>Quick context on what happens next: subscriptions open Wednesday June 17. I'll send you an activation link two days before that. Your first visibility report (25 buyer-intent prompts across ChatGPT, Claude, Perplexity, Google AI Overviews) is on me.</p>
<p>One question that would help me run a better report for you on day one: what are the 2 or 3 competitors you most care about being benchmarked against? Just hit reply with the names.</p>
<p>Jonas<br>NeuralReach<br><a href="mailto:jonas@neuralreach.de" style="color: #2563eb;">jonas@neuralreach.de</a></p>
</body>
</html>`;

  return { subject, html, text };
}
