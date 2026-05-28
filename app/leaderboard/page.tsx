import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import type { BrandScore, BrandGap } from "@/components/LeaderboardTable";

export const metadata: Metadata = {
  title: "AI Visibility Index — Top 100 B2B SaaS Brands | NeuralReach",
  description:
    "See how the top B2B SaaS brands rank for AI search visibility across ChatGPT, Claude, Perplexity, and Google AI Overviews. Free leaderboard updated weekly.",
  openGraph: {
    title: "AI Visibility Index — Top 100 B2B SaaS Brands",
    description:
      "Ranked by how often they appear in AI recommendations across 4 platforms and 25 prompts.",
    type: "website",
  },
};

// ── v1 raw JSON shape (from data/leaderboard_v1.json) ─────────────────────────

interface V1Brand {
  brand: string;
  domain: string;
  category: string;
  category_long: string;
  tier: "anchor" | "tier2" | "tier1" | "niche";
  composite_score: number;
  scores: {
    openai: { score: number; label: string };
    anthropic: { score: number; label: string };
    perplexity: { score: number; label: string };
    google: { score: number; label: string };
  };
  gaps: BrandGap[];
  rank: number;
  /** "verified_YYYY-MM-DD" = live API score | "estimated" = research-based estimate */
  data_source?: string;
}

interface V1Data {
  generated_at: string;
  scoring_method: string;
  scoring_note: string;
  total_brands: number;
  brands: V1Brand[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_BADGE: Record<V1Brand["tier"], string | null> = {
  anchor: "Top Performer",
  tier2:  "Established",
  tier1:  null,
  niche:  null,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toFixed1(n: number): number {
  return Math.round(n * 10) / 10;
}

function transformBrand(v: V1Brand): BrandScore {
  return {
    rank:          v.rank,
    id:            slugify(v.brand),
    name:          v.brand,
    category:      v.category,
    category_long: v.category_long,
    website:       v.domain,
    overall_score: toFixed1(v.composite_score),
    scores: {
      chatgpt:    toFixed1(v.scores.openai.score),
      claude:     toFixed1(v.scores.anthropic.score),
      perplexity: toFixed1(v.scores.perplexity.score),
      google_aio: toFixed1(v.scores.google.score),
    },
    trend:       "stable",
    badge:       TIER_BADGE[v.tier],
    tier:        v.tier,
    gaps:        v.gaps ?? [],
    data_source: v.data_source,
  };
}

// ── Data loader (runs at build time → pure SSG) ───────────────────────────────

function getLeaderboardData(): { brands: BrandScore[]; note: string; generated_at: string } {
  const filePath = path.join(process.cwd(), "data", "leaderboard_v1.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as V1Data;

  const brands = data.brands
    .sort((a, b) => a.rank - b.rank)
    .map(transformBrand);

  return {
    brands,
    note: data.scoring_note,
    generated_at: data.generated_at,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { brands, note, generated_at } = getLeaderboardData();

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
            <Link href="/#pricing" className="hover:text-gray-600 transition-colors">
              Pricing
            </Link>
            <a
              href="mailto:hello@neuralreach.io"
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
