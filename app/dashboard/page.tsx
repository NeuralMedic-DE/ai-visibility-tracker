import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — NeuralReach",
  description: "Your NeuralReach account dashboard.",
};

interface DashboardPageProps {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const isCheckoutSuccess = params.checkout === "success";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/leaderboard"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                AI Visibility Index →
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
        {isCheckoutSuccess ? (
          /* ── Checkout success state ── */
          <div className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
              <svg
                className="h-8 w-8 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
              You&apos;re in! 🎉
            </h1>
            <p className="text-gray-600 text-lg mb-2">
              Your 14-day free trial has started.
            </p>
            <p className="text-gray-500 text-sm mb-10">
              We&apos;ll email you a confirmation shortly. Your first AI visibility
              report will run within 24 hours.
            </p>

            <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6 text-left space-y-4 mb-8">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                What happens next
              </h2>
              {[
                {
                  emoji: "📬",
                  title: "Check your inbox",
                  desc: "You'll receive a welcome email with your account details and how to add your brand.",
                },
                {
                  emoji: "🔍",
                  title: "First scan runs within 24 hours",
                  desc: "We'll query ChatGPT, Claude, Perplexity, and Google AI Overviews for your brand and send you the results.",
                },
                {
                  emoji: "📊",
                  title: "Get your visibility score",
                  desc: "Your first report shows where AI search mentions (or ignores) your brand — and what to fix.",
                },
                {
                  emoji: "💳",
                  title: "No charge until day 15",
                  desc: "Your trial runs for 14 days. Cancel anytime before then and you won't be billed.",
                },
              ].map(({ emoji, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/leaderboard"
                className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Explore the AI Visibility Index →
              </Link>
              <a
                href="mailto:hello@neuralreach.de"
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Contact support
              </a>
            </div>
          </div>
        ) : (
          /* ── Default dashboard placeholder ── */
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">
              Dashboard
            </h1>
            <p className="text-gray-500 mb-8">
              NeuralReach is in early access. Your full dashboard is coming soon.
            </p>

            <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-8 mb-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 mb-4">
                <span className="text-2xl">🚧</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Full dashboard coming Week 2
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                We&apos;re building the live scoring loop and brand management UI now.
                In the meantime, check out the AI Visibility Index leaderboard or
                sign up for early access to get notified.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/leaderboard"
                className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                See the AI Visibility Index →
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View pricing
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
