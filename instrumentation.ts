/**
 * Next.js instrumentation hook — executed once when the server process starts.
 *
 * Initializes Sentry for server-side error capture when SENTRY_DSN is set.
 * Safe no-op when SENTRY_DSN is absent or @sentry/nextjs is not installed.
 *
 * Enabled via experimental.instrumentationHook = true in next.config.mjs.
 * Stable in Next.js 15; experimental (but safe) in 14.2+.
 *
 * To activate Sentry:
 *   1. Create a Sentry project at https://sentry.io
 *   2. Copy the DSN and add it as SENTRY_DSN to Vercel environment variables
 *   3. Run: npm install @sentry/nextjs
 */

export async function register() {
  // Only initialize in Node.js runtime — not Edge runtime.
  if (
    typeof process === "undefined" ||
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !process.env.SENTRY_DSN
  ) {
    return;
  }

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "production",
      // Low trace sample rate — keeps us within Sentry free tier (10 k/mo).
      tracesSampleRate: 0.05,
      // Surface unhandled rejections and uncaught exceptions.
      autoSessionTracking: true,
    });
    console.info("[sentry] Initialized for Node.js runtime");
  } catch {
    // Package not installed — already handled gracefully by error-reporter.ts.
    console.warn("[sentry] @sentry/nextjs not available — skipping init");
  }
}
