"use client";

/**
 * ScanProgress — client component driving dashboard "State B":
 * brand is tracked but no scoring results exist yet.
 *
 * Job states handled:
 *   pending   → auto-triggers POST /api/run-now immediately on mount so the
 *               scan starts without user interaction; shows spinner + auto-refresh.
 *               run-now picks up the pending job rather than creating a new one.
 *   running   → spinner + auto-refresh (30 s) + client-side 15-min timeout.
 *   failed    → failure UI rendered immediately; user can click "Try again".
 *   no_job    → failure UI rendered immediately (no job was ever queued).
 *   done      → failure UI (job done but run hasn't propagated yet — retry).
 *   timed-out → spinner ran past timeoutMs (15 min) without result → failure UI.
 *
 * The failure UI always includes a "Try again" button that calls POST /api/run-now
 * and then router.refresh() to re-enter the page render cycle.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ScanProgressProps {
  brandName: string;
  /**
   * DB status of scoring_jobs row at page-render time.
   * "done" can occur when the worker marks the job done but the run hasn't
   * propagated to the dashboard query yet — treat it like "failed" (retry).
   */
  jobStatus: "pending" | "running" | "failed" | "done" | "no_job";
  /** ISO timestamp of scoring_jobs.created_at; null when no job exists */
  jobCreatedAt: string | null;
  /** Switch to failure UI after this many ms without a result. Default: 15 min */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1_000; // 15 minutes
const REFRESH_INTERVAL_MS = 30_000;          // 30 seconds

function msElapsed(isoString: string | null): number {
  if (!isoString) return 0;
  return Math.max(0, Date.now() - new Date(isoString).getTime());
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      className="h-8 w-8 text-blue-600 animate-spin"
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
      className="h-3 w-3 text-green-600"
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

// ── Retry button ──────────────────────────────────────────────────────────────

function RetryButton({
  onRetry,
  retrying,
  retryError,
}: {
  onRetry: () => void;
  retrying: boolean;
  retryError: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {retrying ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running scan…
          </>
        ) : (
          "Try again"
        )}
      </button>

      {retryError && (
        <p className="text-xs text-red-600 max-w-xs text-center">{retryError}</p>
      )}

      {!retryError && (
        <p className="text-xs text-gray-400">
          Takes 1–3 minutes to complete.
        </p>
      )}

      <p className="text-xs text-gray-400">
        Still stuck?{" "}
        <a
          href="mailto:hello@neuralreach.de"
          className="text-brand-600 hover:underline underline-offset-2"
        >
          Email support
        </a>
      </p>
    </div>
  );
}

// ── Failure / timeout state ───────────────────────────────────────────────────

function FailureState({
  brandName,
  jobStatus,
  onRetry,
  retrying,
  retryError,
}: {
  brandName: string;
  jobStatus: ScanProgressProps["jobStatus"];
  onRetry: () => void;
  retrying: boolean;
  retryError: string | null;
}) {
  const title =
    jobStatus === "no_job"
      ? "Scan wasn't started"
      : jobStatus === "failed"
      ? "Scan failed"
      : jobStatus === "done"
      ? "Results not yet available"
      : "Scan is taking too long";

  const description =
    jobStatus === "no_job"
      ? "We tried to start your scan automatically but encountered an error. This is usually temporary — try triggering it again below."
      : jobStatus === "failed"
      ? "The scoring engine encountered an error processing your brand. It usually succeeds on retry."
      : jobStatus === "done"
      ? "The scan finished but the results haven't appeared yet. This is usually a brief delay — try refreshing or trigger a new scan below."
      : "Your scan has been running for over 15 minutes without completing. This typically means there was an API error. Trigger a fresh scan to try again.";

  return (
    <div className="rounded-2xl bg-white ring-1 ring-red-200 overflow-hidden">
      <div className="h-1.5 bg-red-400" />
      <div className="p-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 border border-red-100 mb-5">
          <span className="text-3xl" aria-hidden="true">⚠️</span>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>

        <p className="text-sm text-gray-500 mb-2 leading-relaxed max-w-sm mx-auto">
          {description}
        </p>

        <p className="text-xs text-gray-400 mb-6">
          Brand:{" "}
          <strong className="text-gray-600">{brandName}</strong>
        </p>

        <RetryButton
          onRetry={onRetry}
          retrying={retrying}
          retryError={retryError}
        />
      </div>
    </div>
  );
}

