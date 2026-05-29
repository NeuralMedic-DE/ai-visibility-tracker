"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { WaitlistForm } from "./WaitlistForm";
import { CheckoutButton } from "./CheckoutButton";
import type { BrandScore, BrandGap } from "./LeaderboardTable";

interface BrandDetailPanelProps {
  brand: BrandScore | null;
  onClose: () => void;
}

function scoreColorClass(score: number) {
  if (score >= 80) return "text-green-700 bg-green-100";
  if (score >= 60) return "text-blue-700 bg-blue-100";
  if (score >= 40) return "text-yellow-700 bg-yellow-100";
  return "text-red-700 bg-red-100";
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80
      ? "bg-green-500"
      : score >= 60
      ? "bg-blue-500"
      : score >= 40
      ? "bg-yellow-400"
      : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={cn("font-bold tabular-nums px-1.5 py-0.5 rounded text-xs", scoreColorClass(score))}>
          {score.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className={cn("h-1.5 rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

const GAP_ICONS: Record<BrandGap["type"], string> = {
  schema: "🏗️",
  content: "📝",
  positioning: "🎯",
};

const GAP_LABELS: Record<BrandGap["type"], string> = {
  schema: "Schema",
  content: "Content",
  positioning: "Positioning",
};

const TIER_LABELS: Record<string, string> = {
  anchor: "Anchor Brand",
  tier2: "Established Brand",
  tier1: "Growing Brand",
  niche: "Niche Brand",
};

export function BrandDetailPanel({ brand, onClose }: BrandDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!brand) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [brand, onClose]);

  // Move focus into panel when it opens
  useEffect(() => {
    if (brand && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, input, a[href], [tabindex]:not([tabindex="-1"])'
      );
      focusable[0]?.focus();
    }
  }, [brand]);

  if (!brand) return null;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-panel-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className="relative bg-white w-full sm:w-[440px] h-full sm:max-h-screen overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="brand-panel-title"
                className="text-lg font-bold text-gray-900 leading-tight"
              >
                {brand.name}
              </h2>
              {brand.badge && (
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200 shrink-0">
                  {brand.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {brand.website} · Rank #{brand.rank} · {TIER_LABELS[brand.tier]}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-5 space-y-6">
          {/* Category */}
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-700 block mb-0.5 text-xs uppercase tracking-wide">
              What they do
            </span>
            {brand.category_long || brand.category}
          </div>

          {/* Overall score */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">
                AI Visibility Score
              </h3>
              <span
                className={cn(
                  "text-2xl font-extrabold tabular-nums px-2 py-0.5 rounded-lg",
                  scoreColorClass(brand.overall_score)
                )}
              >
                {brand.overall_score.toFixed(1)}
                <span className="text-xs font-normal opacity-60">/100</span>
              </span>
            </div>

            {/* Per-LLM bars */}
            <div className="space-y-3">
              <ScoreBar label="ChatGPT (GPT-4o)" score={brand.scores.chatgpt} />
              <ScoreBar label="Claude (Sonnet 3.5)" score={brand.scores.claude} />
              <ScoreBar label="Perplexity" score={brand.scores.perplexity} />
              <ScoreBar label="Google AI Overviews" score={brand.scores.google_aio} />
            </div>
          </div>

          {/* Gap analysis */}
          {brand.gaps && brand.gaps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Top Fixes to Improve Visibility
              </h3>
              <ol className="space-y-3">
                {brand.gaps.map((gap, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0" aria-hidden="true">
                        {GAP_ICONS[gap.type]}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            {GAP_LABELS[gap.type]} Fix #{gap.priority}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 leading-snug">
                          {gap.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          {gap.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Upsell CTA */}
          <div className="rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 p-5">
            <div className="flex items-start gap-2 mb-1">
              <span className="text-base" aria-hidden="true">🚀</span>
              <h3 className="text-sm font-bold text-brand-900">
                Track {brand.name} live and fix the gaps
              </h3>
            </div>
            <p className="text-xs text-brand-700 mb-4 leading-relaxed">
              Start a NeuralReach Pro trial to run real AI prompts for{" "}
              <strong>{brand.name}</strong>, compare up to 3 competitors, and
              get actionable schema &amp; content fixes, weekly.
            </p>

            {/* Primary: start Pro trial */}
            <CheckoutButton
              plan="pro"
              label="Start Pro trial for $89/mo"
              className="bg-brand-600 text-white hover:bg-brand-700 mb-2"
            />

            {/* Secondary: Starter */}
            <CheckoutButton
              plan="starter"
              label="Or try Starter for $39/mo"
              className="bg-transparent text-brand-700 hover:text-brand-900 underline text-xs py-1 px-0"
            />

            <p className="mt-3 text-[11px] text-brand-500">
              14-day free trial · No charge until day 15 ·{" "}
              <Link href="/pricing" className="underline hover:text-brand-700">
                See all features
              </Link>
            </p>
          </div>

          {/* Waitlist fallback for early access */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              Not ready yet? Join the waitlist
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              We&apos;ll notify you when we add new features or run a free scan for{" "}
              {brand.name}.
            </p>
            <WaitlistForm
              variant="compact"
              defaultBrandInterest={brand.name}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
