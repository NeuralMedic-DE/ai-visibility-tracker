"use client";

import { cn } from "@/lib/cn";

export interface BrandGap {
  type: "schema" | "content" | "positioning";
  title: string;
  description: string;
  priority: number;
}

export interface BrandScore {
  rank: number;
  id: string;
  name: string;
  category: string;
  category_long: string;
  website: string;
  overall_score: number;
  scores: {
    chatgpt: number;
    claude: number;
    perplexity: number;
    google_aio: number;
  };
  trend: "up" | "down" | "stable";
  badge: string | null;
  tier: "anchor" | "tier2" | "tier1" | "niche";
  gaps: BrandGap[];
  /** "verified_YYYY-MM-DD" = live API score | "estimated" = research-based estimate */
  data_source?: string;
}

export type SortColumn =
  | "rank"
  | "name"
  | "overall_score"
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "google_aio";

export type SortDir = "asc" | "desc";

interface LeaderboardTableProps {
  brands: BrandScore[];
  sortColumn: SortColumn;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
  onGetReport: (brandName: string) => void;
  onBrandClick: (brand: BrandScore) => void;
  className?: string;
}

// ── small helpers ──────────────────────────────────────────────

function scoreColorClass(score: number) {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-blue-700";
  if (score >= 40) return "text-yellow-700";
  return "text-red-700";
}

function scoreBgClass(score: number) {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-blue-100 text-blue-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium tabular-nums",
        scoreBgClass(score)
      )}
    >
      {score}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")
    return (
      <span
        className="inline-flex items-center gap-0.5 text-green-600 font-semibold text-xs"
        title="Trending up"
        aria-label="Trending up"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3 w-3"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8 14a.75.75 0 0 1-.75-.75V4.56L4.03 7.78a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69A.75.75 0 0 1 8 14Z"
            clipRule="evenodd"
          />
        </svg>
        Up
      </span>
    );
  if (trend === "down")
    return (
      <span
        className="inline-flex items-center gap-0.5 text-red-500 font-semibold text-xs"
        title="Trending down"
        aria-label="Trending down"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3 w-3"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06L7.25 11.44V2.75A.75.75 0 0 1 8 2Z"
            clipRule="evenodd"
          />
        </svg>
        Down
      </span>
    );
  return (
    <span
      className="text-gray-400 text-xs"
      title="Stable"
      aria-label="Stable"
    >
      —
    </span>
  );
}

