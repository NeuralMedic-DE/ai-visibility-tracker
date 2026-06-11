import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

/**
 * Per-brand OG card for `/leaderboard/<slug>`. Renders the brand name,
 * AI visibility score, rank, and category in a shareable 1200x630 image.
 *
 * Rendered at request time, cached at the Vercel edge. Keeps the brand
 * detail page's social cards interesting (instead of all 100 sharing the
 * homepage's generic card).
 *
 * Falls back to a generic card if the brand JSON is missing — never errors
 * out (would degrade /leaderboard/<slug> share previews entirely).
 */

export const runtime = "nodejs"; // need fs for the brand JSON read
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface BrandDetail {
  brand: string;
  rank: number;
  avs_brand: number;
  category_long?: string;
  category?: string;
  total_brands: number;
}

function safeReadBrand(slug: string): BrandDetail | null {
  try {
    const filePath = path.join(process.cwd(), "data", "brands", `${slug}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as BrandDetail;
  } catch {
    return null;
  }
}

export const alt = "NeuralReach AI Visibility Score";

export default function BrandOG({ params }: { params: { slug: string } }) {
  const brand = safeReadBrand(params.slug);

  // Score colour follows the same buckets the live UI uses (≥80 green,
  // ≥60 blue, ≥40 amber, else rose).
  const score = brand?.avs_brand ?? 0;
  const accent =
    score >= 80
      ? "#22c55e"
      : score >= 60
      ? "#38bdf8"
      : score >= 40
      ? "#f59e0b"
      : "#fb7185";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0ea5e9 0%, #0369a1 60%, #075985 100%)",
          color: "white",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>
            NeuralReach
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 22,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            AI Visibility Index
          </div>
        </div>

        {brand ? (
          <>
            <div
              style={{
                marginTop: 60,
                fontSize: 24,
                fontWeight: 500,
                color: "rgba(255,255,255,0.65)",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {brand.category_long || brand.category || "B2B SaaS"}
            </div>
            <div
              style={{
                fontSize: 96,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -2,
                marginTop: 8,
              }}
            >
              {brand.brand}
            </div>

            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  AI Visibility Score
                </div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 12 }}
                >
                  <span
                    style={{
                      fontSize: 130,
                      fontWeight: 800,
                      letterSpacing: -3,
                      color: accent,
                      lineHeight: 1,
                    }}
                  >
                    {brand.avs_brand.toFixed(1)}
                  </span>
                  <span
                    style={{
                      fontSize: 36,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    / 100
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  Rank #{brand.rank}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  of {brand.total_brands} B2B SaaS brands
                </div>
              </div>
            </div>
          </>
        ) : (
          // Fallback when slug doesn't resolve — generic NeuralReach card
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginTop: 80,
            }}
          >
            <div style={{ fontSize: 64, fontWeight: 800 }}>
              AI Visibility Index
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              100 B2B SaaS brands ranked across ChatGPT, Claude, Perplexity
              and Google AI Overviews.
            </div>
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
