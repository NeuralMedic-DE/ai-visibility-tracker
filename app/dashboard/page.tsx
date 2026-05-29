import { readdir, readFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";
import AutoRefresh from "@/components/AutoRefresh";

export const metadata: Metadata = {
  title: "Dashboard | NeuralReach",
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

const LLM_LABELS: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  perplexity: "Perplexity",
  google: "Google AI",
};

/** Why each gap category matters (shown as the "fix context" under gap prompts) */
const GAP_CONTEXT: Record<
  string,
  { why: string; fix: string; fixLabel: string }
> = {
  use_case: {
    why: "Use-case prompts reach buyers at the exact moment they need your solution — the highest-converting prompt type in AI search.",
    fix: "Create or expand a dedicated use-case page for this scenario with concrete outcomes, customer stories, and FAQPage schema markup.",
    fixLabel: "Create use-case page",
  },
  category_discovery: {
    why: "Category discovery queries drive early-funnel awareness. Missing here means you're invisible before buyers even reach the consideration stage.",
    fix: "Publish a comprehensive category guide or 'best tools for X' page that establishes topical authority in this space. Add SoftwareApplication schema.",
    fixLabel: "Improve category authority",
  },
  alternatives: {
    why: "Alternative searches capture switching-intent demand at its peak — buyers are actively evaluating. Visibility here closes deals against incumbents.",
    fix: "Build a dedicated '[Your Brand] vs [Competitor]' or 'Alternatives to X' page with factual, structured comparisons.",
    fixLabel: "Build comparison page",
  },
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

type TrackedBrand = {
  id: string;
  brand_name: string;
  brand_url: string;
  competitors: Array<{ name: string; url: string }>;
  category: string | null;
};

/** Shape written by scorer/run_for_customer.py into customer_scoring_runs.gap_prompts JSONB */
type GapPrompt = {
  prompt_id: string;
  prompt_text: string;
  /** Category written by scorer: "use_case" | "category_discovery" | "alternatives" */
  category?: string;
  /** Alternate field name that may appear from brand JSON imports */
  prompt_category?: string;
  /** LLMs that missed this prompt (scorer format) */
  llms_missed?: string[];
  /** Alternate field name from brand JSON */
  llms_missing?: string[];
  /** Count field from brand JSON */
  llms_missing_count?: number;
  /** Explanation from brand JSON (not present in scorer output) */
  why_it_matters?: string;
};

type ScoringRun = {
  id: string;
  run_date: string;
  avs_brand: number;
  per_llm: Record<string, number>;
  gap_prompts: GapPrompt[];
  fix_report_md: string | null;
  created_at: string;
};

type IndexRank = { rank: number; total: number };

// ── Server helpers ──────────────────────────────────────────────────────────

/**
 * Computes where a given AVS score would rank in the public 100-brand index.
 * Reads brand JSON files from disk — server component only.
 */
async function computeIndexRank(avs: number): Promise<IndexRank> {
  try {
    const brandsDir = path.join(process.cwd(), "data", "brands");
    const files = await readdir(brandsDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const scores = await Promise.all(
      jsonFiles.map(async (f) => {
        const raw = await readFile(path.join(brandsDir, f), "utf-8");
        const data = JSON.parse(raw) as { avs_brand?: number };
        return typeof data.avs_brand === "number" ? data.avs_brand : 0;
      })
    );
    const aboveCount = scores.filter((s) => s > avs).length;
    return { rank: aboveCount + 1, total: scores.length };
  } catch {
    // Fail gracefully — rank display is non-critical
    return { rank: 0, total: 100 };
  }
}

/** Days until next weekly report. Run is weekly; returns null if overdue. */
function daysUntilNextReport(runDate: string): number {
  const next = new Date(runDate);
  next.setDate(next.getDate() + 7);
  const msLeft = next.getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / (1_000 * 60 * 60 * 24)));
}

// ── Page ────────────────────────────────────────────────────────────────────

interface DashboardPageProps {
  searchParams: Promise<{ checkout?: string; running?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;

  // 1. Verify session
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
    ? new Date(customer.created_at).getTime() > Date.now() - 5 * 60 * 1_000
    : false;
  const showSuccessView = params.checkout === "success" && isNewlyCreated;

  // 4. Trial days remaining.
  let trialDaysLeft: number | null = null;
  if (
    customer?.subscription_status === "trialing" &&
    customer.trial_ends_at
  ) {
    const ms = new Date(customer.trial_ends_at).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(ms / (1_000 * 60 * 60 * 24)));
  }

  // 5. Load tracked brand (if table exists; gracefully absent).
  let trackedBrand: TrackedBrand | null = null;
  if (customer) {
    const { data: brandRow } = await admin
      .from("tracked_brands")
      .select("id, brand_name, brand_url, competitors, category")
      .eq("customer_id", customer.id)
      .maybeSingle();
    trackedBrand = brandRow as TrackedBrand | null;
  }

  // 6. Load latest scoring run (if any).
  let latestRun: ScoringRun | null = null;
  if (customer) {
    const { data: runRow } = await admin
      .from("customer_scoring_runs")
      .select(
        "id, run_date, avs_brand, per_llm, gap_prompts, fix_report_md, created_at"
      )
      .eq("customer_id", customer.id)
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestRun = runRow as ScoringRun | null;
  }

  // 7. Compute index rank (server-side fs read, only when we have results).
  let indexRank: IndexRank = { rank: 0, total: 100 };
  if (latestRun) {
    indexRank = await computeIndexRank(Number(latestRun.avs_brand));
  }

  // 8. Billing portal link.
  const billingLink = process.env.STRIPE_CANCELLATION_LINK ?? "/pricing";

  const statusInfo =
    STATUS_CONFIG[customer?.subscription_status ?? "none"] ??
    STATUS_CONFIG["none"];
  const planInfo = customer?.plan ? PLAN_CONFIG[customer.plan] : null;

  const isRunning = params.running === "1";

  // ── Render ─────────────────────────────────────────────────────────────────
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
            trackedBrand={trackedBrand}
            latestRun={latestRun}
            indexRank={indexRank}
            isRunning={isRunning}
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
        We&apos;ll email you a confirmation shortly. Next step: add your brand
        and run your first AI visibility scan.
      </p>

      <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6 text-left space-y-4 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          What happens next
        </h2>
        {[
          {
            emoji: "🎯",
            title: "Add your brand",
            desc: "Tell us your brand name, website, and up to 3 competitors.",
          },
          {
            emoji: "🔍",
            title: "Run your first scan",
            desc: "We'll query ChatGPT, Claude, Perplexity, and Google AI Overviews with 25 prompts.",
          },
          {
            emoji: "📊",
            title: "Get your visibility score",
            desc: "Your report shows where AI search mentions (or ignores) your brand, and what to fix.",
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
          href="/dashboard/onboarding"
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Add my brand
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
          activate. Try refreshing in a moment.
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
        Subscribe
      </Link>
    </div>
  );
}

/** Main account view — dispatches to the three brand-tracking states */
function AccountView({
  email,
  customer,
  statusInfo,
  planInfo,
  trialDaysLeft,
  billingLink,
  trackedBrand,
  latestRun,
  indexRank,
  isRunning,
}: {
  email: string;
  customer: Customer;
  statusInfo: { label: string; className: string };
  planInfo: { label: string; className: string } | null;
  trialDaysLeft: number | null;
  billingLink: string;
  trackedBrand: TrackedBrand | null;
  latestRun: ScoringRun | null;
  indexRank: IndexRank;
  isRunning: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">{email}</p>
      </div>

      {/* Re-scan in-progress banner (only relevant on state C when user re-triggered) */}
      {isRunning && latestRun && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 flex items-start gap-3">
          <span className="text-xl shrink-0">⚙️</span>
          <div>
            <p className="text-sm font-semibold text-blue-800">
              New scan in progress…
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              We&apos;re re-querying ChatGPT, Claude, Perplexity, and Google AI
              Overviews for your brand. Your previous results are shown below.
              Refresh the page to check for updated scores.
            </p>
          </div>
        </div>
      )}

      {/*
       * ─────────────────────────────────────────────────────────
       *  STATE A: No tracked brand → friendly empty state
       *  STATE B: Brand saved, no results yet → generating
       *  STATE C: Has scoring results → full report
       * ─────────────────────────────────────────────────────────
       */}
      {!trackedBrand ? (
        <EmptyState />
      ) : !latestRun ? (
        <GeneratingState brandName={trackedBrand.brand_name} />
      ) : (
        <ScoringResults
          brand={trackedBrand}
          run={latestRun}
          indexRank={indexRank}
          isPro={customer.plan === "pro"}
        />
      )}

      {/* Subscription card — always visible */}
      <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Subscription
        </h2>

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
              {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in trial
            </span>
          )}
        </div>

        {customer.current_period_end &&
          customer.subscription_status === "active" && (
            <p className="text-xs text-gray-400 mb-4">
              Renews{" "}
              {new Date(customer.current_period_end).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" }
              )}
            </p>
          )}

        <a
          href={billingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Manage billing
        </a>
      </div>
    </div>
  );
}

// ── STATE A: Empty state (no tracked brand) ──────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-brand-200 overflow-hidden">
      {/* Top accent band */}
      <div className="h-1.5 bg-gradient-to-r from-brand-500 to-brand-400" />

      <div className="p-8">
        {/* Icon */}
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 border border-brand-100 mb-5">
          <span className="text-3xl" aria-hidden="true">
            🎯
          </span>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Add your brand to start tracking
        </h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-md">
          Find out exactly where your brand appears — or doesn&apos;t — when
          buyers search AI tools like ChatGPT, Claude, and Perplexity. It takes
          under two minutes to set up.
        </p>

        {/* Feature list */}
        <ul className="space-y-2.5 mb-8">
          {[
            {
              icon: "📡",
              text: "25 buyer-intent prompts across 4 AI platforms",
            },
            {
              icon: "📊",
              text: "AI Visibility Score (AVS) benchmarked against 100 B2B SaaS brands",
            },
            {
              icon: "🔧",
              text: "Top 3 gap prompts with concrete fixes to close the gap",
            },
            {
              icon: "📬",
              text: "Weekly automated re-scoring — no manual work required",
            },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-base shrink-0" aria-hidden="true">
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href="/dashboard/onboarding"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
        >
          <span>Add your brand to start tracking</span>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </Link>

        <p className="mt-4 text-xs text-gray-400">
          Setup takes under 2 minutes · First scan completes in ~10 minutes
        </p>
      </div>
    </div>
  );
}

// ── STATE B: Generating (brand saved, no results yet) ────────────────────────

function GeneratingState({ brandName }: { brandName: string }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-8">
      {/* Animated icon area */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative inline-flex h-16 w-16 items-center justify-center mb-5">
          {/* Pulsing rings */}
          <span className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-40" />
          <span className="absolute inset-1 rounded-full bg-blue-100 animate-ping opacity-30 animation-delay-150" />
          <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <svg
              className="h-8 w-8 text-blue-600 animate-spin"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Your first report is generating
        </h2>
        <p className="text-sm text-gray-500 mb-1 leading-relaxed max-w-sm">
          Usually <strong className="text-gray-700">6–12 minutes</strong>. We&apos;re
          querying ChatGPT, Claude, Perplexity, and Google AI Overviews using 25
          buyer-intent prompts for{" "}
          <strong className="text-gray-700">{brandName}</strong>.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          We&apos;ll email you when it&apos;s ready.
        </p>

        {/* Progress steps */}
        <div className="w-full max-w-sm rounded-xl bg-gray-50 border border-gray-100 p-4 text-left space-y-3 mb-6">
          {[
            { label: "Generating 25 prompts", done: true },
            { label: "Querying 4 AI platforms", done: true },
            { label: "Scoring mentions & gaps", done: false },
            { label: "Building your report", done: false },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? "bg-green-100"
                    : "bg-blue-100 animate-pulse"
                }`}
              >
                {done ? (
                  <svg
                    className="h-3 w-3 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                )}
              </div>
              <span
                className={`text-sm ${
                  done ? "text-gray-500 line-through" : "text-gray-700"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Auto-refresh client component */}
        <AutoRefresh intervalMs={30_000} label="Checking for results" />
      </div>

      {/* Fallback / manual trigger */}
      <div className="border-t border-gray-100 pt-4 text-center">
        <p className="text-xs text-gray-400 mb-2">
          Scan not triggered yet?
        </p>
        <Link
          href="/dashboard/run-now"
          className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2 transition-colors"
        >
          Trigger scan manually →
        </Link>
      </div>
    </div>
  );
}

// ── AVS colour / label helpers ────────────────────────────────────────────────

function avsColor(score: number): string {
  if (score >= 60) return "text-green-600";
  if (score >= 35) return "text-yellow-600";
  return "text-red-600";
}

function avsBgColor(score: number): string {
  if (score >= 60) return "bg-green-500";
  if (score >= 35) return "bg-yellow-500";
  return "bg-red-500";
}

function avsLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Weak";
  return "Very Low";
}

/** Ordinal suffix: 1 → "st", 2 → "nd", 3 → "rd", 4+ → "th" */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── STATE C: Scoring results ──────────────────────────────────────────────────

function ScoringResults({
  brand,
  run,
  indexRank,
  isPro,
}: {
  brand: TrackedBrand;
  run: ScoringRun;
  indexRank: IndexRank;
  isPro: boolean;
}) {
  const avs = Number(run.avs_brand);
  const runDate = new Date(run.run_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const daysLeft = daysUntilNextReport(run.run_date);
  const hasRank = indexRank.rank > 0;

  return (
    <div className="space-y-5">
      {/* ── Brand header + overall AVS + index rank ── */}
      <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {brand.brand_name}
            </h2>
            <a
              href={brand.brand_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
            >
              {brand.brand_url}
            </a>
          </div>

          {/* AVS score + rank */}
          <div className="text-right">
            <p className={`text-4xl font-extrabold ${avsColor(avs)}`}>
              {avs.toFixed(1)}
            </p>
            <p className="text-xs text-gray-400">/ 100 AVS</p>
            <p className={`text-xs font-semibold mt-0.5 ${avsColor(avs)}`}>
              {avsLabel(avs)}
            </p>
            {hasRank && (
              <p className="text-xs text-gray-500 mt-1">
                {ordinal(indexRank.rank)} of {indexRank.total} brands
              </p>
            )}
          </div>
        </div>

        {/* Index rank progress bar */}
        {hasRank && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">
                Rank vs AI Visibility Index
              </span>
              <span className="text-xs font-semibold text-gray-700">
                #{indexRank.rank} / {indexRank.total}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${avsBgColor(avs)}`}
                style={{
                  width: `${Math.round(
                    ((indexRank.total - indexRank.rank + 1) / indexRank.total) *
                      100
                  )}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {indexRank.rank <= indexRank.total / 4
                ? "Top quartile — strong AI visibility"
                : indexRank.rank <= indexRank.total / 2
                ? "Above median — room to improve"
                : indexRank.rank <= (indexRank.total * 3) / 4
                ? "Below median — significant gaps"
                : "Bottom quartile — urgent action needed"}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mb-5">
          Run on {runDate} · 25 prompts × {Object.keys(run.per_llm).length} AI
          models
        </p>

        {/* Per-LLM bars */}
        <div className="space-y-3 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Per-AI Score
          </p>
          {Object.entries(run.per_llm).map(([llm, score]) => {
            const pct = Math.min(100, Math.max(0, Number(score)));
            return (
              <div key={llm}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">
                    {LLM_LABELS[llm] ?? llm}
                  </span>
                  <span className={`text-sm font-semibold ${avsColor(pct)}`}>
                    {pct.toFixed(1)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full transition-all ${avsBgColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Next report indicator */}
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm" aria-hidden="true">
              📅
            </span>
            <span className="text-xs text-gray-600">
              {daysLeft === 0
                ? "Next report is generating today"
                : daysLeft === 1
                ? "Next report tomorrow"
                : `Next report in ${daysLeft} days`}
            </span>
          </div>
          <span className="text-xs text-gray-400">Weekly · automated</span>
        </div>

        <div className="mt-4 flex gap-3">
          <Link
            href="/dashboard/run-now"
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Re-run scan now
          </Link>
          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit brand
          </Link>
        </div>
      </div>

      {/* ── Top 3 gap prompts with fixes ── */}
      {run.gap_prompts && run.gap_prompts.length > 0 && (
        <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Top Visibility Gaps
          </h3>
          <p className="text-xs text-gray-400 mb-5">
            Prompts where AI models didn&apos;t mention{" "}
            <strong>{brand.brand_name}</strong> — with actionable fixes
          </p>
          <div className="space-y-4">
            {run.gap_prompts.slice(0, 3).map((gap, idx) => {
              // Normalise field names between scorer output and brand JSON
              const category =
                gap.category ?? gap.prompt_category ?? "use_case";
              const llmsMissed = gap.llms_missed ?? gap.llms_missing ?? [];
              const ctx = GAP_CONTEXT[category] ?? GAP_CONTEXT["use_case"];
              const whyItMatters = gap.why_it_matters ?? ctx.why;

              return (
                <div
                  key={gap.prompt_id ?? idx}
                  className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden"
                >
                  {/* Gap header */}
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium leading-snug">
                          &quot;{gap.prompt_text}&quot;
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                            {category.replace(/_/g, " ")}
                          </span>
                          {llmsMissed.map((llm) => (
                            <span
                              key={llm}
                              className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium"
                            >
                              missed by {LLM_LABELS[llm] ?? llm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Why it matters + fix */}
                  <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-2">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      <span className="font-semibold text-gray-700">
                        Why it matters:{" "}
                      </span>
                      {whyItMatters}
                    </p>
                    <div className="flex items-start gap-2">
                      <span className="text-xs shrink-0 mt-0.5">🔧</span>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        <span className="font-semibold">Fix: </span>
                        {ctx.fix}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Fix Report — Pro only ── */}
      {isPro && run.fix_report_md ? (
        <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_CONFIG.pro.className}`}
            >
              Pro
            </span>
            <h3 className="text-sm font-semibold text-gray-700">
              AI-Generated Fix Report
            </h3>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
              {run.fix_report_md}
            </pre>
          </div>
        </div>
      ) : !isPro ? (
        /* Starter upgrade CTA for fix report */
        <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 shrink-0 mt-0.5">
              <span className="text-xl" aria-hidden="true">
                🔧
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Get your full AI Fix Report
              </h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Pro includes an AI-generated Fix Report: concrete schema markup,
                content gaps, and entity-authority recommendations written
                specifically for your brand and top visibility gaps.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
