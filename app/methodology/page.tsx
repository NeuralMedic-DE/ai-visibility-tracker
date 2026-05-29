import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How We Scored This: Methodology | NeuralReach AI Visibility Index",
  description:
    "Full methodology behind the AI Visibility Index: 25 canonical prompts, 3 LLMs scored via live API calls, the AVS formula, and what Verified means.",
};

const PROMPT_CATEGORIES = [
  {
    id: "CD",
    label: "Category Discovery",
    count: 5,
    description:
      `Generic "what's best for X" queries. These are the prompts most buyers fire first. Example: "What is the best CRM for B2B SaaS?"`,
  },
  {
    id: "CM",
    label: "Comparison",
    count: 5,
    description:
      `Head-to-head comparisons against the brand's two closest competitors. Example: "Pipedrive vs HubSpot: which is better?"`,
  },
  {
    id: "AL",
    label: "Alternatives",
    count: 5,
    description:
      `Buyer-in-pain queries searching for a switch. Example: "Cheaper alternatives to Salesforce for SMBs."`,
  },
  {
    id: "UC",
    label: "Use Case",
    count: 5,
    description:
      `Job-to-be-done questions a practitioner might ask. Example: "Best way to track trial-to-paid conversion for a SaaS team."`,
  },
  {
    id: "IN",
    label: "Integration",
    count: 5,
    description:
      `Tool-stack queries about connectivity. Example: "Does Attio integrate with Zapier?"`,
  },
];

