"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  name: string;
  url: string;
}

// ── Page Component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  // Form state
  const [brandName, setBrandName] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [category, setCategory] = useState("");
  const [segment, setSegment] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([
    { name: "", url: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Competitor helpers ─────────────────────────────────────────────────────

  const addCompetitor = () => {
    if (competitors.length < 3) {
      setCompetitors([...competitors, { name: "", url: "" }]);
    }
  };

  const removeCompetitor = (idx: number) => {
    setCompetitors(competitors.filter((_, i) => i !== idx));
  };

  const updateCompetitor = (
    idx: number,
    field: keyof Competitor,
    value: string
  ) => {
    setCompetitors(
      competitors.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Normalise URL
    let url = brandUrl.trim();
    if (url && !url.startsWith("http")) url = `https://${url}`;

    // Filter out empty competitor rows
    const cleanedCompetitors = competitors
      .filter((c) => c.name.trim() && c.url.trim())
      .map((c) => ({
        name: c.name.trim(),
        url: c.url.trim().startsWith("http")
          ? c.url.trim()
          : `https://${c.url.trim()}`,
      }));

    try {
      const res = await fetch("/api/tracked-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName.trim(),
          brand_url: url,
          competitors: cleanedCompetitors,
          category: category.trim() || null,
          segment: segment.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      // Success — move to run-now step
      router.push("/dashboard/run-now");
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
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Back to dashboard
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
            <span>Run first scan</span>
            <span className="mx-1 text-gray-300">→</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 font-bold text-[10px]">
              3
            </span>
            <span>See your results</span>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Add your brand
            </h1>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              We&apos;ll run 25 AI prompts across ChatGPT, Claude, Perplexity,
              and Google AI Overviews to measure how visible your brand is.
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
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>

              {/* Brand URL */}
              <div>
                <label
                  htmlFor="brand_url"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Website URL <span className="text-red-500">*</span>
                </label>
                <input
                  id="brand_url"
                  type="url"
                  required
                  value={brandUrl}
                  onChange={(e) => setBrandUrl(e.target.value)}
                  placeholder="https://acmecorp.com"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Product category{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. CRM, project management tool, HR software"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Helps us craft better prompts. We&apos;ll infer it from your
                  URL if left blank.
                </p>
              </div>

              {/* Segment */}
              <div>
                <label
                  htmlFor="segment"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Target segment{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="segment"
                  type="text"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  placeholder="e.g. B2B SaaS startups, mid-market e-commerce, enterprise HR teams"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>

              {/* Competitors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Competitors{" "}
                    <span className="text-gray-400 font-normal">(optional, up to 3)</span>
                  </label>
                  {competitors.length < 3 && (
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
                  We&apos;ll include your competitors in the prompts to benchmark
                  where you stand relative to them.
                </p>

                <div className="space-y-3">
                  {competitors.map((comp, idx) => (
                    <div key={idx} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Competitor {idx + 1}
                        </span>
                        {competitors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCompetitor(idx)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={comp.name}
                          onChange={(e) =>
                            updateCompetitor(idx, "name", e.target.value)
                          }
                          placeholder="Name"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
                        />
                        <input
                          type="text"
                          value={comp.url}
                          onChange={(e) =>
                            updateCompetitor(idx, "url", e.target.value)
                          }
                          placeholder="URL"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
                        />
                      </div>
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
                disabled={isSubmitting || !brandName.trim() || !brandUrl.trim()}
                className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Saving…" : "Save and run first scan"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
