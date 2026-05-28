import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: "Dashboard — NeuralReach",
  description: "Your NeuralReach account dashboard.",
};

// ── Display config maps ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  trialing: { label: "Free trial", className: "bg-blue-100 text-blue-800" },
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  past_due: { label: "Past due", className: "bg-yellow-100 text-yellow-800" },
  canceled: { label: "Canceled", className: "bg-gray-100 text-gray-600" },
  incomplete: {
    label: "Incomplete",
    className: "bg-orange-100 text-orange-800",
  },
  unpaid: { label: "Unpaid", className: "bg-red-100 text-red-800" },
  none: { label: "No subscription", className: "bg-gray-100 text-gray-600" },
};

const PLAN_CONFIG: Record<string, { label: string; className: string }> = {
  starter: { label: "Starter", className: "bg-brand-100 text-brand-700" },
  pro: { label: "Pro", className: "bg-purple-100 text-purple-800" },
};

// ── Types ───────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  email: string;
  plan: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
};

// ── Page ────────────────────────────────────────────────────────────────────

interface DashboardPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;

  // 1. Verify session — middleware also guards this, but belt-and-suspenders.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  // 2. Load customer row via admin client (RLS: service_role only).
  const admin = createAdminClient();
  const { data: customerRaw } = await admin
    .from("customers")
    .select(
      "id, email, plan, subscription_status, trial_ends_at, current_period_end, created_at"
    )
    .eq("email", user.email)
    .maybeSingle();

  const customer = customerRaw as Customer | null;

  // 3. Check whether this is a brand-new paying customer (≤ 5 min ago).
  const isNewlyCreated = customer
    ? new Date(customer.created_at).getTime() >
      Date.now() - 5 * 60 * 1000
    : false;
  const showSuccessView =
    params.checkout === "success" && isNewlyCreated;

  // 4. Trial days remaining.
  let trialDaysLeft: number | null = null;
  if (
    customer?.subscription_status === "trialing" &&
    customer.trial_ends_at
  ) {
    const ms = new Date(customer.trial_ends_at).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  // 5. Check for tracked brands (table arrives in T2 — gracefully absent for now).
  let hasTrackedBrands = false;
  if (customer) {
    const { data: brandRows } = await admin
      .from("tracked_brands")
      .select("id")
      .eq("customer_id", customer.id)
      .limit(1);
    // If the table doesn't exist yet, brandRows will be null and the error
    // is silently swallowed — hasTrackedBrands stays false.
    hasTrackedBrands = !!(brandRows && brandRows.length > 0);
  }

  // 6. Billing portal link (per-customer portal wired in T3; use env fallback).
  const billingLink =
    process.env.STRIPE_CANCELLATION_LINK ?? "/pricing";

  const statusInfo =
    STATUS_CONFIG[customer?.subscription_status ?? "none"] ??
    STATUS_CONFIG["none"];
  const planInfo = customer?.plan ? PLAN_CONFIG[customer.plan] : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/leaderboard"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                AI Visibility Index
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
        {showSuccessView ? (
          <SuccessView email={user.email!} />
        ) : !customer ? (
          <NoSubscriptionView email={user.email!} />
        ) : (
          <AccountView
            email={user.email!}
            customer={customer}
            statusInfo={statusInfo}
            planInfo={planInfo}
            trialDaysLeft={trialDaysLeft}
            billingLink={billingLink}
            hasTrackedBrands={hasTrackedBrands}
          />
        )}
      </main>
    </div>
  );
}

// ── Sub-views ───────────────────────────────────────────────────────────────

