"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── /dashboard/run-now ────────────────────────────────────────────────────────
// Intermediate page that automatically triggers /api/run-now then redirects
// to /dashboard?running=1. Shown after the onboarding form is saved.

export default function RunNowPage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "triggering" | "started" | "rate_limited" | "error"
  >("triggering");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function triggerRun() {
      try {
        const res = await fetch("/api/run-now", { method: "POST" });
        if (cancelled) return;

        if (res.status === 202) {
          setStatus("started");
          // Brief pause so the user sees the "started" message, then redirect
          setTimeout(() => {
            if (!cancelled) router.replace("/dashboard?running=1");
          }, 1200);
        } else if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          setStatus("rate_limited");
          setRetryAfter(data.retry_after ?? null);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMsg(data.error ?? `Unexpected status ${res.status}`);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "Network error");
        }
      }
    }

    triggerRun();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md text-center">
          {status === "triggering" && (
            <>
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 mb-6">
                <span className="text-3xl animate-spin inline-block">⚙️</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Starting your first scan…
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Queuing your AI visibility scan across ChatGPT, Claude,
                Perplexity, and Google AI Overviews.
              </p>
            </>
          )}

          {status === "started" && (
            <>
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Scan started!
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Redirecting you to your dashboard…
              </p>
            </>
          )}

          {status === "rate_limited" && (
            <>
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
                <span className="text-3xl" aria-hidden="true">
                  ⏳
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Scan already running
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">
                You can run one scan every 12 hours. Your brand was saved
                successfully — check back for your results.
              </p>
              {retryAfter && (
                <p className="text-xs text-gray-400 mb-6">
                  Next scan available after{" "}
                  {new Date(retryAfter).toLocaleString()}
                </p>
              )}
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Go to dashboard →
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
                <span className="text-3xl" aria-hidden="true">
                  ⚠️
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Something went wrong
              </h1>
              {errorMsg && (
                <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
              )}
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Your brand was saved. You can trigger a scan from your
                dashboard.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Go to dashboard →
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
