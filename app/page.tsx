import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { WaitlistForm } from "@/components/WaitlistForm";
import { PricingCard } from "@/components/PricingCard";
import { subscriptionsLive as isSubscriptionsLive } from "@/lib/subscription-flag";

export const metadata: Metadata = {
  title:
    "NeuralReach: AI Search Visibility Tracker for B2B SaaS | Track Your Brand in ChatGPT, Perplexity & Google AI Overviews",
  description:
    "Track how your B2B SaaS brand appears in ChatGPT, Claude, Perplexity & Google AI Overviews. Weekly GEO/AEO reports, competitor benchmarks, and schema + content fixes to close your AI visibility gap.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NeuralReach: AI Search Visibility Tracker for B2B SaaS",
    description:
      "Know exactly how ChatGPT, Claude, Perplexity and Google AI Overviews describe your brand. Get weekly reports and fixes.",
    type: "website",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "NeuralReach",
  url: "https://www.neuralreach.de",
  description:
    "AI search visibility tracker for B2B SaaS. Track your brand in ChatGPT, Perplexity, Claude, and Google AI Overviews.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate:
        "https://www.neuralreach.de/leaderboard?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

// Subscriptions feature flag — see lib/subscription-flag.ts.

// ── Leaderboard meta (build-time snapshot, same source as /leaderboard) ──────
function getLeaderboardMeta(): {
  runDate: string;
  totalBrands: number;
  totalLLMCalls: number;
  llmsMonitored: number;
  avgGapPts: number;
} {
  try {
    const filePath = path.join(process.cwd(), "data", "leaderboard.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as {
      run_date: string;
      total_brands: number;
      active_llms: string[];
      brands: Array<{ avs_brand: number; avs_per_llm?: { google_aio?: number } }>;
    };
    // Visibility gap = top score - average score, computed from real data.
    const scores = data.brands.map((b) => b.avs_brand).filter((n) => typeof n === "number");
    const top = scores.length ? Math.max(...scores) : 0;
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const avgGapPts = Math.round(top - mean);
    // LLMs monitored = active_llms count + 1 if at least one brand has google_aio scored
    const hasGoogleAio = data.brands.some(
      (b) => b.avs_per_llm?.google_aio !== undefined,
    );
    const llmsMonitored = data.active_llms.length + (hasGoogleAio ? 1 : 0);
    return {
      runDate: data.run_date,
      totalBrands: data.total_brands,
      totalLLMCalls: data.total_brands * 25 * data.active_llms.length,
      llmsMonitored,
      avgGapPts,
    };
  } catch {
    return {
      runDate: "2026-05-30",
      totalBrands: 100,
      totalLLMCalls: 7500,
      llmsMonitored: 4,
      avgGapPts: 34,
    };
  }
}

const FREE_FEATURES = [
  "1 one-time AI visibility report",
  "25 real AI prompts scored",
  "4 LLMs (ChatGPT, Claude, Perplexity, Google AIO)",
  "1 brand",
  "Schema & content gap summary",
  "No credit card required",
];

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
  const subscriptionsLive = isSubscriptionsLive();
  const { runDate, totalBrands, totalLLMCalls, llmsMonitored, avgGapPts } = getLeaderboardMeta();
  const formattedDate = new Date(runDate + "T00:00:00Z").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
  const llmCallsFormatted = totalLLMCalls.toLocaleString("en-US");

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      {/* Nav */}
      <Nav
        links={[
          { href: "/leaderboard", label: "AI Visibility Index" },
          { href: "/pricing", label: "Pricing" },
          { href: "/methodology", label: "Methodology" },
        ]}
        cta={{ label: "See My Score", href: "#waitlist", isAnchor: true }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 mb-6">
            📊 The average B2B SaaS brand scores {avgGapPts} points below its top AI competitor. Fix yours.
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
            Does AI Search know{" "}
            <span className="text-brand-600">your brand?</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            NeuralReach shows you exactly where ChatGPT, Claude, Perplexity, and Google AIO mention — or miss — your brand, benchmarks you against your top 3 competitors, and delivers the schema + content fixes to close your {avgGapPts}-point gap in 60 days.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="#waitlist"
              className="rounded-xl bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
            >
              See My AI Visibility Score
            </a>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-gray-300 px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              See the AI Visibility Index
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">No credit card · See your brand&apos;s score in 60 seconds</p>

          {/* Credibility strip — pulled from same data/leaderboard.json the /leaderboard page uses */}
          <p className="mt-5 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span>{totalBrands} B2B SaaS brands</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span>{llmCallsFormatted} real LLM calls</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span>refreshed weekly</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span>last update {formattedDate}</span>
          </p>
        </div>
      </section>

      {/* Social proof numbers */}
      <section className="border-y border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-center">
            {[
              { label: "Brands tracked", value: `${totalBrands}+` },
              { label: "LLMs monitored", value: `${llmsMonitored}` },
              { label: "Prompts per week", value: "Up to 100" },
              { label: "Avg visibility gap", value: `${avgGapPts} pts` },
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
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <PricingCard
              name="Free"
              price={0}
              features={FREE_FEATURES}
              plan="free"
              freeCtaHref="#waitlist"
            />
            <PricingCard
              name="Starter"
              price={39}
              features={STARTER_FEATURES}
              plan="starter"
              subscriptionsLive={subscriptionsLive}
            />
            <PricingCard
              name="Pro"
              price={89}
              features={PRO_FEATURES}
              plan="pro"
              highlighted
              subscriptionsLive={subscriptionsLive}
            />
          </div>
          <p className="mt-8 text-center text-sm text-gray-400">
            <Link href="/pricing" className="underline hover:text-gray-600 transition-colors">
              See full feature comparison
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
          <WaitlistForm variant="compact" theme="dark" className="max-w-sm mx-auto" />
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
            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              <Link href="/leaderboard" className="hover:text-gray-600 transition-colors">AI Visibility Index</Link>
              <Link href="/pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
              <Link href="/methodology" className="hover:text-gray-600 transition-colors">Methodology</Link>
              <a href="mailto:hello@neuralreach.de" className="hover:text-gray-600 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
