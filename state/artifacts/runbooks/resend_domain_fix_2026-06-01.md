# Runbook: Resend DNS Records Fix — mail.neuralreach.de

**Why this step exists:**  
Transactional emails (welcome, weekly digest) are sent `From: NeuralReach <hello@mail.neuralreach.de>`. Resend requires 5 DNS records on the `mail.neuralreach.de` subdomain for DKIM/SPF/DMARC before it will pass verification and allow sending. All 5 current records are wrong (either missing, pointing at the wrong values, or left as placeholders). They must be **replaced**, not added alongside existing ones.

**Time:** ~10–15 minutes  
**Resend dashboard:** https://resend.com/domains

---

## Overview of the 5 records

Resend requires exactly these record types on `mail.neuralreach.de`:

| # | Type | Host/Name | Notes |
|---|------|-----------|-------|
| 1 | TXT | `mail.neuralreach.de` | SPF record |
| 2 | CNAME | `resend._domainkey.mail.neuralreach.de` | DKIM key 1 |
| 3 | CNAME | (see Resend dashboard) | DKIM key 2 |
| 4 | CNAME | (see Resend dashboard) | DKIM key 3 |
| 5 | TXT | `_dmarc.mail.neuralreach.de` | DMARC policy |

> ⚠️ **DKIM CNAME values are account-specific.** You MUST copy them exactly from the Resend dashboard — do not guess or reuse values from another domain.

---

## Step-by-step

### 1 — Get exact record values from Resend

1. Go to https://resend.com/domains
2. Click on **mail.neuralreach.de** (or add it if it doesn't exist yet)
3. Resend will show you a table with all 5 required DNS records including the exact values
4. Keep this tab open — you'll copy values from it into your DNS registrar

### 2 — Open your DNS registrar

Your domain `neuralreach.de` is managed at your registrar (check where you registered the domain — common ones: Cloudflare, Namecheap, INWX, GoDaddy, Hetzner).

### 3 — Delete all 5 existing wrong records

For each of the 5 record types listed in the table above:
- Find the existing record in your DNS registrar's DNS editor
- **Delete** it (do not just edit — delete and re-add cleanly)

### 4 — Add the 5 correct records

Copy each value from the Resend dashboard and create a new DNS record. The values you should see from Resend are:

**Record 1 — SPF (TXT)**
- Type: `TXT`
- Name/Host: `mail` (i.e., `mail.neuralreach.de`)
- TTL: `3600` (or "Auto")
- Value: `v=spf1 include:amazonses.com ~all`

**Records 2, 3, 4 — DKIM (CNAME)**
- Type: `CNAME`
- Name/Host: Shown in Resend dashboard (typically `resend._domainkey.mail` and 2 others)
- TTL: `3600`
- Value: Shown in Resend dashboard (account-specific, ends in `.dkim.amazonses.com`)

**Record 5 — DMARC (TXT)**
- Type: `TXT`
- Name/Host: `_dmarc.mail` (i.e., `_dmarc.mail.neuralreach.de`)
- TTL: `3600`
- Value: `v=DMARC1; p=none;`

> Some registrars require the full hostname (`mail.neuralreach.de`) while others require just the prefix (`mail`). Use whichever format your registrar expects — check by looking at how your existing `www` or apex records are formatted.

### 5 — Trigger verification in Resend

1. Return to https://resend.com/domains → `mail.neuralreach.de`
2. Click **Verify DNS Records** (or wait ~5–10 min for auto-check)
3. All 5 rows should show a green ✓

DNS propagation typically takes 5–30 minutes. If records don't verify within 30 minutes, double-check that there are no duplicate or leftover records in your registrar.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| DKIM CNAME not verifying | Check for trailing dots in the value; some registrars add one automatically |
| SPF "softfail" instead of pass | Ensure the TXT is on `mail.neuralreach.de`, not `neuralreach.de` |
| Old records still showing | DNS TTL — wait up to the TTL value (usually 3600s = 1 hour) for old records to expire |
| Resend shows "pending" after 30 min | Use `dig TXT mail.neuralreach.de` to confirm records are live |
