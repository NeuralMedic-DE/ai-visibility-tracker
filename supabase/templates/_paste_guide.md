# Supabase Auth Email Templates — Paste Guide

Where to paste:
https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/templates

For each template below:
1. Click into the matching tab in the Supabase Dashboard.
2. Paste the SUBJECT into the 'Subject' field (verbatim, including `{{ .Token }}` placeholders).
3. Paste the contents of the corresponding HTML file into the 'Message body' field.
4. Click Save.

All 6 templates share the NeuralReach branded layout (wordmark header, white card, brand-blue CTA, footer). Updating any single template only affects the one tab you save.

---

## Magic Link

**Tab in dashboard:** `Magic Link`
**Subject:** `Your NeuralReach sign-in code: {{ .Token }}`
**Body file:** `supabase/templates/magic_link.html`

## Confirm signup

**Tab in dashboard:** `Confirm signup`
**Subject:** `Confirm your NeuralReach account`
**Body file:** `supabase/templates/confirm_signup.html`

## Reset Password

**Tab in dashboard:** `Reset Password`
**Subject:** `Reset your NeuralReach password`
**Body file:** `supabase/templates/reset_password.html`

## Change Email Address

**Tab in dashboard:** `Change Email Address`
**Subject:** `Confirm your new NeuralReach email`
**Body file:** `supabase/templates/change_email.html`

## Invite user

**Tab in dashboard:** `Invite user`
**Subject:** `You have been invited to NeuralReach`
**Body file:** `supabase/templates/invite_user.html`

## Reauthentication

**Tab in dashboard:** `Reauthentication`
**Subject:** `Confirm it is you: NeuralReach action code {{ .Token }}`
**Body file:** `supabase/templates/reauthentication.html`

