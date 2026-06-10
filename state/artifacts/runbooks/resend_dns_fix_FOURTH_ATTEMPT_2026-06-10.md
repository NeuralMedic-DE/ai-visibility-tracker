# Runbook: Resend DNS Fix — FOURTH ATTEMPT (2026-06-10)
# ⛔ THREE PREVIOUS ATTEMPTS FAILED. READ EVERY LINE.

**Why three attempts failed:**  
The **DKIM CNAME** (`resend._domainkey.mail.neuralreach.de`) has **never been added** in any previous attempt.  
Additionally, the SPF TXT on `mail.neuralreach.de` still has the wrong value (AWS inbound endpoint, not Resend SPF).  
Without the DKIM CNAME, Resend rejects all sends silently — welcome emails, OTP login codes, weekly digests: all 403-ing.

**Verified broken DNS right now (2026-06-10):**
```
dig +short resend._domainkey.mail.neuralreach.de CNAME  →  (EMPTY — this record has NEVER been added)
dig +short mail.neuralreach.de TXT                      →  "inbound-smtp.eu-west-1.amazonaws.com" (WRONG — not SPF)
dig +short _dmarc.mail.neuralreach.de TXT               →  (EMPTY — DMARC on wrong location)
dig +short _dmarc.neuralreach.de TXT                    →  "v=DMARC1; p=none;" (stale stub on apex, not subdomain)
```

**Zero emails have been delivered since the product launched.** OTP login codes are failing. Fix this before any other work.

---

## Time: 15–20 minutes total
## Registrar: united-domains.de (where neuralreach.de is registered)

---

## PHASE 1 — Get the DKIM CNAME values from Resend (DO THIS FIRST)

The DKIM values are **unique to your Resend account**. You must copy them from the dashboard — they cannot be guessed.

1. Go to **https://resend.com/domains**
2. Click on **`mail.neuralreach.de`** in the list
3. You will see a table with **5 DNS records** that Resend requires
4. **SCREENSHOT this table or keep the tab open.** You will need the exact values.
5. The table will look like:

| Type | Name | Value |
|------|------|-------|
| TXT | `mail.neuralreach.de` | `v=spf1 include:amazonses.com ~all` |
| CNAME | `resend._domainkey.mail.neuralreach.de` | `resend._domainkey.XXXXXXXX.dkim.amazonses.com` ← **YOUR UNIQUE VALUE** |
| CNAME | (2nd DKIM key — shown in dashboard) | (unique value) |
| CNAME | (3rd DKIM key — shown in dashboard) | (unique value) |
| TXT | `_dmarc.mail.neuralreach.de` | `v=DMARC1; p=none;` |

> ⚠️ The CNAME values contain a hex string unique to your Resend account. They look like:
> `resend._domainkey.abc123ef.dkim.amazonses.com`
> Do NOT use placeholder values. Copy the exact string from the Resend dashboard.

---

## PHASE 2 — Fix DNS at united-domains.de

1. Go to **https://www.united-domains.de** → Log in
2. Navigate to: **Meine Domains → neuralreach.de → DNS-Einträge / DNS-Verwaltung**
3. You are looking at DNS records for the entire `neuralreach.de` zone.

---

### STEP A — DELETE the wrong TXT record (most important delete)

Find and **DELETE** this record:
- Type: `TXT`
- Name/Host: `mail` or `mail.neuralreach.de`
- Current wrong value: `inbound-smtp.eu-west-1.amazonaws.com`

> This record is corrupted — someone added an AWS inbound SMTP endpoint as a TXT record. It is completely wrong and must be removed.

---

### STEP B — ADD the correct SPF TXT record

Add a new record:
```
Type:  TXT
Name:  mail
Value: v=spf1 include:amazonses.com ~all
TTL:   3600
```

> In united-domains.de the Name field might need to be `mail` (just the prefix) or `mail.neuralreach.de` (full). Match the format of your other records.

---

