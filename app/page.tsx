import Link from "next/link";
import { WaitlistForm } from "@/components/WaitlistForm";
import { PricingCard } from "@/components/PricingCard";

const STARTER_FEATURES = [
  "25 AI prompts per week",
  "4 LLMs tracked (ChatGPT, Claude, Perplexity, Google AIO)",
  "1 brand monitored",
  "Weekly email report",
  "30-day history",
];

const PRO_FEATURES = [
  "100 AI prompts per week",
  "4 LLMs tracked",
  "Up to 4 brands (yours + 3 competitors)",
  "Weekly + on-demand reports",
  "Full history + trend charts",
  "Schema & content fix recommendations",
  "Priority support",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-brand-700">NeuralReach</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/leaderboard"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:inline"
              >
                AI Visibility Index →
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/methodology"
                className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Methodology
              </Link>
              <a
                href="#waitlist"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Get Early Access
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 mb-6">
            🚀 Now tracking 100 B2B SaaS brands — see the leaderboard
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
            Does AI Search know{" "}
            <span className="text-brand-600">your brand?</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            NeuralReach shows you exactly how ChatGPT, Claude, Perplexity, and Google AI Overviews describe your B2B SaaS — and gives you the fixes to close the visibility gap before your competitors do.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="#waitlist"
              className="rounded-xl bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
            >
              Get Early Access — Free
            </a>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-gray-300 px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              See the AI Visibility Index
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">No credit card required. 2-minute setup.</p>
        </div>
      </section>

      {/* Social proof numbers */}
      <section className="border-y border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-center">
            {[
              { label: "Brands tracked", value: "100+" },
              { label: "LLMs monitored", value: "4" },
              { label: "Prompts per week", value: "Up to 100" },
              { label: "Avg visibility gap", value: "34 pts" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-sm text-gray-500">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Add your brand",
                desc: "Tell us your product name, website, and up to 3 competitors. Takes 2 minutes.",
              },
              {
                step: "02",
                title: "We run the checks",
                desc: "Every week we query ChatGPT, Claude, Perplexity, and Google AI Overviews with 25–100 prompts relevant to your category.",
              },
              {
                step: "03",
                title: "Get your fix list",
                desc: "We highlight where you're invisible or misrepresented, and give you schema + content changes to fix it.",
              },
            ].map((item) => (
              <div key={item.step} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <div className="text-4xl font-extrabold text-brand-100 mb-3">{item.step}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white" id="pricing">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Simple pricing</h2>
            <p className="mt-3 text-gray-500">
              14-day free trial. No credit card billed until day 15.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 max-w-2xl mx-auto">
            <PricingCard name="Starter" price={39} features={STARTER_FEATURES} plan="starter" />
            <PricingCard name="Pro" price={89} features={PRO_FEATURES} plan="pro" highlighted />
          </div>
          <p className="mt-8 text-center text-sm text-gray-400">
            <Link href="/pricing" className="underline hover:text-gray-600 transition-colors">
              See full feature comparison →
            </Link>
          </p>
        </div>
      </section>

      {/* Waitlist CTA */}
      <section className="py-20 bg-brand-600" id="waitlist">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            Be first to know when we launch
          </h2>
          <p className="text-brand-200 mb-8 text-lg">
            Join 200+ B2B SaaS founders tracking their AI search visibility.
          </p>
          <WaitlistForm variant="compact" className="max-w-sm mx-auto" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-semibold text-brand-700">NeuralReach</span>
            <p className="text-xs text-gray-400">
              © 2026 NeuralMedic / NeuralReach. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-gray-400">
              <Link href="/leaderboard" className="hover:text-gray-600">AI Visibility Index</Link>
              <a href="mailto:hello@neuralreach.de" className="hover:text-gray-600">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
