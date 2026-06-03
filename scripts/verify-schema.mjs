#!/usr/bin/env node
/**
 * NeuralReach — Schema Verification Script
 *
 * Checks that all 10 required tables and 8 required columns exist in the
 * production Supabase database (project unrfdcxkmelafypuyruk).
 * Covers migrations 0001 through 0013.
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-schema.mjs
 *
 * Or with env vars already set:
 *   NEXT_PUBLIC_SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/verify-schema.mjs
 *
 * Exit code 0 = all checks pass, 1 = one or more checks failed.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  console.error('    Run with: node --env-file=.env.local scripts/verify-schema.mjs');
  process.exit(1);
}

// ── Expected tables ──────────────────────────────────────────────────────────
const REQUIRED_TABLES = [
  { table: 'waitlist',               migration: '0001_init.sql' },
  { table: 'brands',                 migration: '0001_init.sql' },
  { table: 'runs',                   migration: '0001_init.sql' },
  { table: 'scores',                 migration: '0001_init.sql' },
  { table: 'customers',              migration: '0002_customers.sql' },
  { table: 'tracked_brands',         migration: '0003_tracked_brands.sql' },
  { table: 'customer_scoring_runs',  migration: '0003_tracked_brands.sql' },
  { table: 'email_log',              migration: '0005_email_log.sql' },
  { table: 'scoring_jobs',           migration: '0007_scoring_jobs.sql' },
  // ⚠️  CRITICAL: stripe_events must exist or every Stripe webhook fails with 500
  { table: 'stripe_events',          migration: '0011_stripe_events.sql' },
];

// ── Expected column additions (ALTER TABLE) ──────────────────────────────────
const REQUIRED_COLUMNS = [
  { table: 'customers',              column: 'welcome_email_id',    migration: '0004_email_tracking.sql' },
  { table: 'waitlist',               column: 'interested_plan',     migration: '0006_waitlist_plan.sql' },
  { table: 'tracked_brands',         column: 'last_scored_at',      migration: '0007_scoring_jobs.sql' },
  { table: 'scoring_jobs',           column: 'trigger',             migration: '0008_scoring_jobs_trigger.sql' },
  // ⚠️  Missing in prod — requires migrations 0009-0013 (pending_delta_0009_0013.sql)
  { table: 'customers',              column: 'user_id',             migration: '0009_user_id_binding.sql' },
  { table: 'customer_scoring_runs',  column: 'prompt_count',        migration: '0012_quota_controls.sql' },
  { table: 'customer_scoring_runs',  column: 'estimated_cost_usd',  migration: '0012_quota_controls.sql' },
];

async function probe(path, select = 'id') {
  const url = `${SUPABASE_URL}/rest/v1/${path}?limit=1&select=${select}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  return res.status;
}

async function main() {
  console.log(`\nNeuralReach schema verification — ${SUPABASE_URL}\n`);
  console.log('── Tables ──────────────────────────────────────────────────────');

  let failures = 0;

  for (const { table, migration } of REQUIRED_TABLES) {
    const code = await probe(table);
    if (code === 200) {
      console.log(`  ✅  ${table.padEnd(30)} (${migration})`);
    } else {
      console.log(`  ❌  ${table.padEnd(30)} HTTP ${code} — migration ${migration} may not be applied`);
      failures++;
    }
  }

  console.log('\n── Column additions ────────────────────────────────────────────');

  for (const { table, column, migration } of REQUIRED_COLUMNS) {
    const code = await probe(table, column);
    if (code === 200) {
      console.log(`  ✅  ${table}.${column.padEnd(22)} (${migration})`);
    } else {
      console.log(`  ❌  ${table}.${column.padEnd(22)} HTTP ${code} — migration ${migration} not applied`);
      failures++;
    }
  }

  console.log('\n────────────────────────────────────────────────────────────────');
  if (failures === 0) {
    console.log(`✅  All ${REQUIRED_TABLES.length} tables + ${REQUIRED_COLUMNS.length} column checks PASSED\n`);
    process.exit(0);
  } else {
    console.log(`❌  ${failures} check(s) FAILED`);
    console.log(`\n   To fix, apply the pending migrations:`);
    console.log(`   FASTEST: https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/sql/new`);
    console.log(`   Paste:   supabase/migrations/pending_delta_0009_0013.sql`);
    console.log(`   OR run:  export SUPABASE_DB_PASSWORD=xxxx && bash scripts/apply-migrations.sh psql\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