### STEP C — ADD the DKIM CNAME records (THE MISSING PIECE)

This is what has been missing in all previous attempts. Add **each of the 3 DKIM CNAMEs** shown in your Resend dashboard.

**For each CNAME record shown in Resend, add:**

```
Type:   CNAME
Name:   [exactly as shown in Resend, e.g. "resend._domainkey.mail"]
Value:  [exactly as shown in Resend, e.g. "resend._domainkey.abc123ef.dkim.amazonses.com"]
TTL:    3600
```

> Note on the Name field: Resend shows the full hostname (`resend._domainkey.mail.neuralreach.de`).  
> united-domains.de may want just the prefix (`resend._domainkey.mail`).  
> If adding the full hostname fails, try the prefix only.

---

### STEP D — ADD or UPDATE the DMARC TXT record

The DMARC record must be on `_dmarc.mail.neuralreach.de` (note: `mail` subdomain, NOT just `_dmarc.neuralreach.de`).

```
Type:  TXT
Name:  _dmarc.mail
Value: v=DMARC1; p=none; rua=mailto:dmarc@neuralreach.de
TTL:   3600
```

> There is a separate `_dmarc.neuralreach.de` record (`v=DMARC1; p=none;`) — leave that one alone, it's for the apex domain. This is an ADDITIONAL record for the mail subdomain.

---

## PHASE 3 — Verify

After saving all DNS changes, wait 5–10 minutes for propagation, then:

### Quick verify from terminal:
```bash
# Should return the DKIM CNAME value (not empty):
dig +short resend._domainkey.mail.neuralreach.de CNAME

# Should return: "v=spf1 include:amazonses.com ~all"
dig +short mail.neuralreach.de TXT

# Should return DMARC with rua=:
dig +short _dmarc.mail.neuralreach.de TXT
```

### In Resend dashboard:
1. Go back to https://resend.com/domains → `mail.neuralreach.de`
2. Click **"Verify DNS Records"**
3. All rows must show ✅ green

---

## PHASE 4 — Confirm email is live

Once Resend shows ✅ verified:

1. In Vercel dashboard → neuralreach-app → Settings → Environment Variables
2. Confirm `EMAIL_DRY_RUN` is **not set** (or is `false` or `0`) in **Production**
3. Do a test login via OTP → you should receive the email within 30 seconds

---

## Summary of ALL changes needed

| Action | Record | Old value | New value |
|--------|--------|-----------|-----------|
| DELETE | TXT `mail.neuralreach.de` | `inbound-smtp.eu-west-1.amazonaws.com` | (deleted) |
| ADD | TXT `mail.neuralreach.de` | (missing) | `v=spf1 include:amazonses.com ~all` |
| ADD | CNAME `resend._domainkey.mail.neuralreach.de` | (MISSING — NEVER ADDED) | copy from Resend dashboard |
| ADD | CNAME (2nd DKIM key) | (missing) | copy from Resend dashboard |
| ADD | CNAME (3rd DKIM key) | (missing) | copy from Resend dashboard |
| ADD | TXT `_dmarc.mail.neuralreach.de` | (missing) | `v=DMARC1; p=none; rua=mailto:dmarc@neuralreach.de` |

**Do NOT touch:** `_dmarc.neuralreach.de` (apex DMARC for Google Workspace), `neuralreach.de MX` (Google Workspace MX), any A records.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CNAME value has trailing dot | Some registrars add a trailing dot automatically — that's fine, Resend handles it |
| Records not propagating after 30 min | Run `dig +short resend._domainkey.mail.neuralreach.de CNAME` — if still empty, the record wasn't saved |
| Resend shows "some records unverified" | Almost always the DKIM CNAME. Double-check the Name field — use just the prefix without the zone (`resend._domainkey.mail`, not the full FQDN) |
| Still failing after 1 hour | Share a screenshot of the DNS editor in united-domains.de — the formatting of the Name field is the most common issue |
