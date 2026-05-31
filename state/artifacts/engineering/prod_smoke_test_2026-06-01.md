# Production Smoke Test — 2026-06-01

**Task:** T-5a7ab81f  
**Tester:** Engineer sub-agent  
**Date:** 2026-06-01  
**Base URL tested:** https://www.neuralreach.de (production)  
**Note:** `neuralreach.de` (no www) returns a 307 redirect to `https://www.neuralreach.de/` — this is expected and correct Vercel apex→www redirect behavior.

---

## PASS/FAIL Summary Table

| # | Route | Expected | Actual Status | Notes | Result |
|---|-------|----------|--------------|-------|--------|
| a | `GET /` | 200 + credibility strip | **200** + "7,500 real LLM calls" found | Text present in SSR HTML | ✅ PASS |
| b | `GET /dashboard` | 3xx → /login | **307** → `/login?next=%2Fdashboard` | Session gate working, preserves `next` param | ✅ PASS |
| c | `GET /pricing` | 200 | **200** | Page renders correctly | ✅ PASS |
| d | `GET /methodology` | 200 | **200** | Page renders correctly | ✅ PASS |
| e | `GET /onboarding` | 3xx → /login | **404** | Route not deployed — page does not exist yet | ❌ FAIL |

**Overall: 4/5 PASS — 1 FAIL (`/onboarding` not deployed)**

---

## Detailed Results

### (a) GET https://www.neuralreach.de/
- **HTTP status:** `200 OK`
- **Credibility strip check:** `7,500 real LLM calls` — **FOUND** in SSR HTML output
- **Excerpt from response:**
  ```
  <span>7,500<!-- --> real LLM calls</span>
  ```
- **Assessment:** ✅ PASS

---

### (b) GET https://www.neuralreach.de/dashboard
- **HTTP status:** `307 Temporary Redirect`
- **Location header:** `https://www.neuralreach.de/login?next=%2Fdashboard`
- **Assessment:** Middleware session gate is functioning. Correctly redirects unauthenticated requests to `/login` and preserves the original destination via `?next=` param.
- **Assessment:** ✅ PASS

---

### (c) GET https://www.neuralreach.de/pricing
- **HTTP status:** `200 OK`
- **Assessment:** ✅ PASS

---

### (d) GET https://www.neuralreach.de/methodology
- **HTTP status:** `200 OK`
- **Assessment:** ✅ PASS

---

### (e) GET https://www.neuralreach.de/onboarding
- **HTTP status:** `404 Not Found`
- **Response body:** Next.js default 404 page ("This page could not be found.")
- **Expected:** 3xx redirect to `/login` (auth-gated onboarding flow)
- **Root cause:** The `/onboarding` route has not been built or deployed yet. This is the T-275bfa1c task (`tracked_brands` schema + per-customer scoring + onboarding form), currently pending.
- **Assessment:** ❌ FAIL

---

## Bonus Checks

| Route | Status | Notes |
|-------|--------|-------|
| `GET https://neuralreach.de/` (apex) | 307 → www | Correct apex→www redirect |
| `GET https://www.neuralreach.de/login` | 200 | Login page exists and renders |

---

## Action Items

1. **[Blocker — T-275bfa1c]** The `/onboarding` route needs to be built and deployed. It should:
   - Be protected by the existing middleware session gate (redirect unauthenticated users to `/login`)
   - Render the brand onboarding form for authenticated users
   
2. `/dashboard` redirect correctly passes `?next=%2Fdashboard` — the `/login` page should consume this param post-auth to redirect back to the intended destination (verify this UX flow once onboarding is live).

---

## Environment Notes

- Deployment platform: Vercel (inferred from Next.js chunk naming + apex redirect behavior)
- Next.js build ID: `n-94UOrkappt_cijFP332`
- Domain: `www.neuralreach.de` (canonical)