const LLMS = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    model: "GPT-4o",
    note: "Non-browsing chat mode. Scores reflect the model's training knowledge, not live web results.",
  },
  {
    key: "claude",
    label: "Claude",
    model: "Haiku 4.5",
    note: "Anthropic's fast-tier model. Same non-browsing constraint as ChatGPT.",
  },
  {
    key: "perplexity",
    label: "Perplexity",
    model: "Sonar Pro",
    note: "Real-time web-augmented answers. Scores here are closer to a live organic-search signal.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-700">
              NeuralReach
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/leaderboard"
                className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                AI Visibility Index
              </Link>
              <Link
                href="/pricing"
                className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/#waitlist"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Get Early Access
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white py-14 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-3">
            AI Visibility Index
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            How we scored this
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
            Every score in the index is derived from real API calls. No
            estimates, no scraped proxies. Here&rsquo;s exactly what we did.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <span className="rounded-full bg-white ring-1 ring-gray-200 px-4 py-1.5 font-medium text-gray-700">
              100 brands
            </span>
            <span className="rounded-full bg-white ring-1 ring-gray-200 px-4 py-1.5 font-medium text-gray-700">
              25 prompts per brand
            </span>
            <span className="rounded-full bg-white ring-1 ring-gray-200 px-4 py-1.5 font-medium text-gray-700">
              3 LLMs
            </span>
            <span className="rounded-full bg-white ring-1 ring-gray-200 px-4 py-1.5 font-medium text-gray-700">
              7,500+ API calls
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 space-y-14">

        {/* Section 1 — Prompt set */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            1. The 25 canonical prompts
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Each brand is evaluated against 25 prompt templates drawn from five
            buyer-intent categories. Templates are filled with brand-specific
            variables (category, segment, top competitors, key use cases,
            integration partners) before they are sent to each LLM.
          </p>
          <div className="space-y-4">
            {PROMPT_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="flex gap-4 rounded-xl ring-1 ring-gray-200 p-5 bg-white"
              >
                <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                  {cat.id}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">
                    {cat.label}{" "}
                    <span className="text-sm font-normal text-gray-500">
                      ({cat.count} prompts)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{cat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2 — LLMs */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            2. The 3 LLMs scored
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            We fire each prompt against three platforms via their official APIs.
            Responses are captured verbatim and scored independently. No
            human editing.
          </p>
          <div className="space-y-4">
            {LLMS.map((llm) => (
              <div
                key={llm.key}
                className="flex gap-4 rounded-xl ring-1 ring-gray-200 p-5 bg-white"
              >
                <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 text-xs font-bold text-gray-700 ring-1 ring-gray-200">
                  {llm.label.slice(0, 2)}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">
                    {llm.label}{" "}
                    <span className="text-sm font-normal text-gray-400">
                      ({llm.model})
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{llm.note}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-5">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              Google AI Overviews: not in this run
            </p>
            <p className="text-sm text-amber-700 leading-relaxed">
              Our data model includes a Google AIO slot, but live AI Overview
              retrieval via SerpAPI was not activated for this index run.
              Google AIO scores appear as 0 across all entries. We plan to add
              it in a future run once we validate retrieval accuracy.
            </p>
          </div>
        </section>

        {/* Section 3 — Scoring */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            3. How we compute the AVS
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            <strong>AI Visibility Score (AVS)</strong> is a 0–100 composite
            that measures how prominently a brand appears across all LLM
            responses. It is computed in three steps.
          </p>

          {/* Step 1 */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">
              Step 1: Per-prompt raw score (0–10)
            </h3>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              For every (prompt × LLM) pair we parse the response and award
              points on three signals:
            </p>
            <div className="overflow-hidden rounded-xl ring-1 ring-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-2.5 pl-4 pr-3 text-left font-semibold text-gray-700">Signal</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-700">Condition</th>
                    <th className="py-2.5 pl-3 pr-4 text-right font-semibold text-gray-700">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["Rank", "Listed 1st", "+6"],
                    ["Rank", "Listed 2nd", "+5"],
                    ["Rank", "Listed 3rd", "+4"],
                    ["Rank", "Listed 4th", "+3"],
                    ["Rank", "Listed 5th", "+2"],
                    ["Rank", "Listed 6th or lower", "+1"],
                    ["Rank", "Mentioned, not in a list (\"unranked\")", "+2"],
                    ["Rank", "Primary answer to direct-question prompt (\"N/A\")", "+3"],
                    ["Rank", "Not mentioned", "0"],
                    ["Sentiment", "Positive framing near brand", "+2"],
                    ["Sentiment", "Neutral", "0"],
                    ["Sentiment", "Negative framing near brand", "−2"],
                    ["Citation", "Brand URL cited in response", "+1"],
                  ].map(([signal, condition, pts], i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="py-2.5 pl-4 pr-3 text-gray-500 font-medium">{signal}</td>
                      <td className="py-2.5 px-3 text-gray-700">{condition}</td>
                      <td className="py-2.5 pl-3 pr-4 text-right font-mono font-semibold text-gray-900">{pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Raw score is clamped to 0–10. Maximum possible per prompt: 9
              (1st-place + positive + URL cited).
            </p>
          </div>

          {/* Step 2 */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">
              Step 2: Per-LLM AVS
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              The 25 raw scores for a given LLM are averaged and multiplied
              by 10, yielding a 0–100 AVS for that platform.
            </p>
            <div className="mt-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 px-5 py-4 font-mono text-sm text-gray-700">
              AVS<sub>LLM</sub> = (Σ prompt scores / 25) × 10
            </div>
          </div>

          {/* Step 3 */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Step 3: Composite AVS
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              The composite score on the leaderboard is the simple mean of all
              per-LLM AVS values for which at least one prompt was scored.
              Currently that is three platforms (ChatGPT, Claude, Perplexity).
            </p>
            <div className="mt-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 px-5 py-4 font-mono text-sm text-gray-700">
              AVS<sub>brand</sub> = mean(AVS<sub>ChatGPT</sub>, AVS<sub>Claude</sub>, AVS<sub>Perplexity</sub>)
            </div>
          </div>
        </section>

        {/* Section 4 — Verified */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            4. What &ldquo;Verified&rdquo; means
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Every brand in this index is marked <strong>Verified</strong>. That
            means all 75 scores (25 prompts × 3 LLMs) were obtained through
            live API calls made on the run date shown in the leaderboard. No
            score was interpolated, extrapolated, or carried forward from a
            prior run. An <em>Estimated</em> label would appear if a brand
            partially failed (e.g., a provider rate-limit caused some prompts to
            be skipped) and we back-filled with a prior result. That did not
            happen in this run.
          </p>
        </section>

        {/* Section 5 — Caveats */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            5. Sample-size and freshness caveats
          </h2>
          <ul className="space-y-3 text-gray-600 text-sm leading-relaxed">
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">·</span>
              <span>
                <strong>25 prompts is a proxy, not a census.</strong> Real buyer
                behaviour spans thousands of query variants. Our prompt set is
                designed to be representative across five intent types, but
                niche queries specific to a brand&rsquo;s micro-category may
                not be covered.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">·</span>
              <span>
                <strong>LLM outputs are non-deterministic.</strong> Re-running
                the same prompt against the same model on the same day can
                produce a different ranked list. Scores are a snapshot, not a
                guaranteed steady-state measurement.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">·</span>
              <span>
                <strong>Scores decay.</strong> LLM training data and real-time
                web indices change continuously. The numbers shown reflect the
                run date; a brand&rsquo;s score may differ if you re-run today.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">·</span>
              <span>
                <strong>Sentiment is LLM-assisted.</strong> We classify the
                sentiment of each brand mention using a lightweight model
                (GPT-4o-mini). Keyword-heuristic fallback is used if the
                classification call fails. Edge cases may be mis-labelled.
              </span>
            </li>
          </ul>
        </section>

        {/* Section 6 — Run summary link */}
        <section className="rounded-2xl bg-brand-50 ring-1 ring-brand-100 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              See the raw run data
            </h2>
            <p className="text-sm text-gray-600">
              The full leaderboard shows every brand&rsquo;s composite AVS, per-LLM
              breakdown, and top gap prompts. All data comes directly from the
              scoring run.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors text-center"
          >
            View AI Visibility Index
          </Link>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 bg-white mt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-semibold text-brand-700">NeuralReach</span>
            <p className="text-xs text-gray-400">
              © 2026 NeuralMedic / NeuralReach. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-gray-400">
              <Link href="/leaderboard" className="hover:text-gray-600">
                AI Visibility Index
              </Link>
              <Link href="/methodology" className="hover:text-gray-600">
                Methodology
              </Link>
              <Link href="/pricing" className="hover:text-gray-600">
                Pricing
              </Link>
              <a href="mailto:hello@neuralreach.de" className="hover:text-gray-600">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
