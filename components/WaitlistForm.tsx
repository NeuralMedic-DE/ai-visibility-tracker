"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface WaitlistFormProps {
  className?: string;
  variant?: "hero" | "compact";
  /** Pre-fill the brand name field — useful when opening from a specific row */
  defaultBrandInterest?: string;
}

export function WaitlistForm({ className, variant = "hero", defaultBrandInterest }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [brandInterest, setBrandInterest] = useState(defaultBrandInterest ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, brand_interest: brandInterest }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
      setMessage("You're on the list! We'll notify you when we launch.");
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
        <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? "Joining…" : "Get Early Access"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <input
            type="text"
            value={brandInterest}
            onChange={(e) => setBrandInterest(e.target.value)}
            placeholder="Your brand / product name (optional)"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? "Joining…" : "Join Waitlist"}
          </button>
        </div>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600 text-center">{message}</p>
      )}
      <p className="mt-2 text-xs text-gray-500 text-center">No spam. Unsubscribe anytime.</p>
    </form>
  );
}
