"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface PricingNotifyFormProps {
  /** Which plan card this form belongs to — sent as a hidden field to /api/waitlist */
  plan: "starter" | "pro";
  /** Match the highlighted (Pro) card style */
  highlighted?: boolean;
}

/**
 * Inline "notify me" form shown inside each pricing card when SUBSCRIPTIONS_LIVE=false.
 * Posts to /api/waitlist with interested_plan so we can segment leads by plan.
 */
export function PricingNotifyForm({
  plan,
  highlighted = false,
}: PricingNotifyFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, interested_plan: plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("success");
      setMessage("Got it! We will notify you when subscriptions open.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Please try again."
      );
    }
  }

  if (status === "success") {
    return (
      <div
        className={cn(
          "rounded-lg px-4 py-3 text-center text-sm font-medium",
          highlighted
            ? "bg-brand-500 text-white border border-brand-400"
            : "bg-green-50 text-green-800 border border-green-200"
        )}
      >
        {message}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        aria-label="Work email"
        className={cn(
          "w-full rounded-lg border px-4 py-3 text-sm min-h-[48px]",
          "focus:outline-none focus:ring-2 transition-colors",
          highlighted
            ? "border-brand-400 bg-brand-500 text-white placeholder-brand-300 focus:border-white focus:ring-white/30"
            : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-brand-200 shadow-sm"
        )}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={cn(
          "w-full rounded-lg px-4 py-3 min-h-[48px] text-sm font-semibold transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          highlighted
            ? "bg-white text-brand-600 hover:bg-brand-50 focus:ring-white"
            : "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500"
        )}
      >
        {status === "loading" ? "Joining…" : "Notify me when subscriptions open"}
      </button>
      {status === "error" && (
        <p
          role="alert"
          className={cn(
            "text-xs text-center",
            highlighted ? "text-red-300" : "text-red-600"
          )}
        >
          {message}
        </p>
      )}
    </form>
  );
}
