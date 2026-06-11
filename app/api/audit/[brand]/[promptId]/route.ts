/**
 * GET /api/audit/[brand]/[promptId]?token=<AUDIT_TOKEN>
 *
 * Internal-only audit endpoint. Returns the full PromptResult — including
 * response_text — for a given brand slug × prompt ID so decisions like
 * "did GPT-4o really not mention Vercel for CD-01?" can be spot-checked
 * without re-running the scorer.
 *
 * Auth: token query-string must match process.env.AUDIT_TOKEN.
 * No CORS headers, no Cache-Control — internal use only.
 *
 * Reads: scorer_output/<latest-run-date>/<brand-slug>.json
 * The brand slug is derived by lower-casing [brand] and replacing spaces
 * with underscores, matching the file-naming convention in scorer/run.py.
 */

import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";

// Resolve scorer_output relative to the repo root (two levels above app/).
const SCORER_OUTPUT_DIR = path.join(process.cwd(), "scorer_output");

/**
 * Return the latest ISO-date-format subdirectory inside scorer_output,
 * ignoring directories that don't match YYYY-MM-DD (e.g. "2026-05-28-render-only").
 */
async function getLatestRunDate(): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(SCORER_OUTPUT_DIR);
  } catch {
    return null;
  }
  const dateDirs = entries.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e));
  if (dateDirs.length === 0) return null;
  return dateDirs.sort().at(-1) ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { brand: string; promptId: string } }
): Promise<NextResponse> {
  // ── 1. Token auth ──────────────────────────────────────────────────────────
  const auditToken = process.env.AUDIT_TOKEN;
  if (!auditToken) {
    return NextResponse.json(
      { error: "AUDIT_TOKEN env var not configured" },
      { status: 500 }
    );
  }
  const queryToken = request.nextUrl.searchParams.get("token");
  if (queryToken !== auditToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Resolve the brand JSON file ─────────────────────────────────────────
  const brandSlug = params.brand.toLowerCase().replace(/\s+/g, "_");
  const promptId = params.promptId.toUpperCase();

  const latestDate = await getLatestRunDate();
  if (!latestDate) {
    return NextResponse.json(
      { error: "No scorer_output runs found" },
      { status: 404 }
    );
  }

  const brandFilePath = path.join(
    SCORER_OUTPUT_DIR,
    latestDate,
    `${brandSlug}.json`
  );

  let brandData: Record<string, unknown>;
  try {
    const raw = await readFile(brandFilePath, "utf-8");
    brandData = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: `Brand not found: ${brandSlug} (run: ${latestDate})` },
      { status: 404 }
    );
  }

  // ── 3. Find the prompt_result across all LLMs ──────────────────────────────
  // Return results from all LLMs that have this prompt ID, keyed by llm_key.
  const llms = brandData.llms as Record<
    string,
    { prompt_results: Array<Record<string, unknown>> }
  > | undefined;

  if (!llms) {
    return NextResponse.json(
      { error: "Brand file has no llms field" },
      { status: 404 }
    );
  }

  const results: Record<string, unknown> = {};
  for (const [llmKey, llmScore] of Object.entries(llms)) {
    const match = (llmScore.prompt_results ?? []).find(
      (pr) => (pr.prompt_id as string)?.toUpperCase() === promptId
    );
    if (match) {
      results[llmKey] = match;
    }
  }

  if (Object.keys(results).length === 0) {
    return NextResponse.json(
      {
        error: `Prompt not found: ${promptId} for brand ${brandSlug} (run: ${latestDate})`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    brand: brandData.brand,
    url: brandData.url,
    run_date: latestDate,
    prompt_id: promptId,
    results,
  });
}
