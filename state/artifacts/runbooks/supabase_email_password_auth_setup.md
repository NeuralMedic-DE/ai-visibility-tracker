# Runbook: Supabase Email Provider Settings

**Why this step exists:**  
The app uses email magic-link sign-in (and falls back to email+password). The cloud project needs email confirmation enabled so unverified users cannot log in without clicking the link in their welcome email — preventing unauthorized account access.

**Time:** ~5 minutes  
**Dashboard URL:** https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/providers

---

## Steps

1. Open the Auth Providers page:  
   `https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/providers`

2. Find the **Email** provider card and click it to expand.

3. Set the following options:

   | Setting | Value |
   |---------|-------|
   | **Enable Email provider** | ON (toggle enabled) |
   | **Confirm email** | ON (toggle enabled) |
   | **Minimum password length** | `8` |
   | **Double confirm email changes** | ON (optional but recommended) |

4. Click **Save**.

---

## Why "Confirm email" must be ON

Without email confirmation, a user can sign up with someone else's email address and immediately access the dashboard. With confirmation enabled, the magic-link / confirmation email must be clicked before the session is created. This aligns with how the Stripe webhook creates a `customers` row — it expects the confirmed `auth.users.id` to bind.

---

## Verification

After saving:
- Visit `https://www.neuralreach.de/login` and attempt to sign up with a test email
- You should receive a "Check your email to confirm your account" response (not an instant login)
