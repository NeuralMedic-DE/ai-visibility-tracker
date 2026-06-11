/**
 * lib/scorer.ts
 *
 * TypeScript per-customer scoring engine — Vercel-compatible.
 * Replaces scorer/run_for_customer.py + scorer/scorer.py on the Node.js side.
 *
 * Uses native fetch() for all LLM API calls — no extra npm packages required.
 * No child_process, no Python subprocess, no file-system dependencies.
 *
 * Entry point:  scoreForCustomer(customerId, supabaseAdminClient)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandProfile {
  brand: string;
  url: string;
  category: string;
  categoryLong: string;
  segment: string;
  competitor1: string;
  competitor2: string;
  useCase1: string;
  useCase2: string;
  integration1: string;
  integration2: string;
  role: string;
  aliases: string[];
}

type RankValue = number | "unranked" | "na" | null;
type Sentiment = "positive" | "neutral" | "negative";

export interface PromptResult {
  promptId: string;
  promptText: string;
  promptCategory: string;
  presence: boolean;
  rank: RankValue;
  sentiment: Sentiment;
  hasLink: boolean;
  score: number;
  error?: string;
}

export interface LLMScore {
  llmKey: string;
  model: string;
  label: string;
  avs: number;
  avsRaw: number;
  promptResults: PromptResult[];
  promptsScored: number;
  promptsSkipped: number;
}

export interface BrandScore {
  brand: string;
  url: string;
  runDate: string;
  avsBrand: number;
  avsBrandRaw: number;
  llmScores: Record<string, LLMScore>;
}

export interface GapPrompt {
  promptId: string;
  promptText: string;
  category: string;
  llmsMissed: string[];
}

export interface AvsScoreResult {
  customerId: string;
  runDate: string;
  avsBrand: number;
  perLlm: Record<string, number>;
  gapPrompts: GapPrompt[];
  fixReportMd: string | null;
  promptCount: number;
  estimatedCostUsd: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_PROMPT_LIMITS: Record<string, number> = {
  starter: 25,
  pro: 100,
};

const ESTIMATED_RUN_COST: Record<string, number> = {
  starter: 0.5,
  pro: 2.0,
};

const LLM_CONFIGS: Record<string, { model: string; label: string }> = {
  openai: { model: "gpt-4o", label: "ChatGPT (GPT-4o)" },
  anthropic: { model: "claude-haiku-4-5-20251001", label: "Claude (Haiku 4.5)" },
  perplexity: { model: "sonar-pro", label: "Perplexity (sonar-pro)" },
  google: { model: "serpapi", label: "Google AI Overviews (SerpAPI)" },
};

// Per-provider concurrent request caps (mirrors Python PROVIDER_CONCURRENCY_CAPS)
const PROVIDER_CONCURRENCY_CAPS: Record<string, number> = {
  openai: 4,
  anthropic: 4,
  perplexity: 2,
  google: 2,
};

// Scoring rubric — mirrors scorer/config.py
const RANK_POINTS: Record<string | number, number> = {
  1: 6, 2: 5, 3: 4, 4: 3, 5: 2,
  unranked: 2,
  na: 3,
};

const SENTIMENT_ADJ: Record<string, number> = {
  positive: 2, neutral: 0, negative: -2,
};

// ─────────────────────────────────────────────────────────────────────────────
// 100 Prompt Templates (matches scorer/config.py PROMPT_TEMPLATES exactly)
// ─────────────────────────────────────────────────────────────────────────────

interface PromptTemplate {
  id: string;
  template: string;
  category: string;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  // (a) Category Discovery — 15 prompts
  { id: "CD-01", template: "What is the best {CATEGORY} for {SEGMENT}?", category: "category_discovery" },
  { id: "CD-02", template: "Top {CATEGORY_LONG} tools in 2025", category: "category_discovery" },
  { id: "CD-03", template: "Which {CATEGORY} software should a {ROLE} use?", category: "category_discovery" },
  { id: "CD-04", template: "Best {CATEGORY} platforms for {USE_CASE_1}", category: "category_discovery" },
  { id: "CD-05", template: "Recommended {CATEGORY} tools for {SEGMENT} companies", category: "category_discovery" },
  { id: "CD-06", template: "What {CATEGORY} tool do {SEGMENT} teams love most?", category: "category_discovery" },
  { id: "CD-07", template: "Best {CATEGORY} software for {ROLE}s at {SEGMENT} companies", category: "category_discovery" },
  { id: "CD-08", template: "Top-rated {CATEGORY_LONG} tools recommended by {ROLE}s", category: "category_discovery" },
  { id: "CD-09", template: "What are the most popular {CATEGORY} solutions right now?", category: "category_discovery" },
  { id: "CD-10", template: "Which {CATEGORY} platform is easiest to set up for {SEGMENT}?", category: "category_discovery" },
  { id: "CD-11", template: "Best enterprise-grade {CATEGORY} for large {SEGMENT} teams", category: "category_discovery" },
  { id: "CD-12", template: "What {CATEGORY} software should a growing {SEGMENT} startup use?", category: "category_discovery" },
  { id: "CD-13", template: "{CATEGORY} tools with the best user reviews and ratings", category: "category_discovery" },
  { id: "CD-14", template: "Which {CATEGORY} has the shortest learning curve for {SEGMENT} teams?", category: "category_discovery" },
  { id: "CD-15", template: "How do I find the right {CATEGORY_LONG} for my {SEGMENT} team?", category: "category_discovery" },

  // (b) Comparison — 15 prompts
  { id: "CM-01", template: "{BRAND} vs {COMPETITOR_1}: which is better?", category: "comparison" },
  { id: "CM-02", template: "{BRAND} vs {COMPETITOR_2} pricing and features", category: "comparison" },
  { id: "CM-03", template: "{BRAND} vs {COMPETITOR_1} for {SEGMENT}", category: "comparison" },
  { id: "CM-04", template: "Compare {BRAND} and {COMPETITOR_1} for {USE_CASE_1}", category: "comparison" },
  { id: "CM-05", template: "Is {BRAND} better than {COMPETITOR_2} for {USE_CASE_2}?", category: "comparison" },
  { id: "CM-06", template: "{BRAND} or {COMPETITOR_1}: which is easier to get started with?", category: "comparison" },
  { id: "CM-07", template: "What is the main difference between {BRAND} and {COMPETITOR_1}?", category: "comparison" },
  { id: "CM-08", template: "{BRAND} pros and cons vs {COMPETITOR_2}", category: "comparison" },
  { id: "CM-09", template: "How does {BRAND} stack up against {COMPETITOR_1} for a {ROLE}?", category: "comparison" },
  { id: "CM-10", template: "Which is more affordable: {BRAND} or {COMPETITOR_1}?", category: "comparison" },
  { id: "CM-11", template: "{BRAND} vs {COMPETITOR_1} — which has better customer support?", category: "comparison" },
  { id: "CM-12", template: "Is {BRAND} or {COMPETITOR_2} the better fit for {SEGMENT} teams?", category: "comparison" },
  { id: "CM-13", template: "{BRAND} vs {COMPETITOR_1}: which integrates better with {INTEGRATION_1}?", category: "comparison" },
  { id: "CM-14", template: "Why should I pick {BRAND} over {COMPETITOR_1}?", category: "comparison" },
  { id: "CM-15", template: "{BRAND} vs {COMPETITOR_2} — honest reviews from {SEGMENT} founders", category: "comparison" },

  // (c) Alternatives — 15 prompts
  { id: "AL-01", template: "Alternatives to {COMPETITOR_1} for {SEGMENT}", category: "alternatives" },
  { id: "AL-02", template: "Cheaper alternatives to {COMPETITOR_2}", category: "alternatives" },
  { id: "AL-03", template: "Best {CATEGORY} alternatives for {SEGMENT} teams on a budget", category: "alternatives" },
  { id: "AL-04", template: "{COMPETITOR_1} vs alternatives: what should I switch to?", category: "alternatives" },
  { id: "AL-05", template: "Open source or affordable {CATEGORY} tools instead of {COMPETITOR_2}", category: "alternatives" },
  { id: "AL-06", template: "What can I use instead of {BRAND} when scaling up?", category: "alternatives" },
  { id: "AL-07", template: "Free or low-cost alternatives to {COMPETITOR_1} for {SEGMENT} startups", category: "alternatives" },
  { id: "AL-08", template: "Tools similar to {BRAND} but more affordable", category: "alternatives" },
  { id: "AL-09", template: "Best {CATEGORY} alternatives for a {ROLE}", category: "alternatives" },
  { id: "AL-10", template: "What {CATEGORY} tool should I migrate to from {COMPETITOR_2}?", category: "alternatives" },
  { id: "AL-11", template: "Which {CATEGORY} is best for small {SEGMENT} teams as a {COMPETITOR_1} replacement?", category: "alternatives" },
  { id: "AL-12", template: "Are there alternatives to {BRAND} that are better for {USE_CASE_1}?", category: "alternatives" },
  { id: "AL-13", template: "What {CATEGORY} tools have better {INTEGRATION_1} support than {COMPETITOR_2}?", category: "alternatives" },
  { id: "AL-14", template: "What do teams switch to after leaving {COMPETITOR_2}?", category: "alternatives" },
  { id: "AL-15", template: "{BRAND} alternatives that offer a free trial or generous free tier", category: "alternatives" },

  // (d) Use-Case — 15 prompts
  { id: "UC-01", template: "How do I {USE_CASE_1} without spending a lot on software?", category: "use_case" },
  { id: "UC-02", template: "Best way to {USE_CASE_2} for a {SEGMENT} team", category: "use_case" },
  { id: "UC-03", template: "What tools do {SEGMENT} companies use to {USE_CASE_1}?", category: "use_case" },
  { id: "UC-04", template: "How can a {ROLE} {USE_CASE_1} more efficiently?", category: "use_case" },
  { id: "UC-05", template: "What software helps with {USE_CASE_2} at scale?", category: "use_case" },
  { id: "UC-06", template: "Best way to {USE_CASE_2} without hiring extra staff?", category: "use_case" },
  { id: "UC-07", template: "Which tool helps a {ROLE} {USE_CASE_1} without deep technical knowledge?", category: "use_case" },
  { id: "UC-08", template: "How do early-stage {SEGMENT} startups handle {USE_CASE_1}?", category: "use_case" },
  { id: "UC-09", template: "Best practices for {USE_CASE_2} at a {SEGMENT} company", category: "use_case" },
  { id: "UC-10", template: "I need to {USE_CASE_1} as a {ROLE} — what do you recommend?", category: "use_case" },
  { id: "UC-11", template: "What is the fastest way for a {ROLE} to {USE_CASE_2}?", category: "use_case" },
  { id: "UC-12", template: "Top {CATEGORY} tools for {USE_CASE_1} used by {SEGMENT} companies", category: "use_case" },
  { id: "UC-13", template: "How can I automate {USE_CASE_1} at my {SEGMENT} business?", category: "use_case" },
  { id: "UC-14", template: "What software do successful {SEGMENT} companies use for {USE_CASE_2}?", category: "use_case" },
  { id: "UC-15", template: "Best tools for {USE_CASE_1} that work for a remote {SEGMENT} team", category: "use_case" },

  // (e) Integration — 15 prompts
  { id: "IN-01", template: "Does {BRAND} integrate with {INTEGRATION_1}?", category: "integration" },
  { id: "IN-02", template: "{BRAND} {INTEGRATION_2} integration: how does it work?", category: "integration" },
  { id: "IN-03", template: "How do I connect {BRAND} with {INTEGRATION_1}?", category: "integration" },
  { id: "IN-04", template: "Best {CATEGORY} that works with {INTEGRATION_1} and {INTEGRATION_2}", category: "integration" },
  { id: "IN-05", template: "{CATEGORY} tools with native {INTEGRATION_1} integration", category: "integration" },
  { id: "IN-06", template: "Best {CATEGORY} tools with native {INTEGRATION_2} support", category: "integration" },
  { id: "IN-07", template: "Does {BRAND} integrate with {INTEGRATION_2}?", category: "integration" },
  { id: "IN-08", template: "How do I set up {BRAND} to sync with {INTEGRATION_1}?", category: "integration" },
  { id: "IN-09", template: "{CATEGORY} software that works with both {INTEGRATION_1} and {INTEGRATION_2}", category: "integration" },
  { id: "IN-10", template: "Which {CATEGORY} has the deepest {INTEGRATION_1} integration for {SEGMENT}?", category: "integration" },
  { id: "IN-11", template: "Can {BRAND} connect to {INTEGRATION_2} without a third-party connector?", category: "integration" },
  { id: "IN-12", template: "{CATEGORY} platforms with a certified {INTEGRATION_2} integration", category: "integration" },
  { id: "IN-13", template: "Is the {BRAND} {INTEGRATION_1} integration reliable?", category: "integration" },
  { id: "IN-14", template: "Best {CATEGORY} for teams already relying on {INTEGRATION_1}", category: "integration" },
  { id: "IN-15", template: "{BRAND} {INTEGRATION_1} integration: step-by-step setup guide", category: "integration" },

  // (f) Pain / Problem — 10 prompts
  { id: "PP-01", template: "What is the biggest challenge {SEGMENT} teams face with {CATEGORY} today?", category: "pain_problem" },
  { id: "PP-02", template: "How do {ROLE}s solve {USE_CASE_1} when their current tool is too slow?", category: "pain_problem" },
  { id: "PP-03", template: "Why do {SEGMENT} companies struggle with {CATEGORY} adoption?", category: "pain_problem" },
  { id: "PP-04", template: "What problems does {BRAND} solve for {SEGMENT} companies?", category: "pain_problem" },
  { id: "PP-05", template: "My team is frustrated with {COMPETITOR_1} — what should we switch to?", category: "pain_problem" },
  { id: "PP-06", template: "What causes {SEGMENT} startups to abandon their {CATEGORY} tool?", category: "pain_problem" },
  { id: "PP-07", template: "How do I convince my {SEGMENT} team to adopt a new {CATEGORY} platform?", category: "pain_problem" },
  { id: "PP-08", template: "What are the hidden costs of choosing the wrong {CATEGORY} for {SEGMENT}?", category: "pain_problem" },
  { id: "PP-09", template: "Why is {USE_CASE_1} still so difficult for {SEGMENT} teams?", category: "pain_problem" },
  { id: "PP-10", template: "Common mistakes when choosing a {CATEGORY_LONG} for {SEGMENT}", category: "pain_problem" },

  // (g) Pricing / Value — 10 prompts
  { id: "PV-01", template: "How much does {BRAND} cost for a {SEGMENT} team?", category: "pricing_value" },
  { id: "PV-02", template: "Is {BRAND} worth the price for {SEGMENT} startups?", category: "pricing_value" },
  { id: "PV-03", template: "What is the ROI of using {BRAND} for {USE_CASE_1}?", category: "pricing_value" },
  { id: "PV-04", template: "How does {BRAND} pricing compare to {COMPETITOR_1}?", category: "pricing_value" },
  { id: "PV-05", template: "Can a small {SEGMENT} team afford {CATEGORY} software in 2025?", category: "pricing_value" },
  { id: "PV-06", template: "What is the total cost of ownership for {CATEGORY} tools like {BRAND}?", category: "pricing_value" },
  { id: "PV-07", template: "Does {BRAND} offer a free trial or free tier?", category: "pricing_value" },
  { id: "PV-08", template: "Is it worth switching from {COMPETITOR_1} to {BRAND} given the cost difference?", category: "pricing_value" },
  { id: "PV-09", template: "How do {SEGMENT} companies justify {CATEGORY} software spend?", category: "pricing_value" },
  { id: "PV-10", template: "What {CATEGORY} tool gives the best value for money in 2025?", category: "pricing_value" },

  // (h) Reputation / Social Proof — 5 prompts
  { id: "RE-01", template: "What do customers say about {BRAND}?", category: "reputation" },
  { id: "RE-02", template: "Is {BRAND} a reliable tool for {SEGMENT} companies?", category: "reputation" },
  { id: "RE-03", template: "{BRAND} reviews from {ROLE}s — is it worth it?", category: "reputation" },
  { id: "RE-04", template: "What G2 or Capterra ratings does {BRAND} have?", category: "reputation" },
  { id: "RE-05", template: "Is {BRAND} trusted by enterprise {SEGMENT} teams?", category: "reputation" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Minimal async semaphore for concurrency control. */
