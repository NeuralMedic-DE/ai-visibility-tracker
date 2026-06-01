import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { cn } from "@/lib/cn";
import { Nav } from "@/components/Nav";
import { WaitlistForm } from "@/components/WaitlistForm";

// ── Data types ────────────────────────────────────────────────────────────────

interface GapPrompt {
  prompt_id: string;
  prompt_text: string;
  prompt_category: string;
  llms_missing: string[];
  llms_missing_count: number;
  why_it_matters: string;
}

interface LlmDetail {
  label: string;
  avs: number;
  prompts_scored: number;
}

interface BrandDetail {
  slug: string;
  brand: string;
  url: string;
  rank: number;
  avs_brand: number;
  avs_per_llm: Record<string, number>;
  prompts_scored: number;
  run_date: string;
  verified: boolean;
  category: string;
  category_long: string;
  tier: string;
  gap_prompts: GapPrompt[];
  llm_details: Record<string, LlmDetail>;
  total_brands: number;
}

// ── Static generation ─────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const brandsDir = path.join(process.cwd(), "data", "brands");
  const files = fs.readdirSync(brandsDir);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ slug: f.replace(".json", "") }));
}

function getBrandDetail(slug: string): BrandDetail | null {
  const filePath = path.join(process.cwd(), "data", "brands", `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as BrandDetail;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

const BASE_URL = "https://www.neuralreach.de";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const brand = getBrandDetail(params.slug);
  if (!brand) {
    return {
      title: "Brand Not Found | NeuralReach",
    };
  }
  return {
    title: `${brand.brand} AI Visibility Score: ${brand.avs_brand.toFixed(1)}/100 — Rank #${brand.rank} of ${brand.total_brands} | NeuralReach`,
    description: `${brand.brand} scores ${brand.avs_brand.toFixed(1)}/100 for AI search visibility in ChatGPT, Claude & Perplexity (${brand.prompts_scored * 3} live API prompts, run ${brand.run_date}). See visibility gaps + GEO/AEO fix recommendations.`,
    alternates: {
      canonical: `/leaderboard/${params.slug}`,
    },
    openGraph: {
      title: `${brand.brand} AI Visibility Score: ${brand.avs_brand.toFixed(1)}/100`,
      description: `Rank #${brand.rank} of ${brand.total_brands} B2B SaaS brands. See exactly which AI prompts ${brand.brand} is missing and what to fix.`,
      type: "website",
    },
  };
}

// ── Helper components ─────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-blue-700";
  if (score >= 40) return "text-yellow-700";
  return "text-red-700";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-blue-100 text-blue-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-500";
}

function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    anchor: "Top Performer",
    tier2: "Established",
    tier1: "Growing",
    niche: "Niche",
  };
  return map[tier] ?? tier;
}

const LLM_LABELS: Record<string, string> = {
  openai: "ChatGPT (GPT-4o)",
  anthropic: "Claude (Haiku 4.5)",
  perplexity: "Perplexity (Sonar Pro)",
};

const CATEGORY_LABEL: Record<string, string> = {
  category_discovery: "Discovery",
  comparison: "Comparison",
  alternatives: "Alternatives",
  use_case: "Use Case",
  integration: "Integration",
};

