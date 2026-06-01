"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── /dashboard/run-now ────────────────────────────────────────────────────────
// Intermediate page that automatically calls POST /api/run-now then redirects
// to /dashboard once complete.
//
// The scorer now runs *synchronously* inside the API route (no external worker
// needed), so this page must keep the user informed during the 1-3 minute wait.
// It handles two API shapes:
//   200 – scoring completed inline (TypeScript scorer ran to completion)
//   202 – job was queued for the background worker (async path)
//   429 – rate-limited (a run already happened in the last 12 h)
//   4xx/5xx – error

type Status = "running" | "started" | "rate_limited" | "error";

const STEPS = [
  { label: "Generating 25 buyer-intent prompts" },
  { label: "Querying ChatGPT, Claude, Perplexity & Google AI" },
  { label: "Scoring brand mentions & gaps" },
  { label: "Building your visibility report" },
];

function SpinnerIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-brand-600 animate-spin`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-green-600"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={3}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

/** Animated step tracker shown while the scan runs */
function ScanSteps({ elapsedMs }: { elapsedMs: number }) {
  // Approximate which steps are "done" based on elapsed time.
  // This is cosmetic — real progress comes from the API response.
  const stepsDone = elapsedMs > 10_000 ? 1 : 0;

  return (
    <div className="w-full max-w-sm rounded-xl bg-gray-50 border border-gray-100 p-4 text-left space-y-3">
      {STEPS.map((step, idx) => {
        const done = idx < stepsDone;
        const active = idx === stepsDone;
        return (
          <div key={step.label} className="flex items-center gap-3">
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                done
                  ? "bg-green-100"
                  : active
                  ? "bg-brand-100 animate-pulse"
                  : "bg-gray-200"
              }`}
            >
              {done ? (
                <CheckIcon />
              ) : active ? (
                <div className="h-2 w-2 rounded-full bg-brand-600" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-gray-400" />
              )}
            </div>
            <span
              className={`text-sm transition-colors ${
                done
                  ? "text-gray-400 line-through"
                  : active
                  ? "text-gray-800 font-medium"
                  : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function RunNowPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("running");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startTs] = useState(() => Date.now());

  // Tick elapsed time so ScanSteps can animate step progression
  useEffect(() => {
    const t = setInterval(() => setElapsedMs(Date.now() - startTs), 2_000);
    return () => clearInterval(t);
  }, [startTs]);

  useEffect(() => {
    let cancelled = false;

    async function triggerRun() {
      try {
        const res = await fetch("/api/run-now", { method: "POST" });
        if (cancelled) return;

        if (res.status === 200 || res.status === 202) {
          // 200 → scorer ran synchronously and results are written to DB
          // 202 → job queued for background worker (async path)
          // Either way, redirect to dashboard — results are there or will appear shortly.
          setStatus("started");
          router.replace("/dashboard");
        } else if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          setStatus("rate_limited");
          setRetryAfter(data.retry_after ?? null);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMsg(data.error ?? `Unexpected response (status ${res.status})`);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Network error — check your connection."
          );
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
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md text-center">

          {/* ── Running (synchronous scorer in progress) ── */}
          {status === "running" && (
            <>
              {/* Animated radar / pulse icon */}
              <div className="relative inline-flex h-20 w-20 items-center justify-center mb-6">
                <span className="absolute inset-0 rounded-full bg-brand-100 animate-ping opacity-40" />
                <span
                  className="absolute inset-2 rounded-full bg-brand-100 animate-ping opacity-25"
                  style={{ animationDelay: "0.3s" }}
                />
                <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 border border-brand-100">
                  <SpinnerIcon className="h-9 w-9" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Running your AI visibility scan
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-1">
                Querying{" "}
                <strong className="text-gray-700">
                  ChatGPT, Claude, Perplexity &amp; Google AI
                </strong>{" "}
                with 25 buyer-intent prompts.
              </p>
              <p className="text-xs text-gray-400 mb-8">
                Typically takes <strong className="text-gray-600">1–3 minutes</strong>.
                Please don&apos;t close this tab.
              </p>

              <div className="flex justify-center mb-8">
                <ScanSteps elapsedMs={elapsedMs} />
              </div>

              <p className="text-xs text-gray-400">
                We&apos;ll also email you when your report is ready.
              </p>
            </>
          )}

          {/* ── Redirecting (scan done / job queued) ── */}
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
                Scan complete!
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Redirecting you to your dashboard…
              </p>
            </>
          )}

          {/* ── Rate limited ── */}
          {status === "rate_limited" && (
            <>
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
                <span className="text-3xl" aria-hidden="true">
                  ⏳
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Scan already run recently
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">
                You can run one on-demand scan every 12 hours. Your brand was
                saved successfully — check your dashboard for your latest
                results.
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
                Go to dashboard
              </Link>
            </>
          )}

          {/* ── Error ── */}
          {status === "error" && (
            <>
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
                <span className="text-3xl" aria-hidden="true">
                  ⚠️
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Scan couldn&apos;t start
              </h1>
              {errorMsg && (
                <p className="text-sm text-red-600 mb-4 max-w-xs mx-auto">
                  {errorMsg}
                </p>
              )}
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Your brand was saved. You can trigger the scan from your
                dashboard whenever you&apos;re ready.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  Go to dashboard
                </Link>
                <Link
                  href="mailto:hello@neuralreach.de"
                  className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Email support
                </Link>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