// ── DataSourcePill ─────────────────────────────────────────────
// Green "Verified" pill for live-scored rows; grey "Estimated" for offline estimates.
function DataSourcePill({ dataSource }: { dataSource?: string }) {
  if (!dataSource) return null;

  const isVerified = dataSource.startsWith("verified_");
  const runDate = isVerified ? dataSource.replace("verified_", "") : null;

  const tooltip = isVerified
    ? `Live API score — scored ${runDate} via real queries to OpenAI, Anthropic & Perplexity`
    : "Research-based estimate — pending live API scoring in a future run";

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none cursor-default select-none",
        isVerified
          ? "bg-green-100 text-green-700 ring-1 ring-inset ring-green-300"
          : "bg-gray-100 text-gray-400 ring-1 ring-inset ring-gray-200"
      )}
    >
      {isVerified ? (
        <>
          {/* checkmark micro-icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 12 12"
            fill="currentColor"
            className="h-2 w-2"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10.53 2.47a.75.75 0 0 1 0 1.06L5.06 9l-3.59-3.59a.75.75 0 0 1 1.06-1.06L5.06 6.88l4.41-4.41a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
          Verified
        </>
      ) : (
        "Estimated"
      )}
    </span>
  );
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active)
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="h-3 w-3 opacity-30"
        aria-hidden="true"
      >
        <path d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
      </svg>
    );
  return dir === "desc" ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3 w-3 text-brand-600"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06L7.25 11.44V2.75A.75.75 0 0 1 8 2Z"
        clipRule="evenodd"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3 w-3 text-brand-600"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8 14a.75.75 0 0 1-.75-.75V4.56L4.03 7.78a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69A.75.75 0 0 1 8 14Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── main component ─────────────────────────────────────────────

export function LeaderboardTable({
  brands,
  sortColumn,
  sortDir,
  onSort,
  onGetReport,
  onBrandClick,
  className,
}: LeaderboardTableProps) {
  function SortableTh({
    col,
    label,
    className: thClass,
  }: {
    col: SortColumn;
    label: string;
    className?: string;
  }) {
    const active = sortColumn === col;
    return (
      <th
        scope="col"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 select-none",
          thClass
        )}
      >
        <button
          onClick={() => onSort(col)}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors",
            active && "text-brand-700"
          )}
        >
          {label}
          <SortIcon active={active} dir={sortDir} />
        </button>
      </th>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-gray-200 shadow-sm",
        className
      )}
      role="region"
      aria-label="AI Visibility leaderboard"
    >
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <caption className="sr-only">
          AI Visibility Index — Top 100 B2B SaaS brands ranked by AI search
          presence across ChatGPT, Claude, Perplexity, and Google AI Overviews.
        </caption>
        <thead className="bg-gray-50">
          <tr>
            <SortableTh col="rank" label="#" className="pl-4 pr-3 text-left" />
            <SortableTh col="name" label="Brand" className="px-3 text-left" />
            <th
              scope="col"
              className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell"
            >
              Category
            </th>
            <SortableTh
              col="overall_score"
              label="AI Score"
              className="px-3 text-center"
            />
            <SortableTh
              col="chatgpt"
              label="ChatGPT"
              className="px-3 text-center hidden md:table-cell"
            />
            <SortableTh
              col="claude"
              label="Claude"
              className="px-3 text-center hidden md:table-cell"
            />
            <SortableTh
              col="perplexity"
              label="Perplexity"
              className="px-3 text-center hidden md:table-cell"
            />
            <SortableTh
              col="google_aio"
              label="Google AIO"
              className="px-3 text-center hidden lg:table-cell"
            />
            <th
              scope="col"
              className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell"
            >
              Trend
            </th>
            <th
              scope="col"
              className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {brands.map((brand) => (
            <tr
              key={brand.id}
              className="group hover:bg-brand-50/40 transition-colors"
            >
              {/* Rank */}
              <td className="whitespace-nowrap py-3 pl-4 pr-3 font-medium text-gray-400 tabular-nums">
                {brand.rank}
              </td>

              {/* Brand */}
              <td className="whitespace-nowrap px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <button
                      onClick={() => onBrandClick(brand)}
                      className="font-semibold text-gray-900 truncate max-w-[140px] sm:max-w-none hover:text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-400 rounded text-left"
                      title={`View ${brand.name} AI visibility details`}
                    >
                      {brand.name}
                    </button>
                    <div className="text-xs text-gray-400 truncate max-w-[140px] sm:max-w-none">
                      {brand.website}
                    </div>
                  </div>
                  <div className="hidden sm:flex shrink-0 items-center gap-1">
                    {brand.badge && (
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                        {brand.badge}
                      </span>
                    )}
                    <DataSourcePill dataSource={brand.data_source} />
                  </div>
                </div>
              </td>

              {/* Category */}
              <td className="whitespace-nowrap px-3 py-3 text-gray-500 hidden sm:table-cell">
                {brand.category}
              </td>

              {/* Overall score */}
              <td className="whitespace-nowrap px-3 py-3 text-center">
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    scoreColorClass(brand.overall_score)
                  )}
                >
                  {brand.overall_score}
                  <span className="text-[10px] font-normal text-gray-400">
                    /100
                  </span>
                </span>
              </td>

              {/* Per-LLM scores */}
              <td className="whitespace-nowrap px-3 py-3 text-center hidden md:table-cell">
                <ScorePill score={brand.scores.chatgpt} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center hidden md:table-cell">
                <ScorePill score={brand.scores.claude} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center hidden md:table-cell">
                <ScorePill score={brand.scores.perplexity} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center hidden lg:table-cell">
                <ScorePill score={brand.scores.google_aio} />
              </td>

              {/* Trend */}
              <td className="whitespace-nowrap px-3 py-3 text-center hidden sm:table-cell">
                <TrendIcon trend={brand.trend} />
              </td>

              {/* CTA */}
              <td className="whitespace-nowrap px-3 py-3 text-right">
                <button
                  onClick={() => onGetReport(brand.name)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded px-2 py-1 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  aria-label={`Get AI visibility report for ${brand.name}`}
                >
                  Track →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
