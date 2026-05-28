"use client";

import { useMemo, useState } from "react";
import { LeaderboardTable, type BrandScore, type SortColumn, type SortDir } from "./LeaderboardTable";
import { CTAModal } from "./CTAModal";
import { WaitlistForm } from "./WaitlistForm";
import { BrandDetailPanel } from "./BrandDetailPanel";

interface LeaderboardSectionProps {
  brands: BrandScore[];
  note: string;
  generatedAt: string;
}

function getValue(brand: BrandScore, col: SortColumn): number | string {
  switch (col) {
    case "rank":           return brand.rank;
    case "name":           return brand.name.toLowerCase();
    case "overall_score":  return brand.overall_score;
    case "chatgpt":        return brand.scores.chatgpt;
    case "claude":         return brand.scores.claude;
    case "perplexity":     return brand.scores.perplexity;
    case "google_aio":     return brand.scores.google_aio;
    default:               return brand.rank;
  }
}

export function LeaderboardSection({ brands, note, generatedAt }: LeaderboardSectionProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("rank");
  const [sortDir, setSortDir]       = useState<SortDir>("asc");
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalBrand, setModalBrand] = useState("");
  const [detailBrand, setDetailBrand] = useState<BrandScore | null>(null);
  const [search, setSearch]         = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Derive unique categories from brand list
  const categories = useMemo(() => {
    const cats = Array.from(new Set(brands.map((b) => b.category))).sort();
    return cats;
  }, [brands]);

  const filteredBrands = useMemo(() => {
    let result = brands;

    // Search filter (name or website)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.website.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((b) => b.category === categoryFilter);
    }

    return result;
  }, [brands, search, categoryFilter]);

  const sortedBrands = useMemo(() => {
    return [...filteredBrands].sort((a, b) => {
      const av = getValue(a, sortColumn);
      const bv = getValue(b, sortColumn);
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredBrands, sortColumn, sortDir]);

  function handleSort(col: SortColumn) {
    if (col === sortColumn) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      // Scores sort descending by default (highest first); rank/name sort ascending
      setSortDir(col === "rank" || col === "name" ? "asc" : "desc");
    }
  }

  function openModal(brandName = "") {
    setModalBrand(brandName);
    setModalOpen(true);
  }

  const dateLabel = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const hasFilters = search.trim() !== "" || categoryFilter !== "all";

  return (
    <>
      {/* ── Page header ─────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-brand-50 to-white py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 mb-4">
            Updated {dateLabel}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            AI Visibility Index
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            How well do the top B2B SaaS brands appear when founders ask AI for
            tool recommendations? Scored across ChatGPT, Claude, Perplexity, and
            Google AI Overviews.
          </p>

          {/* Score legend */}
          <div className="mt-6 flex items-center justify-center gap-3 sm:gap-5 text-xs sm:text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
              80+ = High visibility
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
              60–79 = Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" aria-hidden="true" />
              40–59 = Low
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
              &lt;40 = At risk
            </span>
          </div>

          {/* CTA */}
          <div className="mt-8">
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
            >
              Get my brand&apos;s report
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <p className="mt-2 text-xs text-gray-400">
              Free — we score 25 real AI prompts across 4 platforms
            </p>
          </div>
        </div>
      </section>

      {/* ── Search + Filter toolbar ──────────────────────────── */}
      <section className="bg-white border-b border-gray-100 py-4 sticky top-16 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search brands, categories…"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                aria-label="Search brands"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="category-filter" className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">
                Category
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white"
              >
                <option value="all">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Result count */}
            <div className="flex items-center text-xs text-gray-400 whitespace-nowrap">
              {sortedBrands.length} of {brands.length} brands
              {hasFilters && (
                <button
                  onClick={() => { setSearch(""); setCategoryFilter("all"); }}
                  className="ml-2 text-brand-500 hover:text-brand-700 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Table ───────────────────────────────────────────── */}
      <section className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {sortedBrands.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">No brands found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
              <button
                onClick={() => { setSearch(""); setCategoryFilter("all"); }}
                className="mt-4 text-brand-500 hover:text-brand-700 text-sm underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <LeaderboardTable
              brands={sortedBrands}
              sortColumn={sortColumn}
              sortDir={sortDir}
              onSort={handleSort}
              onGetReport={openModal}
              onBrandClick={setDetailBrand}
            />
          )}
          <p className="mt-4 text-xs text-gray-400 text-center">
            {note} · Click a brand name to view the full gap analysis. · Scores are averages across 25 prompts per LLM per brand.
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <section className="py-16 bg-gray-50" id="waitlist">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Not on the list? Track your brand.
          </h2>
          <p className="text-gray-600 mb-8">
            Get weekly AI visibility reports for your B2B SaaS — and see
            exactly how you compare to competitors.
          </p>
          <WaitlistForm variant="compact" className="max-w-sm mx-auto" />
        </div>
      </section>

      {/* ── Brand detail side panel ─────────────────────────── */}
      <BrandDetailPanel
        brand={detailBrand}
        onClose={() => setDetailBrand(null)}
      />

      {/* ── Get-report modal ────────────────────────────────── */}
      <CTAModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        prefilledBrand={modalBrand}
      />
    </>
  );
}
