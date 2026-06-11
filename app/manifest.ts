import type { MetadataRoute } from "next";

/**
 * Web App Manifest — drives the PWA install prompt, theme colour on
 * mobile browsers, the home-screen icon name, and search-engine app
 * recognition. Next.js serves this at `/manifest.webmanifest`.
 *
 * Icons reference `app/icon.svg` (which Next.js exposes at /icon.svg).
 * The brand-blue (#0284c7) matches the favicon gradient end + the
 * `bg-brand-600` Tailwind class used across the marketing site.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NeuralReach — AI Search Visibility for B2B SaaS",
    short_name: "NeuralReach",
    description:
      "Track how your brand appears in ChatGPT, Claude, Perplexity, and Google AI Overviews. Weekly GEO/AEO reports + actionable schema and content fixes for B2B SaaS founders.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0284c7",
    orientation: "portrait-primary",
    lang: "en",
    categories: ["business", "productivity", "marketing"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