class AsyncSemaphore {
  private permits: number;
  private readonly queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = Math.max(1, permits);
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  async use<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand Profile helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a BrandProfile from a tracked_brands DB row.
 * Mirrors scorer/run_for_customer.py _build_brand_profile()
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildBrandProfileFromRow(tb: Record<string, any>): BrandProfile {
  const brandName: string = tb.brand_name ?? "";
  const brandUrl: string = tb.brand_url ?? "";
  const competitors: Array<{ name?: string; url?: string }> = tb.competitors ?? [];

  const category: string = tb.category ?? "SaaS tool";
  const categoryLower = category.toLowerCase();
  const categoryLong: string =
    categoryLower.includes("software") || categoryLower.includes("tool")
      ? category
      : `${category} software`;

  const segment: string = tb.segment ?? "B2B SaaS companies";

  const compNames = competitors
    .map((c) => c.name ?? "")
    .filter(Boolean);
  const competitor1 = compNames[0] ?? "leading vendors";
  const competitor2 = compNames[1] ?? "established alternatives";

  const useCase1: string = tb.use_case_1 ?? `manage ${categoryLower} workflows`;
  const useCase2: string = tb.use_case_2 ?? "scale operations efficiently";
  const integration1: string = tb.integration_1 ?? "Slack";
  const integration2: string = tb.integration_2 ?? "HubSpot";
  const role: string = tb.role_title ?? "head of growth";

  return {
    brand: brandName,
    url: brandUrl,
    category,
    categoryLong,
    segment,
    competitor1,
    competitor2,
    useCase1,
    useCase2,
    integration1,
    integration2,
    role,
    aliases: [],
  };
}

/**
 * All brand name variants used for mention detection.
 * Mirrors BrandProfile.all_names() in scorer/models.py
 */
export function buildBrandAllNames(brand: BrandProfile): string[] {
  const names: string[] = [brand.brand, ...brand.aliases];

  let rawUrl = brand.url.toLowerCase();
  for (const prefix of [
    "https://www.",
    "https://",
    "http://www.",
    "http://",
    "www.",
  ]) {
    if (rawUrl.startsWith(prefix)) {
      rawUrl = rawUrl.slice(prefix.length);
      break;
    }
  }

  const domainFull = rawUrl.split("/")[0]; // e.g. "render.com"
  const domainBare = domainFull.split(".")[0]; // e.g. "render"

  const nameLowers = names.map((n) => n.toLowerCase());
  if (!nameLowers.includes(domainBare)) names.push(domainBare);
  if (!names.map((n) => n.toLowerCase()).includes(domainFull)) {
    names.push(domainFull);
  }

  // Dedup, preserve insertion order
  return Array.from(new Set(names));
}

function templateVars(brand: BrandProfile): Record<string, string> {
  return {
    BRAND: brand.brand,
    CATEGORY: brand.category,
    CATEGORY_LONG: brand.categoryLong,
    SEGMENT: brand.segment,
    COMPETITOR_1: brand.competitor1,
    COMPETITOR_2: brand.competitor2,
    USE_CASE_1: brand.useCase1,
    USE_CASE_2: brand.useCase2,
    INTEGRATION_1: brand.integration1,
    INTEGRATION_2: brand.integration2,
    ROLE: brand.role,
  };
}

function renderPrompts(
  brand: BrandProfile,
  limit?: number
): Array<[string, string, string]> {
  const templates = limit ? PROMPT_TEMPLATES.slice(0, limit) : PROMPT_TEMPLATES;
  const vars = templateVars(brand);
  return templates.map((tpl) => {
    let text = tpl.template;
    for (const [key, val] of Object.entries(vars)) {
      text = text.split(`{${key}}`).join(val);
    }
    return [tpl.id, text, tpl.category];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser — ported from scorer/parser.py
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambiguous brand tokens that are also common English words/verbs.
 * For these, detectPresence() requires a case-sensitive capitalised match first.
 */
const AMBIGUOUS_BRAND_TOKENS = new Set([
  "Close",
  "Render",
  "Folk",
  "Linear",
  "Sentry",
]);

/**
 * Cloud platform names used for the platform-adjacency secondary check on
 * ambiguous tokens (e.g. "heroku, render, fly.io" → "render" is the brand).
 */
const CLOUD_PLATFORM_ADJACENT = [
  "fly.io",
  "heroku",
  "vercel",
  "netlify",
  "digitalocean",
  "render.com",
  "render cloud",
  "railway.app",
  "cloudflare",
  "kubernetes",
  "dockerfile",
];

const LIST_SEP = "[\\s,/|•*\\-]+";

function lowercaseInPlatformList(
  responseLower: string,
  nameLower: string
): boolean {
  const nameEsc = escapeRegex(nameLower);
  for (const platform of CLOUD_PLATFORM_ADJACENT) {
    const platEsc = escapeRegex(platform);
    // platform … name
    if (
      new RegExp(platEsc + LIST_SEP + nameEsc + "(?![a-zA-Z0-9])").test(
        responseLower
      )
    )
      return true;
    // name … platform
    if (
      new RegExp(
        "(?<![a-zA-Z0-9])" + nameEsc + LIST_SEP + platEsc
      ).test(responseLower)
    )
      return true;
  }
  return false;
}

/** Return true if any brand name appears in the LLM response. */
export function detectPresence(
  response: string,
  brandNames: string[]
): boolean {
  const respLower = response.toLowerCase();
  for (const name of brandNames) {
    if (AMBIGUOUS_BRAND_TOKENS.has(name)) {
      // Primary: exact capitalised match
      if (
        new RegExp(
          "(?<![a-zA-Z0-9])" + escapeRegex(name) + "(?![a-zA-Z0-9])"
        ).test(response)
      )
        return true;
      // Secondary: platform-adjacency context
      if (lowercaseInPlatformList(respLower, name.toLowerCase())) return true;
    } else {
      // General: case-insensitive word-boundary match
      if (
        new RegExp(
          "(?<![a-zA-Z0-9])" +
            escapeRegex(name.toLowerCase()) +
            "(?![a-zA-Z0-9])",
          "i"
        ).test(respLower)
      )
        return true;
    }
  }
  return false;
}

/**
 * Scan numbered / bulleted list items for a brand mention.
 * Returns 1-based rank if found, null otherwise.
 */
function findBrandInListItems(
  response: string,
  brandNames: string[]
): number | null {
  const lines = response.split("\n");
  let rank = 0;
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) continue;
    const hasLeadingWhitespace =
      line.length > 0 && (line[0] === " " || line[0] === "\t");
    const numberedMatch = /^(?:\(?\d+\)?[-.\): ]?\s+)/.test(stripped);
    const bulletMatch = /^[-*•▪]\s+/.test(stripped);
    // Skip indented bullet sub-items (Bug A fix)
    if (hasLeadingWhitespace && bulletMatch && !numberedMatch) continue;
    if (numberedMatch || bulletMatch) {
      rank++;
      const lineLower = stripped.toLowerCase();
      for (const name of brandNames) {
        if (
          new RegExp(
            "(?<![a-zA-Z0-9])" +
              escapeRegex(name.toLowerCase()) +
              "(?![a-zA-Z0-9])"
          ).test(lineLower)
        )
          return rank;
      }
    }
  }
  return null;
}

/**
 * Detect if the brand clearly "wins" a CM- comparison prompt response.
 * Returns true if the brand is the recommended option.
 */
function detectCmWinner(response: string, brandNames: string[]): boolean {
  const respLower = response.toLowerCase();
  for (const name of brandNames) {
    const brandEsc = escapeRegex(name.toLowerCase());

    // Pattern 1: "[brand] … wins / is best / …"
    if (
      new RegExp(
        "(?<![a-zA-Z0-9])" +
          brandEsc +
          "(?![a-zA-Z0-9])[\\s\\w,\\.]{0,50}" +
          "(?:wins|winner|is best|comes out ahead|is the better choice|wins out|is the clear choice|is the winner)"
      ).test(respLower)
    )
      return true;

    // Pattern 2: "go with / choose / pick / recommend / opt for [brand]"
    if (
      new RegExp(
        "(?:go with|choose|pick|recommend|opt for)\\s+[\\w\\s]{0,20}" +
          "(?<![a-zA-Z0-9])" +
          brandEsc +
          "(?![a-zA-Z0-9])"
      ).test(respLower)
    )
      return true;

    // Pattern 3: verdict / recommendation section
    const verdictMatches = Array.from(
      respLower.matchAll(
        /(?:verdict|winner|recommendation|bottom line|our pick)\s*[:\-]\s*([^\n]{0,300})/g
      )
    );
    for (const m of verdictMatches) {
      if (
        new RegExp(
          "(?<![a-zA-Z0-9])" + brandEsc + "(?![a-zA-Z0-9])"
        ).test(m[1])
      )
        return true;
    }
  }
  return false;
}

/**
 * Determine rank signal: int (1-based), "unranked", "na", or null.
 * Mirrors scorer/parser.py extract_rank()
 */
export function extractRank(
  response: string,
  brandNames: string[],
  promptId: string,
  presence: boolean
): RankValue {
  if (!presence) return null;

  const rankInList = findBrandInListItems(response, brandNames);
  if (rankInList !== null) return rankInList;

  const promptPrefix = promptId.substring(0, 3).toUpperCase();
  const isDirectAnswerPrompt = promptPrefix === "IN-" || promptPrefix === "UC-";

  const respStripped = response.trim();
  const startsWithDirect = /^(yes|no|absolutely|certainly|indeed)[,. ]/i.test(
    respStripped
  );

  if (isDirectAnswerPrompt) {
    const first200 = respStripped.substring(0, 200).toLowerCase();
    const brandInFirst200 = brandNames.some((n) =>
      new RegExp(
        "(?<![a-zA-Z0-9])" +
          escapeRegex(n.toLowerCase()) +
          "(?![a-zA-Z0-9])"
      ).test(first200)
    );
    if (startsWithDirect || respStripped.length < 400 || brandInFirst200)
      return "na";
  }

  if (promptPrefix === "CM-") {
    if (detectCmWinner(response, brandNames)) return "na";
  }

  return "unranked";
}

/**
 * Return true if a URL pointing to the brand's domain appears in the response.
 * Mirrors scorer/parser.py detect_link()
 */
export function detectLink(response: string, brandUrl: string): boolean {
  let domain = brandUrl.toLowerCase();
  for (const prefix of [
    "https://www.",
    "https://",
    "http://www.",
    "http://",
    "www.",
  ]) {
    if (domain.startsWith(prefix)) {
      domain = domain.slice(prefix.length);
      break;
    }
  }
  domain = domain.split("/")[0];

  const urlPattern = new RegExp(
    "https?://(?:www\\.)?" +
      escapeRegex(domain) +
      "(?:[/\\w.%?=#&@-]*)?",
    "i"
  );
  if (urlPattern.test(response)) return true;

  const barePattern = new RegExp("\\[?" + escapeRegex(domain) + "\\]?", "i");
  return barePattern.test(response);
}

/**
 * Keyword-based sentiment heuristic.
 * Mirrors scorer/scorer.py _keyword_sentiment()
 */
export function keywordSentiment(response: string, brand: string): Sentiment {
  const brandLower = brand.toLowerCase();
  const sentences = response.split(/(?<=[.!?])\s+/);
  const relevant = sentences.filter((s) => s.toLowerCase().includes(brandLower));
  if (relevant.length === 0) return "neutral";

  const text = relevant.join(" ").toLowerCase();

  const positiveWords = [
    "best", "great", "excellent", "recommend", "winner", "top", "ideal",
    "perfect", "powerful", "loved", "popular", "praised", "fast", "easy",
    "wins", "built for", "purpose-built", "native", "seamless",
  ];
  const negativeWords = [
    "worst", "avoid", "expensive", "legacy", "limited", "poor", "bad",
    "costly", "complex", "outdated", "cancelled", "problematic", "overpriced",
  ];

  const posCount = positiveWords.filter((w) => text.includes(w)).length;
  const negCount = negativeWords.filter((w) => text.includes(w)).length;

  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

/**
 * Apply the scoring rubric and return a 0–10 score.
 * Mirrors scorer/parser.py compute_score()
 */
export function computeScore(
  presence: boolean,
  rank: RankValue,
  sentiment: Sentiment,
  hasLink: boolean
): number {
  if (!presence) return 0;

  let base = 0;
  if (rank === null) {
    base = 0;
  } else if (rank === "unranked") {
    base = RANK_POINTS["unranked"];
  } else if (rank === "na") {
    base = RANK_POINTS["na"];
  } else if (typeof rank === "number") {
    base = rank <= 5 ? (RANK_POINTS[rank] ?? 1) : 1;
  }

  const adj = (SENTIMENT_ADJ[sentiment] ?? 0) + (hasLink ? 1 : 0);
  return Math.max(0, Math.min(10, base + adj));
}

/**
 * Parse a raw LLM response into a PromptResult.
 */
function parseResponse(
  rawResponse: string,
  llmKey: string,
  promptId: string,
  promptText: string,
  promptCategory: string,
  brand: BrandProfile,
  brandNames: string[]
): PromptResult {
  // Google-specific: no AI overview sentinel
  if (llmKey === "google" && rawResponse === "NO_AI_OVERVIEW") {
    return {
      promptId,
      promptText,
      promptCategory,
      presence: false,
      rank: null,
      sentiment: "neutral",
      hasLink: false,
      score: 0,
      error: "no_ai_overview",
    };
  }

  const presence = detectPresence(rawResponse, brandNames);
  const rank = extractRank(rawResponse, brandNames, promptId, presence);
  const hasLink = detectLink(rawResponse, brand.url);
  const sentiment = presence ? keywordSentiment(rawResponse, brand.brand) : "neutral";
  const score = computeScore(presence, rank, sentiment, hasLink);

  return {
    promptId,
    promptText,
    promptCategory,
    presence,
    rank,
    sentiment,
    hasLink,
    score,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM Clients — fetch-based, no extra npm packages required
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function queryOpenAI(
  promptText: string,
  model = "gpt-4o"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Answer the user's question clearly and concisely, as you normally would.",
          },
          { role: "user", content: promptText },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    },
    90_000
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function queryAnthropic(
  promptText: string,
  model = "claude-haiku-4-5-20251001",
  systemPrompt?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const body: Record<string, unknown> = {
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: promptText }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    60_000
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ text?: string }>;
  };
  return data.content?.[0]?.text ?? "";
}

async function queryPerplexity(
  promptText: string,
  model = "sonar-pro"
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const res = await fetchWithTimeout(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Be precise and concise." },
          { role: "user", content: promptText },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    },
    90_000
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Perplexity API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function queryGoogle(searchQuery: string): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set");

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google",
    q: searchQuery,
    gl: "us",
    hl: "en",
    num: "10",
  });

  const res = await fetchWithTimeout(
    `https://serpapi.com/search?${params}`,
    {},
    30_000
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SerpAPI ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const aiOverview =
    data.ai_overview ??
    (data.answer_box as Record<string, unknown> | undefined)?.snippet ??
    null;

  if (!aiOverview) return "NO_AI_OVERVIEW";

  if (
    typeof aiOverview === "object" &&
    Array.isArray((aiOverview as Record<string, unknown>).text_blocks)
  ) {
    const blocks = (aiOverview as Record<string, unknown>)
      .text_blocks as unknown[];
    const parts = blocks
      .map((b) => {
        if (typeof b === "string") return b;
        if (typeof b === "object" && b !== null) {
          const block = b as Record<string, unknown>;
          return String(block.snippet ?? block.text ?? "");
        }
        return "";
      })
      .filter(Boolean);
    return parts.join("\n") || "NO_AI_OVERVIEW";
  }

  return typeof aiOverview === "string" ? aiOverview : "NO_AI_OVERVIEW";
}

