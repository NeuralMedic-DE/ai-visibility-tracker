/**
 * Centralized error reporter for NeuralReach API routes.
 *
 * • Always emits structured JSON to stdout → Vercel log drains / Datadog ingest this.
 * • When SENTRY_DSN is set and @sentry/nextjs is installed, also sends to Sentry.
 * • Safe no-op when Sentry is not configured or the package is not yet installed.
 *
 * Usage:
 *   import { reportError, reportMessage } from "@/lib/error-reporter";
 *
 *   try { ... } catch (err) {
 *     reportError(err, { route: "onboarding", customerId });
 *     return NextResponse.json({ error: "Internal error" }, { status: 500 });
 *   }
 */

type Extra = Record<string, unknown>;

// Minimal type surface we use from Sentry.
type SentryModule = {
  captureException(error: unknown): void;
  captureMessage(message: string, hint?: object): void;
  withScope(
    cb: (scope: { setExtras(e: Record<string, unknown>): void }) => void
  ): void;
};

// "unloaded" = not yet attempted; null = unavailable; SentryModule = loaded.
let _sentry: SentryModule | null | "unloaded" = "unloaded";

/**
 * Lazy-load @sentry/nextjs. Returns null if:
 *   - SENTRY_DSN env var is not set
 *   - The package is not installed (pre npm install)
 */
function getSentry(): SentryModule | null {
  if (_sentry !== "unloaded") return _sentry;

  if (!process.env.SENTRY_DSN) {
    _sentry = null;
    return null;
  }

  try {
    // Dynamic require: graceful fallback if @sentry/nextjs isn't installed yet.
    // TypeScript compiles this to CJS require in Next.js server bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _sentry = require("@sentry/nextjs") as SentryModule;
  } catch {
    console.warn(
      "[error-reporter] @sentry/nextjs not found. Run: npm install @sentry/nextjs"
    );
    _sentry = null;
  }

  return _sentry;
}

/**
 * Report an unexpected error.
 *
 * Always logs structured JSON to stdout (Vercel Functions log drain friendly).
 * Also sends to Sentry when SENTRY_DSN is configured.
 */
export function reportError(error: unknown, extra?: Extra): void {
  const message =
    error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Structured JSON — Vercel captures this in Functions logs.
  console.error(
    JSON.stringify({
      level: "error",
      message,
      stack,
      ts: new Date().toISOString(),
      ...extra,
    })
  );

  const sentry = getSentry();
  if (sentry) {
    try {
      sentry.withScope((scope) => {
        if (extra) scope.setExtras(extra);
        sentry.captureException(error);
      });
    } catch {
      // Never let Sentry errors propagate into request handlers.
    }
  }
}

/**
 * Report a non-exception message (unexpected state, important warning, etc.).
 */
export function reportMessage(
  message: string,
  level: "info" | "warning" | "error" = "error",
  extra?: Extra
): void {
  const logFn =
    level === "warning"
      ? console.warn
      : level === "info"
      ? console.info
      : console.error;

  logFn(
    JSON.stringify({
      level,
      message,
      ts: new Date().toISOString(),
      ...extra,
    })
  );

  const sentry = getSentry();
  if (sentry) {
    try {
      sentry.withScope((scope) => {
        if (extra) scope.setExtras(extra);
        sentry.captureMessage(message, {
          level: level === "warning" ? "warning" : level,
        } as object);
      });
    } catch {
      // Never let Sentry errors propagate.
    }
  }
}
