# Runbook: Activate CRON_SECRET in Vercel Production

**Status:** WAITING ON FOUNDER — code is ready, deploy was blocked twice by build errors (now fixed)  
**Priority:** HIGH — weekly auto-scoring never fires until this is done  
**Time required:** ~5 min  
**Cost:** $0

---

## Why this matters

`/api/cron/weekly` and `/api/cron/weekly-digest` both call:

```ts
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
}
```

Every Monday at 09:00 UTC, Vercel calls `/api/cron/weekly`. If `CRON_SECRET` is absent in the production env, it gets HTTP 500 → no scoring jobs ever run automatically.

---

## Previous attempts (for context)

| Approval | Status | Why it failed |
|----------|--------|---------------|
| A-1e4b7c3d (2026-06-01) | Build failed | `pnpm-lock.yaml` missing `@sentry/nextjs` entry |
| A-b3c7d1e9 (2026-06-03) | Build failed | `autoSessionTracking` TypeScript error in `instrumentation.ts` |

**Both issues are now fixed** in the codebase (as of 2026-06-10):
- `pnpm-lock.yaml` now includes `@sentry/nextjs@9.47.1` ✅
- `instrumentation.ts` no longer references `autoSessionTracking` ✅

---

## Steps

### Step 1 — Verify CRON_SECRET is still in Vercel project settings (1 min)

> This was set during A-1e4b7c3d (2026-06-01) but you should confirm it survived the failed redeployments.

Go to:  
**vercel.com → ai-visibility-tracker → Settings → Environment Variables**

Look for `CRON_SECRET` scoped to **Production** environment.

- **If it exists:** skip to Step 2.
- **If it's missing:** click "Add New":
  - Name: `CRON_SECRET`
  - Value: `nr_cron_c7f2a9d4e6b1m3p5q8r0s2t4u1v`
  - Environments: ✅ Production only (uncheck Preview + Development)
  - → Save

### Step 2 — Remove the install-command override if you added it (1 min)

> During A-b3c7d1e9 you may have set an install command override in Vercel Settings → General. This is no longer needed since the lockfile is now in sync.

Go to:  
**vercel.com → ai-visibility-tracker → Settings → General → Build & Development Settings → Install Command**

- If it shows `pnpm install --no-frozen-lockfile`: clear it back to the default (blank), → Save.
- If it's already blank: no action needed — the `vercel.json` value (`pnpm install`) will be used.

### Step 3 — Trigger a fresh production deployment (2 min)

The current production build is stale (from before the Sentry lockfile fix). Trigger a fresh deploy:

**Option A — Via Vercel dashboard (no git needed):**
1. Deployments tab → latest Production deployment → ⋯ (three-dot menu) → Redeploy
2. UNCHECK "Use existing Build Cache" (forces fresh `pnpm install`)
3. Click Redeploy
4. Wait ~90 seconds for green checkmark

**Option B — Via git push (if you have changes staged):**
```
git push origin main
```
Vercel auto-deploys on every push to `main`.

### Step 4 — Verify (1 min)

Once the green checkmark appears, run:

```bash
curl -s -w "\n%{http_code}" \
  -X GET \
  -H "Authorization: Bearer nr_cron_c7f2a9d4e6b1m3p5q8r0s2t4u1v" \
  https://www.neuralreach.de/api/cron/weekly
```

**Expected output:**
```
{"scored":0,"skipped":0,"failed":0}
200
```
(Or `{"scored":N,...}` if there are active customers.)

**If you still see `500`:** Check Vercel Deployments → latest → Functions log → filter by `cron/weekly`. The log line `[cron/weekly] CRON_SECRET env var not set` confirms it's still missing.

---

## What this unlocks

Once `CRON_SECRET` is live in production:
- Every Monday at 09:00 UTC → Vercel calls `/api/cron/weekly` → all active customers get rescored
- Every Monday at 10:00 UTC → Vercel calls `/api/cron/weekly-digest` → digest emails go out (once Resend DNS is fixed too)
- The M1 launch gate (weekly auto-scan) is fully unblocked on the scheduling side

---

## The CRON_SECRET value

```
nr_cron_c7f2a9d4e6b1m3p5q8r0s2t4u1v
```

This value is also in `.env.local` on your development machine.
