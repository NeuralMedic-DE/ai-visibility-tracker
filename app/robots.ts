import { MetadataRoute } from "next";

const BASE_URL = "https://www.neuralreach.de";

/**
 * /robots.txt.
 *
 * - Wildcard rule blocks the user-gated and API surfaces nothing crawlable
 *   lives behind. Everything else is open.
 * - LLM crawlers (GPTBot, ClaudeBot, anthropic-ai, Google-Extended,
 *   PerplexityBot, CCBot) are explicitly ALLOWED. Default-allow already
 *   covers them, but documenting intent matters here because our
 *   product's value-prop literally depends on being in the training and
 *   retrieval corpora of these models.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/dashboard/",
          "/onboarding",
          "/onboarding/",
          "/login",
          "/signup",
          "/reset-password",
          "/_next/",
        ],
      },
      { userAgent: "GPTBot",          allow: "/" },
      { userAgent: "ClaudeBot",       allow: "/" },
      { userAgent: "anthropic-ai",    allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "PerplexityBot",   allow: "/" },
      { userAgent: "CCBot",           allow: "/" },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
