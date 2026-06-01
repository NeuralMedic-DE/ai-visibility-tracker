"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Inner form ──────────────────────────────────────────────────────────────
// Must be wrapped in <Suspense> because it calls useSearchParams().

type Mode = "password" | "magic-link";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/dashboard";
  const authError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    authError === "auth_error"
      ? "The sign-in link was invalid or has expired. Request a new one."
      : ""
  );

  // ── Password sign-in ────────────────────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (authErr) {
      setError(
        authErr.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : authErr.message
      );
    } else {
      // Validate that `next` is a relative path to prevent open-redirect
      const destination = next.startsWith("/") ? next : "/dashboard";
      router.push(destination);
    }
  }

  // ── Magic-link sign-in ──────────────────────────────────────────────────
  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error: authErr } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);

    if (authErr) {
      setError(authErr.message);
    } else {
      setSent(true);
    }
  }

  // ── Magic-link sent state ────────────────────────────────────────────────
  if (mode === "magic-link" && sent) {
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
          We sent a magic link to{" "}
          <strong className="text-gray-700">{email}</strong>
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Click the link in the email to sign in. It expires in 1 hour.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setMode("password");
          }}
          className="mt-6 text-sm text-brand-600 hover:text-brand-700 underline underline-offset-2"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  // ── Password form ────────────────────────────────────────────────────────
  if (mode === "password") {
    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sign in to NeuralReach
          </h1>
          <p className="text-gray-500 text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              Create one free
            </Link>
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <Link
                href="/reset-password"
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
            disabled={loading || !email.trim() || !password}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 min-h-[48px] text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setMode("magic-link");
              setError("");
              setSent(false);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            Sign in with a magic link instead
          </button>
        </div>
      </>
    );
  }

  // ── Magic-link form ──────────────────────────────────────────────────────
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Sign in with a magic link
        </h1>
        <p className="text-gray-500 text-sm">
          We&apos;ll email you a one-click sign-in link.
        </p>
      </div>

      <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email-magic"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email address
          </label>
          <input
            id="email-magic"
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
          {loading ? "Sending…" : "Send magic link"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError("");
          }}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          Sign in with email + password instead
        </button>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
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
          <Suspense
            fallback={
              <div className="text-center text-gray-400 text-sm py-8">
                Loading…
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
