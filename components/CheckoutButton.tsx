"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface CheckoutButtonProps {
  plan: "starter" | "pro";
  label?: string;
  className?: string;
  /** If true, renders as a full-width block element */
  block?: boolean;
}

export function CheckoutButton({
  plan,
  label,
  className,
  block = true,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLabel = plan === "starter"
    ? "Start Starter for $39/mo"
    : "Start Pro for $89/mo";

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={block ? "w-full" : ""}>
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          block && "w-full text-center",
          className
        )}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Redirecting to Stripe…
          </span>
        ) : (
          label ?? defaultLabel
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
