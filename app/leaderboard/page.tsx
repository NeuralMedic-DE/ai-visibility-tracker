import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import type { BrandScore, BrandGap } from "@/components/LeaderboardTable";

export const metadata: Metadata = {
  title:
    "AI Visibility Index: Top 100 B2B SaaS Brands Ranked | NeuralReach",
  description:
    "See how 100 B2B SaaS brands rank for AI search visibility across ChatGPT, Claude, and Perplexity. Free leaderboard: all scores verified via live API calls. Track your brand in AI search with GEO/AEO scoring.",
  alternates: {
    canonical: "/leaderboard",
  },
  openGraph: {
    title: "AI Visibility Index: Top 100 B2B SaaS Brands",
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
    google_aio?: number;
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
      // Preserve null for unscored brands (24 of 100 fell outside the 250-query
      // SerpAPI free-tier budget). The UI renders "—" instead of "0" for these
      // so visitors don't misread "we measured and got nothing".
      google_aio: v.avs_per_llm.google_aio === undefined ? null : toFixed1(v.avs_per_llm.google_aio),
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

const BASE_URL = "https://www.neuralreach.de";

export default function LeaderboardPage() {
  const { brands, note, generated_at, run_date } = getLeaderboardData();

  // Build Dataset + ItemList JSON-LD from live brand data
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "AI Visibility Index by NeuralReach",
    description:
      "100 B2B SaaS brands scored for AI search visibility across ChatGPT (GPT-4o), Claude (Haiku 4.5), and Perplexity (Sonar Pro), using 25 buyer-intent prompts per brand via live API calls.",
    url: `${BASE_URL}/leaderboard`,
    creator: {
      "@type": "Organization",
      name: "NeuralReach",
      url: BASE_URL,
    },
    datePublished: run_date,
    dateModified: run_date,
    variableMeasured: "AI Visibility Score (AVS)",
    measurementTechnique:
      "Live API calls to OpenAI GPT-4o, Anthropic Claude Haiku 4.5, and Perplexity Sonar Pro",
    license: "https://creativecommons.org/licenses/by/4.0/",
    keywords: [
      "AI search visibility",
      "AI visibility tracker",
      "GEO",
      "AEO",
      "generative engine optimization",
      "answer engine optimization",
      "B2B SaaS",
      "ChatGPT visibility",
      "Perplexity visibility",
    ],
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "AI Visibility Index: Top 100 B2B SaaS Brands",
    description:
      "Ranked by AI Visibility Score (AVS) — how consistently each brand surfaces in ChatGPT, Claude, and Perplexity recommendations across 25 buyer-intent prompts.",
    url: `${BASE_URL}/leaderboard`,
    numberOfItems: brands.length,
    itemListElement: brands.map((brand) => ({
      "@type": "ListItem",
      position: brand.rank,
      name: brand.name,
      url: `${BASE_URL}/leaderboard/${brand.id}`,
      description: `${brand.name} AI Visibility Score: ${brand.overall_score}/100 (Rank #${brand.rank} in ${brand.category})`,
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      {/* ── Sticky nav ─────────────────────────────────────── */}
      <Nav
        links={[
          { href: "/methodology", label: "Methodology" },
          { href: "/pricing", label: "Pricing" },
        ]}
        cta={{ label: "Get Early Access", href: "#waitlist", isAnchor: true }}
      />

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
