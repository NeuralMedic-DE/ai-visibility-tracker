# Dashboard States — /dashboard

**Task:** T-4013e5d5  
**Build:** `npm run build` ✅ passes (2026-05-29)  
**File:** `app/dashboard/page.tsx`  
**AutoRefresh component:** `components/AutoRefresh.tsx`

---

## State A — New user, zero tracked brands

**Trigger condition:** `customer` row exists, `tracked_brands` row is `null`

**Route rendering:** `AccountView` → `<EmptyState />`

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓ [brand-gradient accent bar] ▓▓▓▓▓▓▓  │
│                                                      │
│  [ 🎯 ]  ← rounded-2xl icon box, bg-brand-50        │
│                                                      │
│  Add your brand to start tracking                   │
│  (text-xl font-bold text-gray-900)                  │
│                                                      │
│  Find out exactly where your brand appears — or     │
│  doesn't — when buyers search AI tools like         │
│  ChatGPT, Claude, and Perplexity. Setup <2 min.    │
│                                                      │
│  ✅ 25 buyer-intent prompts across 4 AI platforms   │
│  ✅ AVS benchmarked against 100 B2B SaaS brands     │
│  ✅ Top 3 gap prompts with concrete fixes           │
│  ✅ Weekly automated re-scoring                     │
│                                                      │
│  [ Add your brand to start tracking → ]             │
│  (bg-brand-600, shadow-sm, arrow icon)              │
│                                                      │
│  Setup takes under 2 minutes · First scan ~10 min   │
└─────────────────────────────────────────────────────┘
```

**CTA target:** `/dashboard/onboarding`

**Key design decisions:**
- Brand-coloured top accent gradient strip draws the eye
- Feature bullet list answers "what do I get?" before the CTA
- Sub-caption sets time expectations so user commits

---

## State B — Brand saved, scoring not yet complete

**Trigger condition:** `tracked_brands` row exists, `customer_scoring_runs` latest row is `null`

**Route rendering:** `AccountView` → `<GeneratingState brandName="..." />`

**Includes:** `<AutoRefresh intervalMs={30000} />` — calls `router.refresh()` every 30 s to pick up completed run without user action.

### Layout

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│        ◎  ← pulsing rings + spinning SVG            │
│       [⚙️]   (animate-ping + animate-spin)          │
│                                                      │
│  Your first report is generating                    │
│  (text-xl font-bold)                                │
│                                                      │
│  Usually 6–12 minutes. We're querying ChatGPT,      │
│  Claude, Perplexity, and Google AI Overviews        │
│  using 25 buyer-intent prompts for {brandName}.     │
│                                                      │
│  We'll email you when it's ready.                   │
│                                                      │
│  ┌ Progress steps ──────────────────────────────┐   │
│  │ ✅ Generating 25 prompts          (done)      │   │
│  │ ✅ Querying 4 AI platforms        (done)      │   │
│  │ 🔵 Scoring mentions & gaps       (pulsing)   │   │
│  │ 🔵 Building your report          (pulsing)   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Checking for results — refreshing in 28s           │
│  (AutoRefresh countdown)                            │
│                                                      │
│  ─────────────────────────────────────────────────  │
│  Scan not triggered yet?                            │
│  Trigger scan manually →                            │
│  (link to /dashboard/run-now)                       │
└─────────────────────────────────────────────────────┘
```

**Auto-refresh:** `components/AutoRefresh.tsx` — client component, uses `useRouter().refresh()` on a 30 s interval. Displays live countdown so user knows the page is alive. Resets to 30 s after each refresh.

**Fallback link:** `/dashboard/run-now` handles the edge case where user saved their brand but closed the tab before the auto-trigger completed.

---

## State C — Scoring complete, results available

**Trigger condition:** `customer_scoring_runs` row exists

**Route rendering:** `AccountView` → `<ScoringResults brand run indexRank isPro />`

