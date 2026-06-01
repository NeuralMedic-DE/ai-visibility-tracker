"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Reset-password request form ──────────────────────────────────────────────

function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    // After Supabase sends the reset email, the link points to /auth/callback
    // which exchanges the code for a session and then redirects to
    // /reset-password/update where the user sets a new password.
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password/update`;

    const { error: authErr } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    );

    setLoading(false);

    if (authErr) {
      setError(authErr.message);
    } else {
      setSent(true);
    }
  }

  // ── Sent state ───────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Check your inbox
        </h1>
        <p className="text-gray-500 mb-1 text-sm">
          If an account exists for{" "}
          <strong className="text-gray-700">{email}</strong>, we&apos;ve sent a
          password-reset link.
        </p>
        <p className="text-gray-400 text-xs mt-1">
          The link expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-brand-600 hover:text-brand-700 underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  // ── Form state ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Reset your password
        </h1>
        <p className="text-gray-500 text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 min-h-[48px] text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 min-h-[48px] text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="text-brand-600 hover:underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
          </div>
        </div>
      </nav>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-8">
          <ResetPasswordForm />
        </div>
      </main>
    </div>
  );
}
