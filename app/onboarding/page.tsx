"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── /onboarding ───────────────────────────────────────────────────────────────
// First-run setup for paying/trialing customers.
// Protected by middleware — unauthenticated visitors are redirected to /login.
//
// Fields:
//   brand_name        — required, the brand to track
//   domain            — required, the brand's website domain
//   competitor_domains — optional, up to 3 competitor domains for benchmarking
//
// On submit: POST /api/onboarding → { redirect: '/dashboard' }

export default function OnboardingPage() {
  const router = useRouter();

  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");
  // Start with one empty competitor slot so the user sees the section immediately
  const [competitorDomains, setCompetitorDomains] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Competitor helpers ─────────────────────────────────────────────────────

  const addCompetitor = () => {
    if (competitorDomains.length < 3) {
      setCompetitorDomains([...competitorDomains, ""]);
    }
  };

  const removeCompetitor = (idx: number) => {
    setCompetitorDomains(competitorDomains.filter((_, i) => i !== idx));
  };

  const updateCompetitor = (idx: number, value: string) => {
    setCompetitorDomains(
      competitorDomains.map((d, i) => (i === idx ? value : d))
    );
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Filter out blank competitor slots
    const cleanedCompetitors = competitorDomains
      .map((d) => d.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName.trim(),
          domain: domain.trim(),
          competitor_domains: cleanedCompetitors,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json();
      // Server tells us where to go next (always /dashboard for now)
      router.push(data.redirect ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 py-12 px-4">
        <div className="mx-auto max-w-lg">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8 text-xs text-gray-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-[10px]">
              1
            </span>
            <span className="font-medium text-gray-700">Add your brand</span>
            <span className="mx-1 text-gray-300">→</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 font-bold text-[10px]">
              2
            </span>
            <span>See your results</span>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Set up your brand
            </h1>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              We&apos;ll run AI prompts across ChatGPT, Claude, Perplexity, and
              Google AI Overviews to measure how visible your brand is — and
              which competitors outrank you.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Brand name */}
              <div>
                <label
                  htmlFor="brand_name"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Brand name <span className="text-red-500">*</span>
                </label>
                <input
                  id="brand_name"
                  type="text"
                  required
                  autoComplete="organization"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-3 min-h-[44px] text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
                />
              </div>

              {/* Brand domain */}
              <div>
                <label
                  htmlFor="domain"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Your domain <span className="text-red-500">*</span>
                </label>
                <input
                  id="domain"
                  type="text"
                  required
                  autoComplete="url"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="acmecorp.com"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-3 min-h-[44px] text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Just the domain — we&apos;ll handle the https:// prefix.
                </p>
              </div>

              {/* Competitor domains */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Competitor domains{" "}
                    <span className="text-gray-400 font-normal">
                      (optional, up to 3)
                    </span>
                  </label>
                  {competitorDomains.length < 3 && (
                    <button
                      type="button"
                      onClick={addCompetitor}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      + Add competitor
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  We&apos;ll include these in prompts so you can see how you
                  rank against them.
                </p>

                <div className="space-y-2">
                  {competitorDomains.map((d, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={d}
                        onChange={(e) => updateCompetitor(idx, e.target.value)}
                        placeholder={`competitor${idx + 1}.com`}
                        className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
                      />
                      {competitorDomains.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCompetitor(idx)}
                          aria-label={`Remove competitor ${idx + 1}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !brandName.trim() || !domain.trim()}
                className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Saving…" : "Start tracking →"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
