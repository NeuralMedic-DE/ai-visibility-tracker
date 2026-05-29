import Link from "next/link";
import { PricingCard } from "@/components/PricingCard";
import { CheckoutButton } from "@/components/CheckoutButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing | NeuralReach",
  description:
    "Simple, transparent pricing for AI search visibility tracking. Start with a 14-day free trial.",
};

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

const COMPARISON = [
  { feature: "AI prompts per week", starter: "25", pro: "100" },
  { feature: "LLMs tracked", starter: "4", pro: "4" },
  { feature: "Brands monitored", starter: "1", pro: "Up to 4" },
  { feature: "Competitor tracking", starter: "—", pro: "✓" },
  { feature: "Weekly email report", starter: "✓", pro: "✓" },
  { feature: "On-demand scans", starter: "—", pro: "✓" },
  { feature: "Trend charts & history", starter: "30 days", pro: "Full history" },
  { feature: "Schema fix recommendations", starter: "Summary", pro: "Detailed" },
  { feature: "Priority support", starter: "—", pro: "✓" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-brand-700">NeuralReach</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/leaderboard"
                className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                AI Visibility Index
              </Link>
              <Link
                href="/methodology"
                className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Methodology
              </Link>
              <Link
                href="/#waitlist"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Get Early Access
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Start with a 14-day free trial. No credit card billed until day 15.
            Cancel anytime.
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
            />
            <PricingCard
              name="Pro"
              price={89}
              features={PRO_FEATURES}
              plan="pro"
              highlighted
            />
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            All plans include a 14-day free trial. Secure checkout by{" "}
            <span className="font-medium text-gray-500">Stripe</span>.
          </p>
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

      {/* Bottom CTA */}
      <section className="py-16 bg-brand-600 text-center">
        <div className="mx-auto max-w-xl px-4">
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
              className="rounded-xl bg-white px-8 py-3 text-sm font-bold text-brand-600 hover:bg-brand-50 transition-colors"
            />
            <CheckoutButton
              plan="pro"
              label="Start Pro for $89/mo"
              block={false}
              className="rounded-xl border border-brand-400 px-8 py-3 text-sm font-bold text-white hover:bg-brand-700 transition-colors"
            />
          </div>
          <p className="mt-4 text-xs text-brand-300">
            Secure checkout by Stripe · 14-day free trial · Cancel anytime
          </p>
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
