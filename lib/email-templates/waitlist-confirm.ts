/**
 * lib/email-templates/waitlist-confirm.ts
 *
 * Founder-voice confirmation email sent immediately after a waitlist signup.
 * Uses the shared NeuralReach email layout (lib/email-templates/layout.ts).
 *
 * Sender:   NeuralReach <hello@mail.neuralreach.de>
 * Reply-To: jonas@neuralreach.de
 */

import { wrapEmail, paragraph, leadParagraph, signoff } from "./layout";

interface WaitlistConfirmParams {
  appUrl: string;
  brandInterest: string | null;
  interestedPlan: string | null;
}

export function waitlistConfirmEmail({
  brandInterest,
}: WaitlistConfirmParams): { subject: string; html: string; text: string } {
  // Subject: deliberately conversational, no marketing phrasing.
  const subject = brandInterest
    ? `Got your signup for ${brandInterest}`
    : "Got your NeuralReach signup";

  // Body opener: leads with the brand they entered.
  const openerText = brandInterest
    ? `Saw your NeuralReach signup. You're tracking ${brandInterest}.`
    : "Saw your NeuralReach signup. Thanks for getting on the list.";

  const contextText =
    "Quick context on what happens next: subscriptions open Wednesday June 17. " +
    "I'll send you an activation link two days before that. Your first visibility " +
    "report (25 buyer-intent prompts across ChatGPT, Claude, Perplexity, Google " +
    "AI Overviews) is on me.";

  const questionText =
    "One question that would help me run a better report for you on day one: " +
    "what are the 2 or 3 competitors you most care about being benchmarked " +
    "against? Just hit reply with the names.";

  // ── Plain-text body ────────────────────────────────────────────────────
  const text = `${openerText}

${contextText}

${questionText}

Jonas
NeuralReach
jonas@neuralreach.de
`;

  // ── HTML body (wrapped in shared layout) ───────────────────────────────
  const bodyHtml = [
    leadParagraph(openerText),
    paragraph(contextText),
    paragraph(questionText),
    signoff(),
  ].join("\n");

  const preheader = brandInterest
    ? `Quick context on tracking ${brandInterest} in AI search, plus one question.`
    : "Quick context on what happens next, plus one question.";

  const html = wrapEmail(bodyHtml, { preheader, title: subject });

  return { subject, html, text };
}
