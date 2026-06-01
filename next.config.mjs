/** @type {import('next').NextConfig} */

// ── Security headers ─────────────────────────────────────────────────────────
// Applied to every response via Next.js built-in headers().
// CSP uses 'unsafe-inline' for scripts because Next.js App Router inlines
// small chunks by default.  Upgrade path: enable nonce-based CSP once
// next.config supports generateBuildId nonce injection (Next.js 15+).
//
// Stripe requires js.stripe.com in script-src + frame-src.
// Supabase needs wss:// in connect-src for realtime.
// ────────────────────────────────────────────────────────────────────────────
const CSP = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline'; Stripe JS must be loaded from their CDN
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  // Tailwind / global CSS inline styles
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // data: URIs used by Next.js image optimiser
  "img-src 'self' data: https:",
  // Supabase REST + Realtime WS, Stripe API, Vercel analytics
  [
    "connect-src",
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.stripe.com",
    "https://vitals.vercel-insights.com",
    "https://va.vercel-scripts.com",
  ].join(" "),
  // Stripe hosted pages (Checkout / 3DS iframe)
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
]
  .map((d) => d.trim())
  .join("; ");

/** @type {import('next').NextConfig['headers']} */
const securityHeaders = async () => [
  {
    source: "/(.*)",
    headers: [
      {
        key: "Content-Security-Policy",
        value: CSP,
      },
      {
        // max-age 2 years; includeSubDomains for all of neuralreach.de
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "X-Frame-Options",
        value: "SAMEORIGIN",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ],
  },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enables instrumentation.ts — called once on server startup.
    // Used to initialize Sentry when SENTRY_DSN is configured.
    // Experimental in Next.js 14.2 but safe to enable; no-op when
    // instrumentation.ts is absent.
    instrumentationHook: true,
  },
  headers: securityHeaders,
};

export default nextConfig;
