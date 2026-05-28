import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add your brand — NeuralReach",
  description: "Set up brand tracking for your NeuralReach account.",
};

/**
 * Onboarding stub — full flow arrives in task T2 (brand tracking).
 */
export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 mb-6">
            <span className="text-3xl" aria-hidden="true">
              🚧
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Brand onboarding coming soon
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            We&apos;re building the brand setup flow now. You&apos;ll be able
            to add your brand and up to 3 competitors, pick your custom prompt
            set, and kick off your first AI visibility scan — all from here.
          </p>
          <Link
            href="/dashboard"
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors inline-block"
          >
            ← Back to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
