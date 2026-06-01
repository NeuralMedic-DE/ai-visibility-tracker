"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface WaitlistFormProps {
  className?: string;
  variant?: "hero" | "compact";
  /**
   * "light" (default): labels in gray-700, for white/light backgrounds.
   * "dark": labels in white/90, for dark brand-color backgrounds.
   */
  theme?: "light" | "dark";
  /** Pre-fill the brand name field — useful when opening from a specific row */
  defaultBrandInterest?: string;
  /**
   * Hidden field sent to /api/waitlist — records which plan the visitor was
   * viewing when they signed up (e.g. from a pricing-page CTA).
   */
  interestedPlan?: "starter" | "pro";
}

export function WaitlistForm({
  className,
  variant = "hero",
  theme = "light",
  defaultBrandInterest,
  interestedPlan,
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [brandInterest, setBrandInterest] = useState(defaultBrandInterest ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const labelClass = cn(
    "block text-sm font-medium mb-1.5",
    theme === "dark" ? "text-white/90" : "text-gray-700"
  );

  const inputClass = cn(
    "w-full rounded-lg border px-4 py-3 text-sm min-h-[48px]",
    "focus:outline-none focus:ring-2 transition-colors",
    theme === "dark"
      ? "border-white/30 bg-white/10 text-white placeholder-white/50 focus:border-white focus:ring-white/30"
      : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-brand-200 shadow-sm"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          brand_interest: brandInterest,
          ...(interestedPlan ? { interested_plan: interestedPlan } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
      setMessage("You're on the list. You'll get an activation link 48 hours before public launch.");
      setEmail("");
      setBrandInterest("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className={cn("rounded-xl bg-green-50 border border-green-200 p-6 text-center", className)}>
        <div className="text-3xl mb-2">🎉</div>
        <p className="font-semibold text-green-800">{message}</p>
        <p className="text-sm text-green-600 mt-1">Check your inbox for a confirmation.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      {variant === "hero" ? (
        /* ── Hero variant: side-by-side on sm+ ── */
        <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <div className="flex-1">
            <label htmlFor="waitlist-email-hero" className="sr-only">
              Work email
            </label>
            <input
              id="waitlist-email-hero"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={cn(
                "w-full rounded-lg border border-gray-300 px-4 py-3 min-h-[48px] text-sm shadow-sm",
                "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
              )}
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className={cn(
              "inline-flex items-center justify-center min-h-[48px] rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm",
              "hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
              "whitespace-nowrap"
            )}
          >
            {status === "loading" ? "Claiming spot…" : "Claim My Early Access"}
          </button>
        </div>
      ) : (
        /* ── Compact variant: stacked, labels visible ── */
        <div className="space-y-4">
          <div>
            <label htmlFor="waitlist-email-compact" className={labelClass}>
              Work email
            </label>
            <input
              id="waitlist-email-compact"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="waitlist-brand-compact" className={labelClass}>
              Brand / product name{" "}
              <span className={cn("font-normal", theme === "dark" ? "text-white/60" : "text-gray-400")}>
                (optional)
              </span>
            </label>
            <input
              id="waitlist-brand-compact"
              type="text"
              value={brandInterest}
              onChange={(e) => setBrandInterest(e.target.value)}
              placeholder="e.g. Acme SaaS"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className={cn(
              "w-full inline-flex items-center justify-center min-h-[48px] rounded-lg px-6 py-3 text-sm font-semibold",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
              theme === "dark"
                ? "bg-white text-brand-700 hover:bg-brand-50 focus:ring-white"
                : "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500"
            )}
          >
            {status === "loading" ? "Claiming spot…" : "Claim My Early Access"}
          </button>
        </div>
      )}

      {status === "error" && (
        <p
          className={cn(
            "mt-2 text-sm text-center",
            theme === "dark" ? "text-red-200" : "text-red-600"
          )}
          role="alert"
        >
          {message}
        </p>
      )}
      <p
        className={cn(
          "mt-2 text-xs text-center",
          theme === "dark" ? "text-white/60" : "text-gray-500"
        )}
      >
        No spam. Unsubscribe anytime.
      </p>
    </form>
  );
}