**Server-side rank computation:** `computeIndexRank(avs)` reads all `data/brands/*.json` (100 files), counts brands with `avs_brand > customer_avs`, returns `{ rank, total }`.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  CARD 1: Score + Rank                               │
│  ─────────────────────────────────────────────────  │
│  {BrandName}            52.4         ← text-4xl     │
│  acmecorp.com           / 100 AVS       font-extrabold
│                         Moderate     ← avsLabel     │
│                         23rd of 100  ← ordinal rank │
│                                                      │
│  Rank vs AI Visibility Index                        │
│  [████████████░░░░░░░░░░] #23 / 100  ← rank bar    │
│  Above median — room to improve                     │
│                                                      │
│  Run on May 30, 2026 · 25 prompts × 3 AI models    │
│                                                      │
│  Per-AI Score:                                      │
│  ChatGPT    [████████████░░░░░] 54.3               │
│  Claude     [██████████░░░░░░░] 49.1               │
│  Perplexity [██████████████░░░] 62.8               │
│                                                      │
│  [📅 Next report in 6 days    ·  Weekly · automated]│
│                                                      │
│  [Re-run scan now]  [Edit brand]                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CARD 2: Top 3 Visibility Gaps + Fixes              │
│  ─────────────────────────────────────────────────  │
│  Top Visibility Gaps                                │
│  Prompts where AI models didn't mention {Brand}    │
│  — with actionable fixes                            │
│                                                      │
│  ┌ Gap #1 ──────────────────────────────────────┐  │
│  │ [1] "Best way to segment contacts..."        │  │
│  │     [use case] [missed by Claude]            │  │
│  │     [missed by Perplexity]                   │  │
│  │ ─────────────────────────────────────────── │  │
│  │ Why it matters: Use-case prompts reach       │  │
│  │   buyers at the exact moment they need       │  │
│  │   your solution...                           │  │
│  │ 🔧 Fix: Create or expand a dedicated        │  │
│  │   use-case page with concrete outcomes,      │  │
│  │   customer stories, and FAQPage schema.      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌ Gap #2 ──────────────────────────────────────┐  │
│  │ [2] "Top category tools in 2025..."          │  │
│  │     [category discovery] [missed by Claude]  │  │
│  │ ─────────────────────────────────────────── │  │
│  │ Why it matters: Discovery queries drive      │  │
│  │   early-funnel awareness...                  │  │
│  │ 🔧 Fix: Publish a comprehensive category    │  │
│  │   guide establishing topical authority...    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌ Gap #3 ──────────────────────────────────────┐  │
│  │ [3] "Cheaper alternatives to HubSpot"       │  │
│  │     [alternatives] [missed by ChatGPT]       │  │
│  │ ─────────────────────────────────────────── │  │
│  │ Why it matters: Alternative searches         │  │
│  │   capture switching-intent demand...         │  │
│  │ 🔧 Fix: Build a '{Brand} vs {Competitor}'   │  │
│  │   page with factual, structured comparisons. │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CARD 3a (Pro): AI-Generated Fix Report             │
│  ─────────────────────────────────────────────────  │
│  [Pro badge] AI-Generated Fix Report                │
│  ┌ monospace pre block ──────────────────────────┐  │
│  │ ## Overall Assessment                         │  │
│  │ ...                                           │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CARD 3b (Starter): Upgrade CTA                    │
│  ─────────────────────────────────────────────────  │
│  [🔧] Get your full AI Fix Report                   │
│       Pro includes concrete schema markup,          │
│       content gaps, and entity-authority recs       │
│       written specifically for your brand.          │
│  [Upgrade to Pro]                                   │
└─────────────────────────────────────────────────────┘
```

**Index rank bar logic:**
- Width % = `((total - rank + 1) / total) * 100` → higher rank = wider bar
- Colour: green ≥60, yellow ≥35, red <35 (matches AVS colour scheme)
- Quartile label: top quarter → "Top quartile", etc.

**Gap prompt "why it matters":**
- Uses `gap.why_it_matters` from JSONB if present (brand JSON imports)
- Falls back to `GAP_CONTEXT[category].why` constant for scorer-generated runs
- Fix suggestion always from `GAP_CONTEXT[category].fix` (category-specific advice)

**Next report indicator:**
- `run_date + 7 days` → days until next weekly re-score
- Shows "today", "tomorrow", or "in N days"

---

## Data flow summary

```
DashboardPage (server)
  ├── supabase.auth.getUser()         → session guard
  ├── admin.from('customers')         → subscription status
  ├── admin.from('tracked_brands')    → brand config
  ├── admin.from('customer_scoring_runs') → latest results
  └── computeIndexRank(avs)           → fs.readdir data/brands/
        ↓
  AccountView
    ├── !trackedBrand     → EmptyState
    ├── !latestRun        → GeneratingState + AutoRefresh (client)
    └── latestRun         → ScoringResults
          ├── AVS + rank bar
          ├── per-LLM bars
          ├── next-report indicator
          ├── top 3 gap prompts + why/fix
          └── fix_report_md (Pro) or upgrade CTA (Starter)
```

---

## Build output

```
Route: ƒ /dashboard   890 B   159 kB First Load JS
✓ Compiled successfully (2026-05-29)
```

No TypeScript errors, no lint warnings.
