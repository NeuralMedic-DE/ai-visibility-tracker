"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Update-password form ─────────────────────────────────────────────────────
// Only reachable after the user clicked the reset-password email link,
// which passes through /auth/callback and establishes a recovery session.

function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Verify the user has an active session (the recovery session set by
  // /auth/callback). If not, redirect to /reset-password so they restart
  // the flow.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/reset-password");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (authErr) {
      setError(authErr.message);
    } else {
      setSuccess(true);
      // Give the user a moment to read the success message, then redirect.
      setTimeout(() => router.push("/dashboard"), 2000);
    }
  }

  // ── Loading / session check ──────────────────────────────────────────────
  if (checking) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">Verifying…</div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
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
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Password updated
        </h1>
        <p className="text-gray-500 text-sm">
          Redirecting you to your dashboard…
        </p>
      </div>
    );
  }

  // ── Form state ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Set a new password
        </h1>
        <p className="text-gray-500 text-sm">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            New password{" "}
            <span className="text-gray-400 font-normal">(min. 8 characters)</span>
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 min-h-[48px] text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-new-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm new password
          </label>
          <input
            id="confirm-new-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
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
          disabled={loading || !password || !confirmPassword}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 min-h-[48px] text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        <Link
          href="/login"
          className="text-brand-600 hover:underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UpdatePasswordPage() {
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
          <UpdatePasswordForm />
        </div>
      </main>
    </div>
  );
}
