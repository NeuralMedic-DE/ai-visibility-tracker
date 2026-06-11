import { ImageResponse } from "next/og";

/**
 * Dynamically generated Open Graph card for the homepage (and as a fallback
 * for any page that doesn't define its own). Rendered at request time by
 * Next.js, cached by Vercel — never re-generated unless the route handler
 * code changes.
 *
 * Specs follow Facebook + LinkedIn + Twitter best practice:
 *   - 1200 × 630 px (1.91:1 aspect)
 *   - readable at the LinkedIn "small" thumbnail size (260 × 136)
 *   - text-only (no Tailwind, no external fonts — `ImageResponse` only
 *     supports a strict subset of CSS)
 */

export const runtime = "edge";
export const alt =
  "NeuralReach: track how ChatGPT, Claude, Perplexity, and Google AI Overviews talk about your B2B SaaS brand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0ea5e9 0%, #0369a1 60%, #075985 100%)",
          color: "white",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Brand mark + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            NeuralReach
          </div>
        </div>

        {/* Headline + sub */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            Does AI Search know your brand?
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.85)",
              maxWidth: 980,
            }}
          >
            Track how ChatGPT, Claude, Perplexity, and Google AI Overviews
            describe your B2B SaaS brand — weekly.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <div>100 brands · 4 LLMs · 7,500 real API prompts</div>
          <div>neuralreach.de</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
