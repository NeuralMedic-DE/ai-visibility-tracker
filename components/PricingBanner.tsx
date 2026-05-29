"use client";

import { useState, useEffect } from "react";

const SESSION_KEY = "nr-pricing-banner-dismissed";

/**
 * Amber sticky banner shown on /pricing when SUBSCRIPTIONS_LIVE=false.
 * Dismissible per session (sessionStorage). Renders nothing on first paint
 * to avoid hydration mismatch — visibility is resolved client-side.
 */
export function PricingBanner() {
  // Start hidden to prevent server/client hydration mismatch.
  // The useEffect below reads sessionStorage and un-hides if not dismissed.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) !== "true") {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-16 z-40 bg-amber-50 border-b border-amber-200 shadow-sm"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-amber-800">
            <span className="font-bold">Subscriptions open Wednesday, 2026-06-04.</span>{" "}
            Join early access below to be notified when sign-ups go live.
          </p>
          <button
            onClick={dismiss}
            aria-label="Dismiss this banner"
            className="shrink-0 rounded-md p-1.5 text-amber-600 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414
                   1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293
                   4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
