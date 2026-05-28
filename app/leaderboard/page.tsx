import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import type { BrandScore, BrandGap } from "@/components/LeaderboardTable";

export const metadata: Metadata = {
  title: "AI Visibility Index — Top 100 B2B SaaS Brands | NeuralReach",
  description:
    "See how the top B2B SaaS brands rank for AI search visibility across ChatGPT, Claude, and Perplexity. Free leaderboard — all scores measured with real API calls.",
  openGraph: {
    title: "AI Visibility Index — Top 100 B2B SaaS Brands",
    description:
      "Ranked by how often they appear in AI recommendations across 3 platforms and 25 prompts. All scores verified via live API calls.",
    type: "website",
  },
};

// ── Real-data JSON shape (from data/leaderboard.json) ─────────────────────────

interface NewBrand {
  slug: string;
  brand: string;
  url: string;
  rank: number;
  avs_brand: number;
  avs_per_llm: {
    openai?: number;
    anthropic?: number;
    perplexity?: number;
  };
  prompts_scored: number;
  run_date: string;
  top_gap: string | null;
  top_gap_prompt: string | null;
  verified: boolean;
  category: string;
  category_long: string;
  tier: "anchor" | "tier2" | "tier1" | "niche";
  gaps: BrandGap[];
}

interface LeaderboardData {
  run_date: string;
  generated_at: string;
  total_brands: number;
  active_llms: string[];
  brands: NewBrand[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_BADGE: Record<NewBrand["tier"], string | null> = {
  anchor:  "Top Performer",
  tier2:   "Established",
  tier1:   null,
  niche:   null,
};

function toFixed1(n: number): number {
  return Math.round(n * 10) / 10;
}

function transformBrand(v: NewBrand): BrandScore {
  return {
    rank:          v.rank,
    id:            v.slug,
    name:          v.brand,
    category:      v.category || "B2B SaaS",
    category_long: v.category_long || v.category || "B2B SaaS",
    website:       v.url,
    overall_score: toFixed1(v.avs_brand),
    scores: {
      chatgpt:    toFixed1(v.avs_per_llm.openai ?? 0),
      claude:     toFixed1(v.avs_per_llm.anthropic ?? 0),
      perplexity: toFixed1(v.avs_per_llm.perplexity ?? 0),
      google_aio: 0,   // Google AIO not included in this run
    },
    trend:       "stable",
    badge:       TIER_BADGE[v.tier] ?? null,
    tier:        v.tier,
    gaps:        v.gaps ?? [],
    data_source: v.verified ? `verified_${v.run_date}` : undefined,
  };
}

// ── Data loader (runs at build time → pure SSG) ───────────────────────────────

function getLeaderboardData(): {
  brands: BrandScore[];
  note: string;
  generated_at: string;
  run_date: string;
} {
  const filePath = path.join(process.cwd(), "data", "leaderboard.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as LeaderboardData;

  const brands = data.brands
    .sort((a, b) => a.rank - b.rank)
    .map(transformBrand);

  const note =
    `${data.total_brands} brands scored live on ${data.run_date} via real API calls to OpenAI, Anthropic & Perplexity (${data.total_brands * 25} total prompts).`;

  return {
    brands,
    note,
    generated_at: data.generated_at,
    run_date: data.run_date,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { brands, note, generated_at, run_date } = getLeaderboardData();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Sticky nav ─────────────────────────────────────── */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href="/"
              className="text-xl font-bold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
            >
              NeuralReach
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/methodology"
                className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Methodology
              </Link>
              <Link
                href="/#pricing"
                className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Pricing
              </Link>
              {/* Scroll to waitlist — JS-free anchor */}
              <a
                href="#waitlist"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                Get Early Access
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ── All interactive leaderboard content (client island) */}
      <main>
        <LeaderboardSection
          brands={brands}
          note={note}
          generatedAt={generated_at}
          runDate={run_date}
        />
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <p>© 2026 NeuralMedic / NeuralReach</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-gray-600 transition-colors">
              Home
            </Link>
            <Link href="/methodology" className="hover:text-gray-600 transition-colors">
              Methodology
            </Link>
            <Link href="/#pricing" className="hover:text-gray-600 transition-colors">
              Pricing
            </Link>
            <a
              href="mailto:hello@neuralreach.de"
              className="hover:text-gray-600 transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