/**
 * Route a prompt to the appropriate LLM.
 */
async function queryLlm(llmKey: string, promptText: string): Promise<string> {
  const cfg = LLM_CONFIGS[llmKey];
  switch (llmKey) {
    case "openai":
      return queryOpenAI(promptText, cfg.model);
    case "anthropic":
      return queryAnthropic(promptText, cfg.model);
    case "perplexity":
      return queryPerplexity(promptText, cfg.model);
    case "google":
      return queryGoogle(promptText);
    default:
      throw new Error(`Unknown LLM key: ${llmKey}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Scorer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a brand across all configured LLMs (or a subset) in parallel.
 * Concurrency is bounded by per-provider semaphores.
 */
async function scoreBrand(
  brand: BrandProfile,
  runDate: string,
  promptLimit?: number,
  llms?: string[]
): Promise<BrandScore> {
  const targetLlms = llms ?? Object.keys(LLM_CONFIGS);
  const prompts = renderPrompts(brand, promptLimit);
  const brandNames = buildBrandAllNames(brand);

  // Filter to providers with available API keys to avoid hard failures
  const availableLlms = targetLlms.filter((llmKey) => {
    switch (llmKey) {
      case "openai":
        return !!process.env.OPENAI_API_KEY;
      case "anthropic":
        return !!process.env.ANTHROPIC_API_KEY;
      case "perplexity":
        return !!process.env.PERPLEXITY_API_KEY;
      case "google":
        return !!process.env.SERPAPI_KEY;
      default:
        return false;
    }
  });

  if (availableLlms.length === 0) {
    throw new Error(
      "No LLM API keys configured. Set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, SERPAPI_KEY"
    );
  }

  // Create per-provider semaphores
  const semaphores: Record<string, AsyncSemaphore> = {};
  for (const llmKey of availableLlms) {
    const cap = PROVIDER_CONCURRENCY_CAPS[llmKey] ?? 4;
    semaphores[llmKey] = new AsyncSemaphore(cap);
  }

  // Run all LLMs concurrently
  const llmEntries = await Promise.all(
    availableLlms.map(async (llmKey): Promise<[string, LLMScore]> => {
      const cfg = LLM_CONFIGS[llmKey];
      const sem = semaphores[llmKey];

      // Run all prompts for this LLM concurrently (gated by semaphore)
      const promptResults = await Promise.all(
        prompts.map(([promptId, promptText, promptCategory]) =>
          sem.use(async (): Promise<PromptResult> => {
            try {
              const rawResponse = await queryLlm(llmKey, promptText);
              return parseResponse(
                rawResponse,
                llmKey,
                promptId,
                promptText,
                promptCategory,
                brand,
                brandNames
              );
            } catch (err) {
              return {
                promptId,
                promptText,
                promptCategory,
                presence: false,
                rank: null,
                sentiment: "neutral",
                hasLink: false,
                score: 0,
                error: err instanceof Error ? err.message : String(err),
              };
            }
          })
        )
      );

      const scored = promptResults.filter((r) => !r.error);
      const avsRaw =
        scored.length > 0
          ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length
          : 0;
      const avs = avsRaw * 10;

      return [
        llmKey,
        {
          llmKey,
          model: cfg.model,
          label: cfg.label,
          avs,
          avsRaw,
          promptResults,
          promptsScored: scored.length,
          promptsSkipped: promptResults.length - scored.length,
        },
      ];
    })
  );

  const llmScores: Record<string, LLMScore> = Object.fromEntries(llmEntries);

  // Aggregate across LLMs (only count LLMs that scored at least one prompt)
  const validAvsRaw = Object.values(llmScores)
    .filter((s) => s.promptsScored > 0)
    .map((s) => s.avsRaw);
  const avsBrandRaw =
    validAvsRaw.length > 0
      ? validAvsRaw.reduce((a, b) => a + b, 0) / validAvsRaw.length
      : 0;
  const avsBrand = avsBrandRaw * 10;

  return {
    brand: brand.brand,
    url: brand.url,
    runDate,
    avsBrand,
    avsBrandRaw,
    llmScores,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gap Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the top 3 prompts where the brand had presence=false across the most LLMs.
 * Mirrors scorer/run_for_customer.py _extract_gap_prompts()
 */
export function extractGapPrompts(brandScore: BrandScore): GapPrompt[] {
  const gapMap = new Map<
    string,
    { promptId: string; promptText: string; category: string; llmsMissed: string[] }
  >();

  for (const [llmKey, llmScore] of Object.entries(brandScore.llmScores)) {
    for (const pr of llmScore.promptResults) {
      if (pr.error) continue;
      if (!pr.presence) {
        if (!gapMap.has(pr.promptId)) {
          gapMap.set(pr.promptId, {
            promptId: pr.promptId,
            promptText: pr.promptText,
            category: pr.promptCategory,
            llmsMissed: [],
          });
        }
        gapMap.get(pr.promptId)!.llmsMissed.push(llmKey);
      }
    }
  }

  return Array.from(gapMap.values())
    .sort((a, b) => {
      const diff = b.llmsMissed.length - a.llmsMissed.length;
      return diff !== 0 ? diff : a.promptId.localeCompare(b.promptId);
    })
    .slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix Report Generation (Pro tier)
// ─────────────────────────────────────────────────────────────────────────────

const FIX_REPORT_SYSTEM = `You are an AI visibility expert. Your job is to generate
a concrete, actionable fix report for a B2B SaaS brand that is missing from
AI search results on ChatGPT, Perplexity, Claude, and Google AI Overviews.

Focus on:
1. Structured data / schema.org markup (FAQPage, SoftwareApplication, Product)
2. Content gaps — what specific pages, blog posts, or docs are missing
3. Entity authority — Wikipedia presence, Wikidata, Crunchbase, G2 reviews
4. Prompt-specific recommendations for each gap prompt provided

Be specific, practical, and concise. Use markdown with ## headers and bullet lists.`;

async function generateFixReport(
  brandName: string,
  brandUrl: string,
  gapPrompts: GapPrompt[],
  avsBrand: number,
  perLlm: Record<string, number>
): Promise<string> {
  try {
    const gapLines = gapPrompts.map((g) => {
      const missed = g.llmsMissed.join(", ") || "all LLMs";
      return `- Prompt: "${g.promptText}" (category: ${g.category})\n  Missed by: ${missed}`;
    });
    const gapSummary =
      gapLines.length > 0
        ? gapLines.join("\n")
        : "No specific gaps identified.";

    const perLlmLines = Object.entries(perLlm)
      .map(([k, v]) => `  - ${k}: ${v.toFixed(1)}/100`)
      .join("\n");

    const userPrompt = `Brand: ${brandName}
Website: ${brandUrl}
Overall AI Visibility Score (AVS): ${avsBrand.toFixed(1)}/100

Per-LLM scores:
${perLlmLines}

Top gap prompts (where the brand was NOT mentioned):
${gapSummary}

Generate a focused Fix Report in markdown that explains exactly what this brand
should do to improve its AI search visibility. Structure it as:

## Overall Assessment
Brief 2-3 sentence summary of the visibility gap.

## Quick Wins (implement in 1-2 weeks)
3-5 specific, actionable items.

## Content & Entity Authority
What content to create and where to build citations.

## Prompt-Specific Fixes
For each gap prompt above, one concrete recommendation.

## Schema Markup
Specific schema.org types and properties to add.

Keep the total report under 500 words. Be direct and specific.`;

    return await queryAnthropic(
      userPrompt,
      "claude-haiku-4-5-20251001",
      FIX_REPORT_SYSTEM
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `*Fix report unavailable — generation error: ${msg}*`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

// The maximum number of prompts to run in a synchronous Vercel function context.
// At Pro plan (100 prompts), low-concurrency LLMs (perplexity/google cap=2) would
// take ~250s+ and risk hitting the 300s Vercel hard timeout.  Callers that run
// inline (onboarding, run-now) should pass this as promptLimitOverride so the first
// result is always fast; the weekly cron runs the full plan limit instead.
export const INLINE_SAFE_PROMPT_LIMIT = 25;

export interface ScoreForCustomerOptions {
  /**
   * Override the per-plan prompt limit for this specific run.
   * Use INLINE_SAFE_PROMPT_LIMIT (25) for synchronous Vercel routes to prevent
   * 300s timeouts on Pro plans.  When omitted, the plan default is used.
   */
  promptLimitOverride?: number;
}

/**
 * Score a customer's tracked brand and upsert the result into customer_scoring_runs.
 *
 * Loads customer + tracked_brands from Supabase, runs the scorer against all
 * configured LLMs in parallel, writes results, and returns the score summary.
 *
 * The caller is responsible for updating scoring_jobs status and
 * tracked_brands.last_scored_at.
 *
 * @param options.promptLimitOverride  - Hard-cap the number of prompts regardless
 *   of plan.  Pass INLINE_SAFE_PROMPT_LIMIT for synchronous Vercel routes to avoid
 *   the ~250s Pro-plan timeout.  Omit to use the plan default (25 Starter / 100 Pro).
 *
 * @throws Error if customer or tracked brand is not found, or if subscription is invalid.
 */
export async function scoreForCustomer(
  customerId: string,
  supabase: SupabaseClient,
  options: ScoreForCustomerOptions = {}
): Promise<AvsScoreResult> {
  // 1. Load customer row
  const { data: customer, error: customerErr } = await supabase
    .from("customers")
    .select("id, plan, subscription_status")
    .eq("id", customerId)
    .maybeSingle();

  if (customerErr) {
    throw new Error(`Failed to load customer: ${customerErr.message}`);
  }
  if (!customer) {
    throw new Error(`No customer found with id=${customerId}`);
  }

  const plan: string = customer.plan ?? "starter";
  const subStatus: string = customer.subscription_status ?? "none";

  if (!["active", "trialing"].includes(subStatus)) {
    throw new Error(
      `Customer ${customerId} subscription_status=${subStatus} — only active/trialing subscriptions may run the scorer`
    );
  }

  // 2. Resolve per-plan prompt limit (honouring any caller override).
  //    Synchronous Vercel routes (onboarding, run-now) should pass
  //    promptLimitOverride: INLINE_SAFE_PROMPT_LIMIT (25) to guarantee the
  //    function completes within the 300 s hard timeout even for Pro customers.
  //    The weekly cron omits the override so Pro gets the full 100-prompt run.
  const planDefault = PLAN_PROMPT_LIMITS[plan] ?? 25;
  const promptLimit =
    options.promptLimitOverride !== undefined
      ? Math.min(options.promptLimitOverride, planDefault) // never exceed plan entitlement
      : planDefault;

  // 3. Load tracked_brands row
  const { data: tb, error: brandErr } = await supabase
    .from("tracked_brands")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (brandErr) {
    throw new Error(`Failed to load tracked brand: ${brandErr.message}`);
  }
  if (!tb) {
    throw new Error(
      `No tracked brand found for customer_id=${customerId}. Complete onboarding first.`
    );
  }

  // 4. Build BrandProfile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brandProfile = buildBrandProfileFromRow(tb as Record<string, any>);

  // 5. Run scorer
  const runDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  console.log(
    `[scorer] Starting run for ${brandProfile.brand} | plan=${plan} | prompts=${promptLimit}`
  );

  const brandScore = await scoreBrand(brandProfile, runDate, promptLimit);

  console.log(
    `[scorer] Done: AVS=${brandScore.avsBrand.toFixed(1)}/100 for ${brandProfile.brand}`
  );

  // 6. Build per_llm map
  const perLlm: Record<string, number> = {};
  for (const [key, llmScore] of Object.entries(brandScore.llmScores)) {
    perLlm[key] = Math.round(llmScore.avs * 10) / 10;
  }

  // 7. Extract gap prompts
  const gapPrompts = extractGapPrompts(brandScore);

  // 8. Generate fix report (Pro only)
  let fixReportMd: string | null = null;
  if (plan === "pro") {
    console.log(`[scorer] Generating fix report for Pro customer ${customerId}…`);
    fixReportMd = await generateFixReport(
      brandProfile.brand,
      brandProfile.url,
      gapPrompts,
      brandScore.avsBrand,
      perLlm
    );
  }

  // 9. Count prompts
  const promptCount = Object.values(brandScore.llmScores).reduce(
    (sum, s) => sum + s.promptsScored + s.promptsSkipped,
    0
  );
  const estimatedCostUsd = ESTIMATED_RUN_COST[plan] ?? 0.5;

  // 10. Upsert customer_scoring_runs
  const runRow = {
    customer_id: customerId,
    run_date: runDate,
    avs_brand: Math.round(brandScore.avsBrand * 100) / 100,
    per_llm: perLlm,
    gap_prompts: gapPrompts,
    fix_report_md: fixReportMd,
    prompt_count: promptCount,
    estimated_cost_usd: estimatedCostUsd,
  };

  const { error: upsertErr } = await supabase
    .from("customer_scoring_runs")
    .upsert(runRow, { onConflict: "customer_id,run_date" });

  if (upsertErr) {
    // Graceful fallback: if quota columns aren't migrated yet, retry without them
    if (
      upsertErr.message.includes("prompt_count") ||
      upsertErr.message.includes("estimated_cost_usd")
    ) {
      console.warn(
        "[scorer] Migration not yet applied — retrying upsert without quota columns"
      );
      const fallbackRow = { ...runRow };
      delete (fallbackRow as Record<string, unknown>).prompt_count;
      delete (fallbackRow as Record<string, unknown>).estimated_cost_usd;
      const { error: fallbackErr } = await supabase
        .from("customer_scoring_runs")
        .upsert(fallbackRow, { onConflict: "customer_id,run_date" });
      if (fallbackErr) {
        throw new Error(
          `Failed to upsert scoring run: ${fallbackErr.message}`
        );
      }
    } else {
      throw new Error(`Failed to upsert scoring run: ${upsertErr.message}`);
    }
  }

  console.log(
    `[scorer] Wrote scoring run to DB: ${runDate} | prompts=${promptCount} | cost=$${estimatedCostUsd}`
  );

  return {
    customerId,
    runDate,
    avsBrand: Math.round(brandScore.avsBrand * 100) / 100,
    perLlm,
    gapPrompts,
    fixReportMd,
    promptCount,
    estimatedCostUsd,
  };
}