const LLM_MISSING_LABEL: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  perplexity: "Perplexity",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrandDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const brand = getBrandDetail(params.slug);

  if (!brand) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Brand not found</h1>
          <p className="text-gray-500 mb-6">No AI visibility data for this brand slug.</p>
          <Link
            href="/leaderboard"
            className="text-brand-600 hover:text-brand-800 underline"
          >
            Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const runDateLabel = new Date(brand.run_date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const llmEntries = Object.entries(brand.llm_details);

  const brandPageUrl = `${BASE_URL}/leaderboard/${brand.slug}`;

  // Build structured data for this brand page
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "AI Visibility Index",
        item: `${BASE_URL}/leaderboard`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: brand.brand,
        item: brandPageUrl,
      },
    ],
  };

  const brandDatasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${brand.brand} AI Visibility Score Data`,
    description: `AI search visibility scores for ${brand.brand} across ChatGPT (GPT-4o), Claude (Haiku 4.5), and Perplexity (Sonar Pro). Measured via ${brand.prompts_scored * 3} live API prompts across 5 buyer-intent categories on ${brand.run_date}. Composite AVS: ${brand.avs_brand.toFixed(1)}/100, Rank #${brand.rank} of ${brand.total_brands} B2B SaaS brands.`,
    url: brandPageUrl,
    creator: {
      "@type": "Organization",
      name: "NeuralReach",
      url: BASE_URL,
    },
    datePublished: brand.run_date,
    dateModified: brand.run_date,
    about: {
      "@type": "Organization",
      name: brand.brand,
      url: `https://${brand.url}`,
    },
    variableMeasured: "AI Visibility Score (AVS)",
    measurementTechnique:
      "Live API calls to OpenAI GPT-4o, Anthropic Claude Haiku 4.5, and Perplexity Sonar Pro",
    keywords: [
      `${brand.brand} AI visibility`,
      `${brand.brand} ChatGPT`,
      `${brand.brand} Perplexity`,
      `${brand.brand} AI search`,
      "AEO",
      "GEO",
      brand.category,
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandDatasetSchema) }}
      />
      {/* ── Sticky nav ─────────────────────────────────────── */}
      <Nav
        links={[
          { href: "/leaderboard", label: "Leaderboard" },
          { href: "/pricing", label: "Pricing" },
          { href: "/methodology", label: "Methodology" },
        ]}
        cta={{ label: "Track my brand", href: "#get-report", isAnchor: true }}
      />

      <main>
        {/* ── Breadcrumb ──────────────────────────────────────── */}
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/leaderboard" className="hover:text-gray-700 transition-colors">AI Visibility Index</Link>
              <span aria-hidden="true">/</span>
              <span className="text-gray-900 font-medium">{brand.brand}</span>
            </nav>
          </div>
        </div>

        {/* ── Brand Hero ──────────────────────────────────────── */}
        <section className="bg-gradient-to-b from-brand-50 to-white py-10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              {/* Brand info */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      "bg-brand-100 text-brand-700 ring-1 ring-brand-200"
                    )}
                  >
                    {tierLabel(brand.tier)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                    {/* checkmark */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
                      <path fillRule="evenodd" d="M10.53 2.47a.75.75 0 0 1 0 1.06L5.06 9l-3.59-3.59a.75.75 0 0 1 1.06-1.06L5.06 6.88l4.41-4.41a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                    </svg>
                    Verified — {runDateLabel}
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                  {brand.brand}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  <a
                    href={`https://${brand.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-600 transition-colors underline underline-offset-2"
                  >
                    {brand.url}
                  </a>
                  {brand.category_long && (
                    <> &middot; {brand.category_long}</>
                  )}
                </p>
              </div>

              {/* Big score */}
              <div className="flex flex-col items-center sm:items-end shrink-0">
                <div
                  className={cn(
                    "text-5xl font-black tabular-nums px-4 py-3 rounded-2xl",
                    scoreBg(brand.avs_brand)
                  )}
                >
                  {brand.avs_brand.toFixed(1)}
                  <span className="text-lg font-normal opacity-60">/100</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 text-center sm:text-right">
                  Rank <span className="font-bold text-gray-700">#{brand.rank}</span> of {brand.total_brands} brands
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  AI Visibility Score (AVS)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Per-LLM Breakdown ───────────────────────────────── */}
        <section className="py-10 border-b border-gray-100">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              AI Platform Breakdown
            </h2>
            <div className="grid sm:grid-cols-3 gap-5 sm:gap-6">
              {llmEntries.map(([llmKey, llm]) => {
                const score = llm.avs;
                const label = LLM_LABELS[llmKey] || llm.label;
                return (
                  <div
                    key={llmKey}
                    className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                      {label}
                    </p>
                    <div className="flex items-end justify-between mb-3">
                      <span
                        className={cn(
                          "text-3xl font-extrabold tabular-nums",
                          scoreColor(score)
                        )}
                      >
                        {score.toFixed(1)}
                        <span className="text-sm font-normal text-gray-400">/100</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100">
                      <div
                        className={cn("h-2.5 rounded-full transition-all", scoreBarColor(score))}
                        style={{ width: `${Math.min(score, 100)}%` }}
                        aria-valuenow={score}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        role="progressbar"
                        aria-label={`${label} score`}
                      />
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                      {llm.prompts_scored} prompts scored
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Scores are averages across {brand.prompts_scored} prompts per AI platform, covering 5
              categories: discovery, comparison, alternatives, use case, and integration queries.
              Scored via live API calls on {runDateLabel}.
            </p>
          </div>
        </section>

        {/* ── Gap Analysis ─────────────────────────────────────── */}
        <section className="py-10 border-b border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                Visibility Gaps: Where {brand.brand} Is Missing
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                These are prompts where buyers couldn&apos;t find {brand.brand} in AI search results.
                Each gap represents lost pipeline from high-intent B2B buyers.
              </p>
            </div>

            {brand.gap_prompts.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
                <p className="text-green-700 font-semibold">No major gaps found!</p>
                <p className="text-green-600 text-sm mt-1">
                  {brand.brand} appeared in AI results across all tested prompts.
                </p>
              </div>
            ) : (
              <ol className="space-y-4">
                {brand.gap_prompts.map((gap, i) => {
                  const missingLabels = gap.llms_missing
                    .map((k) => LLM_MISSING_LABEL[k] || k)
                    .join(", ");
                  const catLabel = CATEGORY_LABEL[gap.prompt_category] || gap.prompt_category;

                  return (
                    <li
                      key={gap.prompt_id}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-brand-200 transition-colors"
                    >
                      <div className="flex gap-4">
                        {/* Number */}
                        <div className="shrink-0 flex items-start">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                            {i + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Category badge */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600">
                              {catLabel}
                            </span>
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600">
                              Missed by: {missingLabels}
                            </span>
                          </div>
                          {/* Prompt text */}
                          <blockquote className="relative pl-3 border-l-2 border-gray-300 mb-3">
                            <p className="text-sm font-medium text-gray-800 italic">
                              &ldquo;{gap.prompt_text}&rdquo;
                            </p>
                          </blockquote>
                          {/* Why it matters */}
                          <p className="text-xs text-gray-500 leading-relaxed">
                            <span className="font-semibold text-gray-700">Why this matters: </span>
                            {gap.why_it_matters}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="mt-4 text-xs text-gray-400">
              Gap prompts are selected by counting how many AI platforms failed to mention{" "}
              Prompts where all 3 platforms missed {brand.brand} are the highest
              priority gaps.{" "}
              <Link href="/leaderboard" className="underline hover:text-gray-600">
                Back to full leaderboard
              </Link>
            </p>
          </div>
        </section>

        {/* ── Score context ─────────────────────────────────────── */}
        <section className="py-10 border-b border-gray-100">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">How to Read This Score</h2>
            <div className="grid sm:grid-cols-4 gap-3">
              {[
                { label: "80–100", color: "bg-green-500", tier: "High visibility" },
                { label: "60–79", color: "bg-blue-500", tier: "Moderate" },
                { label: "40–59", color: "bg-yellow-400", tier: "Low visibility" },
                { label: "<40", color: "bg-red-500", tier: "At risk" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", row.color)} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-gray-800">{row.label}</p>
                    <p className="text-[10px] text-gray-500">{row.tier}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400">
              AVS (AI Visibility Score) is a 0–100 scale measuring how consistently a brand
              appears in AI-generated recommendations across 25 prompt types and 3 platforms
              (ChatGPT, Claude, Perplexity). Scores are averaged across platforms and normalized
              to 100. Methodology:{" "}
              <Link href="/leaderboard" className="underline hover:text-gray-600">
                see full leaderboard
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section className="py-16 bg-white" id="get-report">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-2">
              NeuralReach
            </p>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-3">
              Track {brand.brand}&apos;s AI Visibility, Updated Weekly
            </h2>
            <p className="text-gray-600 mb-8 text-sm sm:text-base">
              Get weekly reports showing exactly how {brand.brand} appears across ChatGPT,
              Claude, Perplexity, and Google AI Overviews. Compare against up to 3
              competitors and get actionable fixes.
            </p>
            <WaitlistForm variant="compact" className="max-w-sm mx-auto" defaultBrandInterest={brand.brand} />
            <p className="mt-3 text-xs text-gray-400">
              Free to join · No credit card · We&apos;ll notify you when {brand.brand}&apos;s next report is ready
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Ready to track your own brand?{" "}
              <Link
                href="/pricing"
                className="text-brand-600 hover:text-brand-800 font-medium underline underline-offset-2"
              >
                See pricing →
              </Link>
            </p>
          </div>
        </section>

        {/* ── Compare with others ──────────────────────────────── */}
        <section className="py-8 bg-gray-50 border-t border-gray-100">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm text-gray-600 mb-3">
              {brand.brand} is ranked <strong>#{brand.rank}</strong> of {brand.total_brands} B2B SaaS brands.
              {brand.rank > 1 && (
                <> See who ranks above them and what&apos;s driving their higher scores.</>
              )}
            </p>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors"
            >
              View full AI Visibility Leaderboard
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <p>© 2026 NeuralMedic / NeuralReach</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
            <Link href="/leaderboard" className="hover:text-gray-600 transition-colors">Leaderboard</Link>
            <Link href="/#pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
            <a href="mailto:hello@neuralreach.io" className="hover:text-gray-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
