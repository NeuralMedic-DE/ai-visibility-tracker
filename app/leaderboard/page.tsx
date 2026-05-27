import Link from "next/link";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { WaitlistForm } from "@/components/WaitlistForm";
import fixture from "@/data/leaderboard-fixture.json";

export const metadata = {
  title: "AI Visibility Index — Top 100 B2B SaaS Brands | NeuralReach",
  description:
    "See how the top B2B SaaS brands rank for AI search visibility across ChatGPT, Claude, Perplexity, and Google AI Overviews.",
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
            <a
              href="#waitlist"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Get Early Access
            </a>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="bg-gradient-to-b from-brand-50 to-white py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 mb-4">
            Updated {new Date(fixture.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            AI Visibility Index
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
            How well do the top B2B SaaS brands appear when founders ask AI for tool recommendations? Scored across ChatGPT, Claude, Perplexity, and Google AI Overviews.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>80+ = High visibility
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>60–79 = Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>40–59 = Low
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>&lt;40 = At risk
            </span>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LeaderboardTable brands={fixture.brands as any} />
          <p className="mt-4 text-xs text-gray-400 text-center">
            {fixture.note} · Scores are averages across 25 prompts per LLM per brand.
          </p>
        </div>
      </section>

      {/* CTA to track your own brand */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Not on the list? Track your brand.
          </h2>
          <p className="text-gray-600 mb-8">
            Get weekly AI visibility reports for your B2B SaaS — and see exactly how you compare to competitors.
          </p>
          <WaitlistForm variant="compact" className="max-w-sm mx-auto" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 bg-white" id="waitlist">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-gray-400">
            © 2026 NeuralMedic / NeuralReach · <a href="/" className="hover:text-gray-600">Home</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
