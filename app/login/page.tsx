"use client";

import { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = "password" | "otp-request" | "otp-verify";

// ── Inner form ──────────────────────────────────────────────────────────────
// Must be wrapped in <Suspense> because it calls useSearchParams().

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/dashboard";
  const authError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // OTP state
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    authError === "auth_error"
      ? "The sign-in link was invalid or has expired. Try the code option instead."
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
      const destination = next.startsWith("/") ? next : "/dashboard";
      router.push(destination);
    }
  }

  // ── OTP request ─────────────────────────────────────────────────────────
  // Sends a 6-digit code to the inbox.
  // We intentionally omit `emailRedirectTo` so Supabase sends a typed
  // OTP (numeric code) instead of a click-link, which defeats iCloud/Apple
  // Mail prefetch that would consume a one-time link before the user clicks it.
  async function handleOtpRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      // No emailRedirectTo → Supabase sends a 6-digit code, not a link
      options: { shouldCreateUser: false },
    });

    setLoading(false);

    if (authErr) {
      setError(authErr.message);
    } else {
      setOtp("");
      setMode("otp-verify");
      // Focus OTP field after state update
      setTimeout(() => otpInputRef.current?.focus(), 50);
    }
  }

  // ── OTP verify ──────────────────────────────────────────────────────────
  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = otp.trim().replace(/\D/g, "");
    if (token.length !== 6) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });

    setLoading(false);

    if (authErr) {
      setError(
        authErr.message.includes("expired") || authErr.message.includes("invalid")
          ? "Code is invalid or has expired. Request a new one."
          : authErr.message
      );
    } else {
      const destination = next.startsWith("/") ? next : "/dashboard";
      router.push(destination);
    }
  }

  // ── OTP: enter code step ─────────────────────────────────────────────────
  if (mode === "otp-verify") {
    const digits = otp.replace(/\D/g, "");
    return (
      <>
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 mb-4">
            <svg
              className="h-8 w-8 text-brand-600"
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
          <p className="text-gray-500 text-sm">
            We sent a 6-digit code to{" "}
            <strong className="text-gray-700">{email}</strong>
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Enter the code below — it expires in 10 minutes.
          </p>
        </div>

        <form onSubmit={handleOtpVerify} className="space-y-4">
          <div>
            <label
              htmlFor="otp-code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              6-digit code
            </label>
            <input
              id="otp-code"
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(val);
              }}
              placeholder="123456"
              required
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 min-h-[48px] text-center text-2xl font-mono tracking-[0.4em] text-gray-900 placeholder-gray-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || digits.length !== 6}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 min-h-[48px] text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verifying…" : "Verify code"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-gray-400">
          <button
            type="button"
            onClick={() => {
              setError("");
              setOtp("");
              setMode("otp-request");
            }}
            className="hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            Resend code
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError("");
              setOtp("");
            }}
            className="hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            Use password instead
          </button>
        </div>
      </>
    );
  }

  // ── OTP: request step ────────────────────────────────────────────────────
  if (mode === "otp-request") {
    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sign in with email code
          </h1>
          <p className="text-gray-500 text-sm">
            We&apos;ll email you a 6-digit code to sign in — no link to click.
          </p>
        </div>

        <form onSubmit={handleOtpRequest} className="space-y-4">
          <div>
            <label
              htmlFor="email-otp"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address
            </label>
            <input
              id="email-otp"
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
            {loading ? "Sending code…" : "Send code"}
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

  // ── Password form ────────────────────────────────────────────────────────
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
            setMode("otp-request");
            setError("");
          }}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          Sign in with email code instead
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
