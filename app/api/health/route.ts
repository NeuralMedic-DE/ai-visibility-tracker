/**
 * GET /api/health
 *
 * Lightweight health check endpoint.
 * - Verifies Supabase connectivity (service-role read of a tiny table)
 * - Confirms all 9 application tables exist (schema integrity check)
 * - Returns 200 when healthy, 503 when degraded
 *
 * Used by:
 *  - Uptime monitors (e.g. Better Stack, UptimeRobot)
 *  - Post-deploy CI verification step
 *  - GitHub Actions db-migrate.yml "verify schema" step
 *
 * Does NOT expose secrets or row counts — safe to make public.
 */

import { NextResponse } from 'next/server';

// Prevent Vercel edge from caching this response even when the upstream
// Next.js route sets Cache-Control: no-store (edge honours its own TTL
// unless the route is explicitly opted out of static rendering).
export const dynamic = 'force-dynamic';

const REQUIRED_TABLES = [
  'customers',
  'tracked_brands',
  'customer_scoring_runs',
  'waitlist',
  'brands',
  'scores',
  'runs',
  'scoring_jobs',
  'email_log',
] as const;

type TableName = (typeof REQUIRED_TABLES)[number];
type TableResult = { ok: boolean; http?: number; error?: string };

async function probeTable(
  supabaseUrl: string,
  serviceKey: string,
  table: TableName
): Promise<TableResult> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${table}?limit=1&select=id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        // Short timeout — this is a liveness check, not a real query
        signal: AbortSignal.timeout(5_000),
      }
    );
    return { ok: res.ok, http: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { status: 'error', message: 'Missing Supabase env vars' },
      { status: 503 }
    );
  }

  // Probe all tables in parallel
  const results = await Promise.all(
    REQUIRED_TABLES.map(async (table) => ({
      table,
      ...(await probeTable(supabaseUrl, serviceKey, table)),
    }))
  );

  const failed = results.filter((r) => !r.ok);
  const healthy = failed.length === 0;

  const body = {
    status: healthy ? 'ok' : 'degraded',
    supabase_project: supabaseUrl.match(/\/\/([^.]+)/)?.[1] ?? 'unknown',
    tables_ok: results.filter((r) => r.ok).length,
    tables_total: REQUIRED_TABLES.length,
    ...(failed.length > 0 && {
      missing_tables: failed.map((r) => r.table),
    }),
    email_health: '/api/health/email',
    commit_sha: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7),
    checked_at: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
