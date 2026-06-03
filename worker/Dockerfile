# ─────────────────────────────────────────────────────────────────────────────
# NeuralReach Scoring Worker
#
# Builds a single image containing:
#   • Node.js 20 (runs the TypeScript worker that polls scoring_jobs)
#
# Scoring is done entirely in TypeScript via lib/scorer.ts — no Python needed.
#
# Build context: repo root  (docker build -f worker/Dockerfile .)
# The worker polls Supabase for pending jobs and runs the TypeScript scorer.
#
# Required env vars at runtime (set in Railway / Fly / Render):
#   NEXT_PUBLIC_SUPABASE_URL   SUPABASE_SERVICE_ROLE_KEY
#   OPENAI_API_KEY             ANTHROPIC_API_KEY
#   PERPLEXITY_API_KEY         SERPAPI_KEY
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# ── Node.js worker dependencies ───────────────────────────────────────────────
COPY worker/package.json worker/
RUN cd worker && npm install --omit=dev

# ── Application source ────────────────────────────────────────────────────────
# lib/ contains scorer.ts (imported as '../lib/scorer' by worker/index.ts).
# worker/ contains the queue-polling entry point.
COPY lib/ lib/
COPY worker/ worker/

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV NODE_ENV=production

# tsx is in worker/node_modules/.bin; we run from /app so __dirname in
# worker/index.ts resolves to /app/worker and REPO_ROOT to /app (correct).
CMD ["worker/node_modules/.bin/tsx", "worker/index.ts"]
