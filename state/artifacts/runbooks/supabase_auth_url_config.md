# Runbook: Supabase Auth URL + Redirect Allowlist

**Why this step exists:**  
Supabase Auth needs to know the canonical URL of the app so it can generate correct confirmation/magic-link URLs and enforce a redirect allowlist for post-login callbacks. Without this, the magic-link emails send users back to localhost or fail with "Redirect URL not allowed" in production.

**Time:** ~5 minutes  
**Dashboard URL:** https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/url-configuration

---

## Steps

1. Open the Supabase dashboard:  
   `https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/url-configuration`

2. Under **Site URL**, set:  
   ```
   https://neuralreach.de
   ```

3. Under **Redirect URLs** (also called "Additional Redirect URLs"), ensure ALL of these are present (one per line). Add any that are missing:  
   ```
   https://neuralreach.de/auth/callback
   https://www.neuralreach.de/auth/callback
   http://localhost:3000/auth/callback
   ```

4. Click **Save** (or **Update**).

---

## Verification

After saving, reload the page and confirm:
- Site URL shows `https://neuralreach.de`
- All three callback URLs appear in the allowlist

The Supabase local `config.toml` already matches this configuration — this step syncs the cloud project to match local dev settings.
