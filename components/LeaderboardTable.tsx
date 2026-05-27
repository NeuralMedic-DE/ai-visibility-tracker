import { cn } from "@/lib/cn";

interface BrandScore {
  rank: number;
  id: string;
  name: string;
  category: string;
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
}

interface LeaderboardTableProps {
  brands: BrandScore[];
  className?: string;
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <span className="text-green-600 font-bold">↑</span>;
  if (trend === "down") return <span className="text-red-500 font-bold">↓</span>;
  return <span className="text-gray-400">—</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-100 text-green-800"
      : score >= 60
      ? "bg-blue-100 text-blue-800"
      : score >= 40
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", color)}>
      {score}
    </span>
  );
}

export function LeaderboardTable({ brands, className }: LeaderboardTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-gray-200 shadow-sm", className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              #
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Brand
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">
              Category
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
              AI Score
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">
              ChatGPT
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">
              Claude
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">
              Perplexity
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">
              Google AIO
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
              Trend
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {brands.map((brand) => (
            <tr key={brand.id} className="hover:bg-gray-50 transition-colors">
              <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-500">
                {brand.rank}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {brand.name}
                    </div>
                    <div className="text-xs text-gray-400">{brand.website}</div>
                  </div>
                  {brand.badge && (
                    <span className="hidden sm:inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                      {brand.badge}
                    </span>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 hidden sm:table-cell">
                {brand.category}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center">
                <div className="flex items-center justify-center">
                  <div
                    className={cn(
                      "text-sm font-bold",
                      brand.overall_score >= 80
                        ? "text-green-700"
                        : brand.overall_score >= 60
                        ? "text-blue-700"
                        : brand.overall_score >= 40
                        ? "text-yellow-700"
                        : "text-red-700"
                    )}
                  >
                    {brand.overall_score}
                    <span className="text-xs font-normal text-gray-400">/100</span>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center hidden md:table-cell">
                <ScoreBadge score={brand.scores.chatgpt} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center hidden md:table-cell">
                <ScoreBadge score={brand.scores.claude} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center hidden md:table-cell">
                <ScoreBadge score={brand.scores.perplexity} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center hidden lg:table-cell">
                <ScoreBadge score={brand.scores.google_aio} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-center text-sm">
                <TrendIcon trend={brand.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
