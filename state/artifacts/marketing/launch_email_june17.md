# NeuralReach — June 17 Launch Email (Waitlist Blast)

**Drafted:** 2026-06-11  
**Send date:** 2026-06-17 (morning, founder discretion on exact time)  
**From:** Jonas from NeuralReach `<jonas@neuralreach.de>`  
**To:** All rows in `waitlist` table (Supabase → `unrfdcxkmelafypuyruk`)  
**Format:** Plain text (no HTML). Matches the "founder email" pattern used in email_nurture_sequence.md.

---

## Subject line

```
Subscriptions are open — NeuralReach is live
```

---

## Body (plain text)

```
Hi,

You signed up to find out whether your brand shows up when buyers ask ChatGPT, Perplexity, Claude, or Google AI which tool to use. Now you can find out. NeuralReach delivers weekly AI visibility reports — showing exactly where you appear (or don't) across the four major AI search engines, plus the specific content fixes to close the gap on your competitors.

Subscriptions opened today. Starter is $39/mo (25 prompts, 4 LLMs). Pro is $89/mo (100 prompts + competitor tracking):

Start for $39/mo → https://neuralreach.de/pricing

— Jonas
NeuralReach
```

---

## How to send

### Option A — Resend Broadcasts (recommended, no code)

1. Log in to [resend.com](https://resend.com) with the NeuralReach account.
2. Go to **Broadcasts → New Broadcast**.
3. Audience: export waitlist emails from Supabase first (step below), then import as a CSV audience.
4. Paste the subject and body above. Set sender to `Jonas from NeuralReach <jonas@neuralreach.de>`.
5. Send a test to yourself first (`jonas@neuralreach.de`), confirm it renders correctly.
6. Schedule or send immediately on June 17.

### Option B — Resend API batch send (manual script)

Pull waitlist emails from Supabase:

```sql
-- Run in Supabase SQL editor
SELECT email FROM waitlist ORDER BY signed_up_at ASC;
```

Then POST to Resend batch endpoint:

```bash
curl -X POST https://api.resend.com/emails/batch \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "from": "Jonas from NeuralReach <jonas@neuralreach.de>",
      "to": ["subscriber@example.com"],
      "subject": "Subscriptions are open — NeuralReach is live",
      "text": "Hi,\n\nYou signed up to find out whether your brand shows up when buyers ask ChatGPT, Perplexity, Claude, or Google AI which tool to use. Now you can find out. NeuralReach delivers weekly AI visibility reports — showing exactly where you appear (or don't) across the four major AI search engines, plus the specific content fixes to close the gap on your competitors.\n\nSubscriptions opened today. Starter is $39/mo (25 prompts, 4 LLMs). Pro is $89/mo (100 prompts + competitor tracking):\n\nStart for $39/mo → https://neuralreach.de/pricing\n\n— Jonas\nNeuralReach"
    }
  ]'
```

Repeat for each subscriber, or generate the full batch array programmatically. Resend batch accepts up to 100 per call.

### Option C — Future: add `/api/waitlist/blast` endpoint

No blast endpoint exists today. If the list grows large enough to warrant automation, the engineer can add a `POST /api/waitlist/blast` route that:
- Requires an `ADMIN_SECRET` header
- Queries `waitlist` table
- Posts to Resend batch API
- Returns send counts

This is Phase 2 work; not needed for a one-time June 17 send.

---

## Pre-send checklist

- [ ] `jonas@neuralreach.de` has ≥ 7 days sender history (confirmed warm by June 17)
- [ ] Resend domain `neuralreach.de` verified (DKIM/SPF records set)
- [ ] Stripe `success_url` resolves to `https://neuralreach.de/dashboard?checkout=success` (not localhost)
- [ ] `/pricing` page loads and Stripe checkout opens correctly in production
- [ ] End-to-end test passed: pay → welcome email → login → add brand → report appears
- [ ] Send a test email to `jonas@neuralreach.de` before blast

---

## Approval required

Sending this email to external subscribers is a `public_post` category action. An approval entry must be created in `state/approvals.json` before any blast goes out. The founder executes the send directly via Resend dashboard or the curl commands above.
