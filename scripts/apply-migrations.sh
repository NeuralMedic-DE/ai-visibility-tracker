#!/usr/bin/env bash
# ============================================================
# NeuralReach — Apply pending DB migrations to production
# ============================================================
# Uses one of two methods (whichever credential you have):
#
#   Method A — Supabase CLI (needs SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD)
#   Method B — psql direct  (needs SUPABASE_DB_PASSWORD only)
#
# How to run:
#   1. Get your DB password from Supabase Dashboard →
#      Project Settings → Database → Database password
#
#   2a. CLI method:
#       export SUPABASE_ACCESS_TOKEN=sbp_xxxx    # from supabase.com/dashboard/account/tokens
#       export SUPABASE_DB_PASSWORD=YOUR_DB_PASS
#       bash scripts/apply-migrations.sh cli
#
#   2b. psql method:
#       export SUPABASE_DB_PASSWORD=YOUR_DB_PASS
#       bash scripts/apply-migrations.sh psql
#
# ============================================================

set -euo pipefail

PROJECT_REF="unrfdcxkmelafypuyruk"
METHOD="${1:-}"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  if [[ -z "$METHOD" ]]; then
    # No method = just show help, no password needed
    :
  else
    echo "ERROR: SUPABASE_DB_PASSWORD is not set."
    echo "  Get it from: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
    exit 1
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DELTA_SQL="${REPO_ROOT}/supabase/migrations/pending_delta_0009_0013.sql"

if [[ ! -f "$DELTA_SQL" ]]; then
  echo "ERROR: Missing migration file: $DELTA_SQL"
  exit 1
fi

# ── Method A: Supabase CLI ────────────────────────────────
if [[ "$METHOD" == "cli" ]]; then
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    echo "ERROR: SUPABASE_ACCESS_TOKEN is not set for CLI method."
    exit 1
  fi
  echo "→ Applying migrations via Supabase CLI (supabase db push)..."
  cd "$REPO_ROOT"
  supabase db push \
    --workdir supabase \
    --db-url "postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
    --include-all
  echo "✅ CLI migrations applied."
  exit 0
fi

# ── Method B: psql direct ─────────────────────────────────
if [[ "$METHOD" == "psql" ]]; then
  if ! command -v psql &>/dev/null; then
    echo "ERROR: psql not found. Install: brew install postgresql"
    exit 1
  fi
  DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
  echo "→ Applying pending_delta_0009_0013.sql via psql..."
  PGSSLMODE=require psql "$DB_URL" -f "$DELTA_SQL"
  echo "✅ psql migrations applied."

  echo ""
  echo "Verifying..."
  PGSSLMODE=require psql "$DB_URL" -c "
    SELECT 'stripe_events' AS table_name, COUNT(*) AS row_count FROM public.stripe_events
    UNION ALL
    SELECT 'customers.user_id' , COUNT(*) FROM public.customers WHERE user_id IS NOT NULL
    UNION ALL
    SELECT 'scoring_runs.prompt_count', COUNT(*) FROM public.customer_scoring_runs WHERE prompt_count IS NOT NULL;
  "
  exit 0
fi

# ── No method: print instructions ─────────────────────────
echo ""
echo "NeuralReach — Production Migration Helper"
echo ""
echo "Missing migrations in prod: 0009, 0010, 0011, 0012, 0013"
echo "  - stripe_events table (webhook idempotency)"
echo "  - customers.user_id column"
echo "  - customer_scoring_runs.prompt_count / estimated_cost_usd"
echo "  - subscription_status CHECK constraint"
echo ""
echo "Usage:"
echo "  export SUPABASE_DB_PASSWORD=<your-db-password>"
echo "  bash scripts/apply-migrations.sh psql      # via psql (recommended)"
echo ""
echo "  OR (also needs SUPABASE_ACCESS_TOKEN):"
echo "  export SUPABASE_ACCESS_TOKEN=sbp_xxxx"
echo "  bash scripts/apply-migrations.sh cli       # via Supabase CLI"
echo ""
echo "Get your DB password at:"
echo "  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo ""
echo "FASTEST PATH: SQL Editor"
echo "  1. Go to https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
echo "  2. Paste contents of: supabase/migrations/pending_delta_0009_0013.sql"
echo "  3. Click Run"
echo ""