// ── Generating (in-progress) state ────────────────────────────────────────────

function GeneratingState({
  brandName,
  countdown,
  minutesUntilTimeout,
}: {
  brandName: string;
  countdown: number;
  minutesUntilTimeout: number;
}) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-8">
      {/* Animated icon */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative inline-flex h-16 w-16 items-center justify-center mb-5">
          <span className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-40" />
          <span
            className="absolute inset-1 rounded-full bg-blue-100 animate-ping opacity-30"
            style={{ animationDelay: "0.15s" }}
          />
          <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <SpinnerIcon />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Your first report is generating
        </h2>
        <p className="text-sm text-gray-500 mb-1 leading-relaxed max-w-sm">
          Usually{" "}
          <strong className="text-gray-700">1–3 minutes</strong>.
          We&apos;re querying ChatGPT, Claude, Perplexity, and Google AI
          Overviews using 25 buyer-intent prompts for{" "}
          <strong className="text-gray-700">{brandName}</strong>.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          We&apos;ll email you when it&apos;s ready.
        </p>

        {/* Progress steps */}
        <div className="w-full max-w-sm rounded-xl bg-gray-50 border border-gray-100 p-4 text-left space-y-3 mb-6">
          {[
            { label: "Generating 25 prompts", done: true },
            { label: "Querying 4 AI platforms", done: true },
            { label: "Scoring mentions & gaps", done: false },
            { label: "Building your report", done: false },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                  done ? "bg-green-100" : "bg-blue-100 animate-pulse"
                }`}
              >
                {done ? (
                  <CheckIcon />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                )}
              </div>
              <span
                className={`text-sm ${
                  done ? "text-gray-500 line-through" : "text-gray-700"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Refresh countdown */}
        <p className="text-xs text-gray-400 tabular-nums mb-1">
          Checking for results — refreshing in {countdown}s
        </p>

        {/* Warn user if timeout is approaching */}
        {minutesUntilTimeout > 0 && minutesUntilTimeout <= 13 && (
          <p className="text-xs text-orange-500">
            Will show error state in ~{minutesUntilTimeout} min if no result
          </p>
        )}
      </div>

      {/* Footer: contact support */}
      <div className="border-t border-gray-100 pt-4 text-center">
        <p className="text-xs text-gray-400">
          Taking too long?{" "}
          <a
            href="mailto:hello@neuralreach.de"
            className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2 transition-colors"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ScanProgress({
  brandName,
  jobStatus,
  jobCreatedAt,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ScanProgressProps) {
  const router = useRouter();

  // Calculate initial state at mount time.
  // "done" with no latestRun means the DB write raced the page render — treat as retry.
  // "no_job" means the brand was saved but no scoring_jobs row exists yet (e.g. the user
  // navigated away from /dashboard/run-now before it could auto-trigger).  We treat this
  // the same as "pending": show the spinner immediately and fire POST /api/run-now on mount
  // so the scan starts without the user having to click anything.
  const initiallyFailed = jobStatus === "failed" || jobStatus === "done";
  const initiallyTimedOut =
    !initiallyFailed && msElapsed(jobCreatedAt) >= timeoutMs;

  const [showFailure, setShowFailure] = useState(
    initiallyFailed || initiallyTimedOut
  );

  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1_000);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  // Track what status to show in failure state (may differ from prop after retry)
  const [effectiveStatus, setEffectiveStatus] = useState(jobStatus);
  // Use a local creation time that resets to "now" on retry, so the timeout
  // clock starts fresh after a retry rather than using the stale job timestamp.
  const [effectiveCreatedAt, setEffectiveCreatedAt] = useState(jobCreatedAt);

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-trigger ──────────────────────────────────────────────────────────
  // Fires POST /api/run-now on mount when:
  //   "pending"  — a scoring_jobs row exists but hasn't been picked up yet
  //   "no_job"   — brand was saved but NO scoring_jobs row exists at all
  //               (happens when the user navigates to /dashboard directly after
  //                /dashboard/onboarding, bypassing /dashboard/run-now)
  //
  // For "pending", run-now picks up the existing row rather than creating a new one.
  // For "no_job",  run-now creates a fresh job and runs the scorer inline.
  const hasAutoTriggered = useRef(false);

  useEffect(() => {
    // Guard: only fire once, only when there is no active scan yet
    if (hasAutoTriggered.current) return;
    if (jobStatus !== "pending" && jobStatus !== "no_job") return;
    if (showFailure) return; // already in failure/timeout state

    hasAutoTriggered.current = true;
    // Reset timeout clock to NOW so the scan has the full 15-min window.
    // For "no_job" jobCreatedAt is null, so the clock starts here regardless.
    setEffectiveCreatedAt(new Date().toISOString());

    let cancelled = false;

    fetch("/api/run-now", { method: "POST" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          // Scorer ran to completion. Refresh to show results.
          router.refresh();
        } else {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            job_status?: string;
          };
          if (data.job_status === "running") {
            // Something else is already processing this job (e.g. another tab).
            // Timeout clock is already reset above — just keep polling.
            return;
          }
          // Genuine error — surface the failure state so the user can retry.
          setEffectiveStatus(jobStatus);
          setRetryError(data.error ?? "Failed to start scan. Please try again.");
          setShowFailure(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEffectiveStatus(jobStatus);
        setRetryError("Network error. Check your connection and try again.");
        setShowFailure(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentional: deps captured at mount time; hasAutoTriggered ref prevents re-fires.
  }, [jobStatus, showFailure, router]);

  useEffect(() => {
    if (showFailure) {
      // Clear any running timers when in failure state.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const remaining = timeoutMs - msElapsed(effectiveCreatedAt);

    if (remaining <= 0) {
      setShowFailure(true);
      setEffectiveStatus("pending"); // treat as timed-out pending
      return;
    }

    // Switch to failure UI when timeout elapses (client-side tracking).
    timeoutRef.current = setTimeout(() => {
      setShowFailure(true);
      setEffectiveStatus("pending"); // timed-out
    }, remaining);

    // Auto-refresh server data every 30 s so Next.js re-runs the page query.
    refreshRef.current = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    // Countdown display ticker (updates every second).
    countdownRef.current = setInterval(() => {
      setCountdown((c) =>
        c <= 1 ? REFRESH_INTERVAL_MS / 1_000 : c - 1
      );
    }, 1_000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showFailure, effectiveCreatedAt, timeoutMs, router]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setRetryError(null);

    try {
      const res = await fetch("/api/run-now", { method: "POST" });

      if (res.ok) {
        // Scan queued/completed — flip back to generating state.
        // Reset the effective creation time to NOW so the 15-min timeout
        // clock starts fresh (the old jobCreatedAt may be many minutes old).
        setEffectiveCreatedAt(new Date().toISOString());
        setShowFailure(false);
        setEffectiveStatus("pending");
        setRetrying(false);
        router.refresh();
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setRetryError(data.error ?? "Failed to start scan. Please try again.");
        setRetrying(false);
      }
    } catch {
      setRetryError(
        "Network error. Check your connection and try again."
      );
      setRetrying(false);
    }
  }, [router]);

  if (showFailure) {
    return (
      <FailureState
        brandName={brandName}
        jobStatus={effectiveStatus}
        onRetry={handleRetry}
        retrying={retrying}
        retryError={retryError}
      />
    );
  }

  const minutesUntilTimeout = Math.ceil(
    (timeoutMs - msElapsed(effectiveCreatedAt)) / 60_000
  );

  return (
    <GeneratingState
      brandName={brandName}
      countdown={countdown}
      minutesUntilTimeout={minutesUntilTimeout}
    />
  );
}
