# Combined Founder Dashboard Actions — 2026-06-01

**Approval ID:** A-7c53a25b  
**Created by:** ops  
**Estimated total time:** ~30 minutes  
**Blocker for:** T-564cdf5f (auth), T-bbf10de1 (email), all end-to-end testing

These 4 items can be worked through in a single sitting. Each is independent — order doesn't matter, but running them left-to-right is recommended so you end on the DB migration (which is the easiest to verify).

---

## Checklist

- [ ] **Item 1** — Supabase Auth URL + redirect allowlist (5 min)
- [ ] **Item 2** — Supabase email provider settings (5 min)
- [ ] **Item 3** — Resend DNS records (10–15 min)
- [ ] **Item 4** — Production DB migration (5 min)
- [ ] **Bonus check** — Confirm `EMAIL_DRY_RUN` is NOT set in Vercel Production

---

## Item 1 — Supabase Auth URL + Redirect Allowlist

**Full runbook:** `state/artifacts/runbooks/supabase_auth_url_config.md`  
**Dashboard URL:** https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/url-configuration

### What to do

1. Go to: `https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/url-configuration`

2. Set **Site URL** to:
   ```
   https://neuralreach.de
   ```

3. In **Redirect URLs** (allowlist), ensure all three of these are present:
   ```
   https://neuralreach.de/auth/callback
   https://www.neuralreach.de/auth/callback
   http://localhost:3000/auth/callback
   ```

4. Click **Save**.

### Done when
- Site URL field shows `https://neuralreach.de`
- All three callback URLs appear in the allowlist

---

## Item 2 — Supabase Email Provider Settings

**Full runbook:** `state/artifacts/runbooks/supabase_email_password_auth_setup.md`  
**Dashboard URL:** https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/providers

### What to do

1. Go to: `https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/providers`

2. Click the **Email** provider card to expand it.

3. Set these exact values:

   | Setting | Value |
   |---------|-------|
   | Enable Email provider | **ON** |
   | Confirm email | **ON** |
   | Minimum password length | **8** |

4. Click **Save**.

### Done when
- Email provider is enabled
- "Confirm email" toggle is ON
- Minimum password length is 8

---

## Item 3 — Resend DNS Records

**Full runbook:** `state/artifacts/runbooks/resend_domain_fix_2026-06-01.md`  
**Domain to fix:** `mail.neuralreach.de` (the sending subdomain used by `hello@mail.neuralreach.de`)  
**Resend dashboard:** https://resend.com/domains

### Context
All 5 existing DNS records for `mail.neuralreach.de` are wrong. You must **delete** each old record and **add** the correct one — do not add on top of the wrong ones.

### What to do

#### Step A — Get exact DKIM values from Resend
1. Open https://resend.com/domains
2. Click **mail.neuralreach.de**
3. Resend shows a table with 5 required records — keep this tab open

#### Step B — In your DNS registrar, delete then re-add each of the 5 records

**Record 1 — SPF**
- Type: `TXT`
- Name: `mail` (i.e. `mail.neuralreach.de`)
- Value:
  ```
  v=spf1 include:amazonses.com ~all
  ```

**Records 2, 3, 4 — DKIM**
- Type: `CNAME`
- Names/Values: **copy exactly from the Resend dashboard** — they are account-specific and end in `.dkim.amazonses.com`
- Example format: `resend._domainkey.mail` → `<hash>.dkim.amazonses.com`

**Record 5 — DMARC**
- Type: `TXT`
- Name: `_dmarc.mail` (i.e. `_dmarc.mail.neuralreach.de`)
- Value:
  ```
  v=DMARC1; p=none;
  ```

#### Step C — Trigger verification
1. Return to Resend dashboard → mail.neuralreach.de
2. Click **Verify DNS Records**
3. Wait 5–30 min for DNS to propagate
4. All 5 rows should show green ✓

### Done when
- Resend dashboard shows all 5 records verified (green ✓) for `mail.neuralreach.de`

---

## Item 4 — Production DB Migration

**Dashboard URL:** https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/sql/new

### Context
13 migration files in `supabase/migrations/` define the complete production schema. Run them in numeric order. All use `IF NOT EXISTS` / idempotent guards — safe to re-run if any were partially applied.

### What to do

1. Open the Supabase SQL Editor:  
   `https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/sql/new`

2. Run each file **in order** by copying its contents and clicking **Run**. The files are at:
   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_customers.sql
   supabase/migrations/0003_tracked_brands.sql
   supabase/migrations/0004_email_tracking.sql
   supabase/migrations/0005_email_log.sql
   supabase/migrations/0006_waitlist_plan.sql
   supabase/migrations/0007_scoring_jobs.sql
   supabase/migrations/0008_scoring_jobs_trigger.sql
   supabase/migrations/0009_user_id_binding.sql
   supabase/migrations/0010_email_lowercase_check.sql
   supabase/migrations/0011_stripe_events.sql
   supabase/migrations/0012_quota_controls.sql
   supabase/migrations/0013_subscription_status_check.sql
   ```

3. After running all 13 files, run this verification query in the same SQL Editor:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

### Done when
The verification query returns at least these tables:
```
brands
customers
customer_scoring_runs
email_log
runs
scores
scoring_jobs
stripe_events
tracked_brands
waitlist
```

---

## Bonus Check — Vercel `EMAIL_DRY_RUN` Not Set in Production

> ⚠️ This is a 2-minute sanity check, not a dashboard change (unless the variable is actually set).

1. Open Vercel dashboard: https://vercel.com/dashboard
2. Select the **neuralreach-app** project (or however it's named)
3. Go to **Settings → Environment Variables**
4. Search for `EMAIL_DRY_RUN`

**Expected result:** The variable either does **not exist** in the Production environment, or is set to `0` / `false`.

**If `EMAIL_DRY_RUN=1` appears for Production:**
- Click the variable → Edit → change Production value to `false` (or delete the Production entry entirely while keeping it for Preview/Development)
- Trigger a redeploy after saving

The app will log a loud `🚨` error in Vercel Runtime Logs if this is set to `1` in production, so it's easy to catch — but better to confirm before first real customer signs up.

---

## After Completing All 4 Items

Come back and confirm to the orchestrator that all 4 items are done. The next tasks (end-to-end test + outreach launch gate) will proceed once this approval is marked complete.

**Trigger condition for outreach (all must be true — do NOT rush):**
- Date ≥ 2026-06-04
- T-564cdf5f, T-275bfa1c, T-bbf10de1 all status=done
- End-to-end test passed: Stripe TEST checkout → welcome email received → login → add brand → trigger score → see report on /dashboard
- `jonas@neuralreach.de` mailbox has ≥ 7 days of sender history
