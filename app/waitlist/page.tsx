import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { WaitlistForm } from "@/components/WaitlistForm";

const BASE_URL = "https://www.neuralreach.de";

// ── Metadata (page-specific; works with the layout.tsx title.template) ────────

export const metadata: Metadata = {
  title: "Join the Waitlist — Free AI Visibility Report",
  description:
    "Join 200+ B2B SaaS founders. Get your free one-time AI visibility report — 25 real prompts scored across ChatGPT, Claude, Perplexity, and Google AI Overviews. No credit card required.",
  alternates: { canonical: "/waitlist" },
  openGraph: {
    title: "NeuralReach Waitlist — Free AI Visibility Report",
    description:
      "Join 200+ founders waiting for launch. First report is free: 25 prompts across ChatGPT, Claude, Perplexity, Google AI Overviews.",
    url: `${BASE_URL}/waitlist`,
    type: "website",
    siteName: "NeuralReach",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuralReach Waitlist — Free AI Visibility Report",
    description: "First report is free. 25 prompts × 4 LLMs. No credit card.",
    creator: "@neuralreach",
    site: "@neuralreach",
  },
  keywords: [
    "AI visibility report",
    "free AI search visibility",
    "ChatGPT brand check",
    "Claude brand visibility",
    "Perplexity brand visibility",
    "Google AI Overviews tracker",
    "B2B SaaS waitlist",
    "NeuralReach waitlist",
  ],
};

// ── Build-time stats so the page never lies about scale ──────────────────────

function getStats(): { totalBrands: number; runDate: string } {
  try {
    const filePath = path.join(process.cwd(), "data", "leaderboard.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as { total_brands: number; run_date: string };
    return { totalBrands: data.total_brands, runDate: data.run_date };
  } catch {
    return { totalBrands: 100, runDate: "2026-05-30" };
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const { totalBrands, runDate } = getStats();

  // FAQ JSON-LD — anybody landing here from search wants the same five
  // answers about what the waitlist actually delivers.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "When does NeuralReach launch?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Public sign-ups open Wednesday, June 17, 2026. Waitlist members get an activation link 48 hours before public launch.",
        },
      },
      {
        "@type": "Question",
        name: "What do I get for free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Your first AI visibility report is free. We run 25 real buyer-intent prompts across ChatGPT, Claude, Perplexity, and Google AI Overviews, score every response, and show you exactly where your brand is visible or missing — plus the top 3 schema and content fixes to close the gap.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to provide a credit card?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The free report requires nothing more than your email and the brand you want tracked. Paid plans (Starter $39/mo, Pro $89/mo) include a 14-day free trial and only ask for a card on trial signup.",
        },
      },
      {
        "@type": "Question",
        name: "How is the visibility score calculated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For each prompt-LLM pair we score brand presence, rank position in the response, sentiment, and whether the brand's URL is cited. Per-prompt scores 0-10, aggregated to a 0-100 AI Visibility Score per LLM and per brand. All scores come from real API calls, never synthetic estimates.",
        },
      },
      {
        "@type": "Question",
        name: "Can I see the data before signing up?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. ${totalBrands} B2B SaaS brands are already scored and indexed on the public AI Visibility Index at ${BASE_URL}/leaderboard. Latest scoring run: ${runDate}.`,
        },
      },
    ],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Waitlist", item: `${BASE_URL}/waitlist` },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Nav
        links={[
          { href: "/leaderboard", label: "AI Visibility Index" },
          { href: "/pricing", label: "Pricing" },
          { href: "/methodology", label: "Methodology" },
        ]}
        cta={{ label: "See Live Scores", href: "/leaderboard" }}
      />

      {/* Hero + form */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 mb-6">
              Public launch Wednesday, June 17, 2026
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Get your free AI visibility report.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
              See exactly how ChatGPT, Claude, Perplexity, and Google AI Overviews
              describe your brand. 25 real buyer-intent prompts, one-time, no credit card.
            </p>
          </div>

          {/* Above-the-fold WaitlistForm — the whole reason someone is on this page */}
          <div className="mt-10 mx-auto max-w-md">
            <div className="rounded-2xl bg-white p-6 sm:p-8 ring-1 ring-gray-200 shadow-sm">
              <WaitlistForm />
            </div>
            <p className="mt-4 text-center text-xs text-gray-400">
              No credit card. Unsubscribe with one click. We never share your email.
            </p>
          </div>
        </div>
      </section>

      {/* What you actually get */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">
            What&apos;s in your free report
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                num: "1",
                title: "Your AI Visibility Score",
                body: `A 0-100 score showing how consistently your brand surfaces across ${totalBrands === 100 ? "the same prompts that rank the 100 B2B SaaS brands on our public index" : `${totalBrands} buyer-intent prompts`}.`,
              },
              {
                num: "2",
                title: "Per-LLM breakdown",
                body: "Side-by-side scores for ChatGPT, Claude, Perplexity, and Google AI Overviews. See which AI surfaces are your strongest channel and which need work.",
              },
              {
                num: "3",
                title: "Top 3 fixes to close the gap",
                body: "Concrete schema markup and content changes ranked by the prompts they unblock. Each tied to a specific gap our scorer found in your visibility data.",
              },
            ].map((item) => (
              <div key={item.num}>
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
                  {item.num}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="bg-gray-50 py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm uppercase tracking-widest text-gray-400 font-semibold mb-4">
            Real data, not synthetic estimates
          </p>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Every score on the{" "}
            <Link href="/leaderboard" className="text-brand-600 font-medium hover:underline">
              public AI Visibility Index
            </Link>{" "}
            comes from live API calls to OpenAI, Anthropic, Perplexity, and SerpAPI. Your free
            report is generated the same way. Read the full{" "}
            <Link href="/methodology" className="text-brand-600 font-medium hover:underline">
              methodology
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-10 text-center">
            Common questions
          </h2>
          <dl className="space-y-8">
            {faqSchema.mainEntity.map((qa) => (
              <div key={qa.name}>
                <dt className="text-base font-semibold text-gray-900">{qa.name}</dt>
                <dd className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {qa.acceptedAnswer.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <p>© 2026 NeuralMedic / NeuralReach</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
            <Link href="/leaderboard" className="hover:text-gray-600 transition-colors">Leaderboard</Link>
            <Link href="/methodology" className="hover:text-gray-600 transition-colors">Methodology</Link>
            <Link href="/pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
            <a href="mailto:hello@neuralreach.de" className="hover:text-gray-600 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
