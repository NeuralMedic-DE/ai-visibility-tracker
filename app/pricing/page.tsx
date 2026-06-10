import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PricingCard } from "@/components/PricingCard";
import { CheckoutButton } from "@/components/CheckoutButton";
import { PricingBanner } from "@/components/PricingBanner";
import { WaitlistForm } from "@/components/WaitlistForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Pricing — AI Visibility Tracker for B2B SaaS | NeuralReach",
  description:
    "Track your brand in ChatGPT, Claude, Perplexity & Google AI Overviews. Starter $39/mo (25 AI prompts, 4 LLMs, 1 brand). Pro $89/mo (100 prompts, competitor tracking). 14-day free trial.",
  alternates: {
    canonical: "/pricing",
  },
};

// ── Server-side feature flag ──────────────────────────────────────────────────
// Subscriptions are open when BOTH:
//   1. SUBSCRIPTIONS_LIVE=true is set in the environment
//   2. Today's date is on or after 2026-06-17
// This check runs at render time on the server — no client JS involved.
function isSubscriptionsLive(): boolean {
  const flagOn = process.env.SUBSCRIPTIONS_LIVE === "true";
  const dateReached = new Date().toISOString().slice(0, 10) >= "2026-06-17";
  return flagOn && dateReached;
}

// ── Plan features ─────────────────────────────────────────────────────────────

const STARTER_FEATURES = [
  "25 AI prompts per week",
  "4 LLMs tracked (ChatGPT, Claude, Perplexity, Google AIO)",
  "1 brand monitored",
  "Weekly email report",
  "30-day history",
  "Schema & content gap summary",
];

const PRO_FEATURES = [
  "100 AI prompts per week",
  "4 LLMs tracked (ChatGPT, Claude, Perplexity, Google AIO)",
  "Up to 4 brands (yours + 3 competitors)",
  "Weekly + on-demand reports",
  "Full history + trend charts",
  "Detailed schema & content fix recommendations",
  "Priority email support",
];

// 3 bullets per plan shown below the price when subscriptions aren't yet open.
// No em-dashes per brand voice guidelines.
const STARTER_SUBSCRIPTION_BULLETS = [
  "See your brand's visibility score across ChatGPT, Claude, Perplexity, and Google AIO",
  "Receive a weekly email report with 25 targeted AI prompts run on your behalf",
  "Get a schema and content gap summary showing exactly why competitors outrank you",
];

const PRO_SUBSCRIPTION_BULLETS = [
  "Track your brand and up to 3 competitors across all 4 AI search engines",
  "Get 100 AI prompts per week plus on-demand scans and full trend history",
  "Receive a detailed fix report with specific schema and content recommendations",
];

// ── Comparison table ──────────────────────────────────────────────────────────

const COMPARISON = [
  { feature: "AI prompts per week", starter: "25", pro: "100" },
  { feature: "LLMs tracked", starter: "4", pro: "4" },
  { feature: "Brands monitored", starter: "1", pro: "Up to 4" },
  { feature: "Competitor tracking", starter: "No", pro: "Yes" },
  { feature: "Weekly email report", starter: "Yes", pro: "Yes" },
  { feature: "On-demand scans", starter: "No", pro: "Yes" },
  { feature: "Trend charts & history", starter: "30 days", pro: "Full history" },
  { feature: "Schema fix recommendations", starter: "Summary", pro: "Detailed" },
  { feature: "Priority support", starter: "No", pro: "Yes" },
];

// ── Structured data ───────────────────────────────────────────────────────────

const pricingFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does the free trial require a credit card?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Stripe collects your card upfront, but nothing is charged until day 15. You can cancel at any time before then.",
      },
    },
    {
      "@type": "Question",
      name: "What counts as an AI prompt?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each question we send to ChatGPT, Claude, Perplexity, or Google AI Overviews on your brand's behalf is one prompt. Starter runs 25/week across all 4 LLMs; Pro runs up to 100.",
      },
    },
    {
      "@type": "Question",
      name: "Can I upgrade from Starter to Pro later?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can upgrade anytime from your account settings and you'll only be billed the prorated difference.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if I cancel NeuralReach?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your subscription stays active until the end of the current billing period, then stops. You won't be charged again.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer refunds?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We offer a full refund within 7 days of your first charge if you're not satisfied. Email hello@neuralreach.de.",
      },
    },
    {
      "@type": "Question",
      name: "How much does AI search visibility tracking cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "NeuralReach offers two plans: Starter at $39/month (25 AI prompts/week, 4 LLMs, 1 brand) and Pro at $89/month (100 prompts/week, competitor tracking, on-demand scans). Both include a 14-day free trial.",
      },
    },
  ],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const subscriptionsLive = isSubscriptionsLive();

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingFaqSchema) }}
      />
      {/* Nav */}
      <Nav
        links={[
          { href: "/leaderboard", label: "AI Visibility Index" },
          { href: "/methodology", label: "Methodology" },
        ]}
        cta={{ label: "Get Early Access", href: "/#waitlist" }}
      />

      {/* Amber early-access banner — shown only when subscriptions aren't live yet */}
      {!subscriptionsLive && <PricingBanner />}

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            {subscriptionsLive
              ? "Start with a 14-day free trial. No credit card billed until day 15. Cancel anytime."
              : "Subscriptions open Wednesday, June 17, 2026. Enter your email below to be notified the moment sign-ups go live."}
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 max-w-2xl mx-auto">
            <PricingCard
              name="Starter"
              price={39}
              features={STARTER_FEATURES}
              plan="starter"
              subscriptionsLive={subscriptionsLive}
              subscriptionBullets={STARTER_SUBSCRIPTION_BULLETS}
            />
            <PricingCard
              name="Pro"
              price={89}
              features={PRO_FEATURES}
              plan="pro"
              highlighted
              subscriptionsLive={subscriptionsLive}
              subscriptionBullets={PRO_SUBSCRIPTION_BULLETS}
            />
          </div>

          {subscriptionsLive && (
            <p className="mt-6 text-center text-sm text-gray-400">
              All plans include a 14-day free trial. Secure checkout by{" "}
              <span className="font-medium text-gray-500">Stripe</span>.
            </p>
          )}
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-12 bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Feature comparison
          </h2>
          <div className="overflow-hidden rounded-2xl ring-1 ring-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-3 pl-5 pr-3 text-left font-semibold text-gray-600">
                    Feature
                  </th>
                  <th className="py-3 px-4 text-center font-semibold text-gray-700">
                    Starter
                    <br />
                    <span className="font-bold text-gray-900">$39/mo</span>
                  </th>
                  <th className="py-3 pl-4 pr-5 text-center font-semibold text-brand-700">
                    Pro
                    <br />
                    <span className="font-bold text-brand-600">$89/mo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                  >
                    <td className="py-3 pl-5 pr-3 text-gray-700 font-medium">
                      {row.feature}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-500">
                      {row.starter}
                    </td>
                    <td className="py-3 pl-4 pr-5 text-center text-brand-700 font-medium">
                      {row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Frequently asked questions
          </h2>
          <dl className="space-y-6">
            {[
              {
                q: "Does the free trial require a credit card?",
                a: "Yes. Stripe collects your card upfront, but nothing is charged until day 15. You can cancel at any time before then.",
              },
              {
                q: "What counts as an AI prompt?",
                a: "Each question we send to ChatGPT, Claude, Perplexity, or Google AI Overviews on your brand's behalf is one prompt. Starter runs 25/week across all 4 LLMs; Pro runs up to 100.",
              },
              {
                q: "Can I upgrade from Starter to Pro later?",
                a: "Yes. You can upgrade anytime from your account settings and you'll only be billed the prorated difference.",
              },
              {
                q: "What happens if I cancel?",
                a: "Your subscription stays active until the end of the current billing period, then stops. You won't be charged again.",
              },
              {
                q: "Do you offer refunds?",
                a: "We offer a full refund within 7 days of your first charge if you're not satisfied. Email hello@neuralreach.de.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <dt className="font-semibold text-gray-900">{q}</dt>
                <dd className="mt-2 text-sm text-gray-600 leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Bottom CTA — subscribable checkout vs. early-access waitlist */}
      <section className="py-16 bg-brand-600 text-center">
        <div className="mx-auto max-w-xl px-4">
          {subscriptionsLive ? (
            /* ── Live: real Stripe checkout buttons ── */
            <>
              <h2 className="text-3xl font-bold text-white mb-3">
                Ready to see where AI puts your brand?
              </h2>
              <p className="text-brand-200 mb-8">
                Start your free 14-day trial today. No commitment.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CheckoutButton
                  plan="starter"
                  label="Start Starter for $39/mo"
                  block={false}
                  className="rounded-xl bg-white px-8 py-3 min-h-[48px] text-sm font-bold text-brand-600 hover:bg-brand-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600"
                />
                <CheckoutButton
                  plan="pro"
                  label="Start Pro for $89/mo"
                  block={false}
                  className="rounded-xl border border-brand-400 px-8 py-3 min-h-[48px] text-sm font-bold text-white hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600"
                />
              </div>
              <p className="mt-4 text-xs text-brand-300">
                Secure checkout by Stripe · 14-day free trial · Cancel anytime
              </p>
            </>
          ) : (
            /* ── Pre-launch: early-access waitlist form ── */
            <>
              <h2 className="text-3xl font-bold text-white mb-3">
                Get notified when we open subscriptions
              </h2>
              <p className="text-brand-200 mb-8">
                Subscriptions open Wednesday, June 17, 2026. Join the waitlist below to be notified the moment sign-ups go live.
              </p>
              <WaitlistForm
                variant="compact"
                theme="dark"
                className="max-w-sm mx-auto"
              />
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-semibold text-brand-700">NeuralReach</span>
            <p className="text-xs text-gray-400">
              © 2026 NeuralMedic / NeuralReach. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-gray-400">
              <Link href="/leaderboard" className="hover:text-gray-600">
                AI Visibility Index
              </Link>
              <Link href="/methodology" className="hover:text-gray-600">
                Methodology
              </Link>
              <a href="mailto:hello@neuralreach.de" className="hover:text-gray-600">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
