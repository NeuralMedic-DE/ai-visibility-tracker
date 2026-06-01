# ─────────────────────────────────────────────────────────────────────────────
# NeuralReach Scoring Worker
#
# Builds a single image containing:
#   • Node.js 20 (runs the TypeScript worker that polls scoring_jobs)
#   • Python 3   (runs scorer.run_for_customer for each job)
#
# Build context: repo root  (docker build -f worker/Dockerfile .)
# The worker polls Supabase for pending jobs and spawns python3 in-process.
#
# Required env vars at runtime (set in Railway / Fly / Render):
#   NEXT_PUBLIC_SUPABASE_URL   SUPABASE_SERVICE_ROLE_KEY
#   OPENAI_API_KEY             ANTHROPIC_API_KEY
#   PERPLEXITY_API_KEY         SERPAPI_KEY
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim

# Install Python 3 + pip
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python scorer dependencies ────────────────────────────────────────────────
# Use a venv so pip doesn't conflict with the system Python install.
COPY requirements-scorer.txt .
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir -r requirements-scorer.txt

# Ensure the venv's python3 is found first when the worker spawns it
ENV PATH="/opt/venv/bin:$PATH"

# ── Node.js worker dependencies ───────────────────────────────────────────────
COPY worker/package.json worker/
RUN cd worker && npm install --omit=dev

# ── Application source ────────────────────────────────────────────────────────
# scorer/ must be at <repo-root>/scorer/ so `python3 -m scorer.run_for_customer`
# resolves correctly (WORKDIR = /app = repo root inside the container).
COPY scorer/ scorer/
COPY worker/ worker/

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV NODE_ENV=production

# tsx is in worker/node_modules/.bin; we run from /app so __dirname in
# worker/index.ts resolves to /app/worker and REPO_ROOT to /app (correct).
CMD ["worker/node_modules/.bin/tsx", "worker/index.ts"]