/** Shown when ?checkout=success AND customer row was created ≤ 5 min ago */
function SuccessView({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
        <svg
          className="h-8 w-8 text-green-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
        You&apos;re in! 🎉
      </h1>
      <p className="text-xs text-gray-400 mb-2">Signed in as {email}</p>
      <p className="text-gray-600 text-lg mb-2">
        Your 14-day free trial has started.
      </p>
      <p className="text-gray-500 text-sm mb-10">
        We&apos;ll email you a confirmation shortly. Your first AI visibility
        report will run within 24 hours.
      </p>

      <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6 text-left space-y-4 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          What happens next
        </h2>
        {[
          {
            emoji: "📬",
            title: "Check your inbox",
            desc: "You'll receive a welcome email with your account details and how to add your brand.",
          },
          {
            emoji: "🔍",
            title: "First scan runs within 24 hours",
            desc: "We'll query ChatGPT, Claude, Perplexity, and Google AI Overviews for your brand and send you the results.",
          },
          {
            emoji: "📊",
            title: "Get your visibility score",
            desc: "Your first report shows where AI search mentions (or ignores) your brand — and what to fix.",
          },
          {
            emoji: "💳",
            title: "No charge until day 15",
            desc: "Your trial runs for 14 days. Cancel anytime before then and you won't be billed.",
          },
        ].map(({ emoji, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/dashboard"
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Go to my dashboard →
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Explore AI Visibility Index
        </Link>
      </div>
    </div>
  );
}

/** Shown when user is logged in but has no matching row in customers */
function NoSubscriptionView({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 mb-4">
        <span className="text-2xl" aria-hidden="true">
          ⚠️
        </span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        No active subscription found
      </h1>
      <p className="text-gray-500 mb-6 text-sm">
        We don&apos;t see an active subscription for{" "}
        <strong className="text-gray-700">{email}</strong>.
      </p>
      <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6 mb-6 text-sm text-gray-600 text-left">
        <p>
          If you just subscribed, it can take a minute for your account to
          activate — try refreshing in a moment.
        </p>
        <p className="mt-2">
          Think this is a mistake? Email us at{" "}
          <a
            href="mailto:hello@neuralreach.de"
            className="text-brand-600 hover:underline underline-offset-2"
          >
            hello@neuralreach.de
          </a>
          .
        </p>
      </div>
      <Link
        href="/pricing"
        className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors inline-block"
      >
        Subscribe →
      </Link>
    </div>
  );
}

/** Main account view for active/trialing customers */
function AccountView({
  email,
  customer,
  statusInfo,
  planInfo,
  trialDaysLeft,
  billingLink,
  hasTrackedBrands,
}: {
  email: string;
  customer: Customer;
  statusInfo: { label: string; className: string };
  planInfo: { label: string; className: string } | null;
  trialDaysLeft: number | null;
  billingLink: string;
  hasTrackedBrands: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-400 mt-1">{email}</p>
      </div>

      {/* Subscription card */}
      <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Subscription
        </h2>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {planInfo && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${planInfo.className}`}
            >
              {planInfo.label}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusInfo.className}`}
          >
            {statusInfo.label}
          </span>
          {trialDaysLeft !== null && (
            <span className="text-sm font-medium text-blue-700">
              {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in
              trial
            </span>
          )}
        </div>

        {/* Renewal date */}
        {customer.current_period_end &&
          customer.subscription_status === "active" && (
            <p className="text-xs text-gray-400 mb-4">
              Renews{" "}
              {new Date(customer.current_period_end).toLocaleDateString(
                "en-US",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
            </p>
          )}

        <a
          href={billingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Manage billing →
        </a>
      </div>

      {/* Brand tracker section */}
      {hasTrackedBrands ? (
        /* T2 will replace this with real tracking data */
        <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Brand Tracker
          </h2>
          <p className="text-sm text-gray-600">
            Your tracked brands and scores will appear here.
          </p>
        </div>
      ) : (
        /* CTA: no brands tracked yet */
        <div className="rounded-2xl bg-white ring-1 ring-brand-200 p-6">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 shrink-0 mt-0.5">
              <span className="text-xl" aria-hidden="true">
                🎯
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Coming next: brand tracker
              </h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Once you add your brand, you&apos;ll see weekly AI visibility
                scores across ChatGPT, Claude, Perplexity, and Google AI
                Overviews — plus a fix list to close the gap.
              </p>
              <Link
                href="/dashboard/onboarding"
                className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Add your brand to start tracking →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
