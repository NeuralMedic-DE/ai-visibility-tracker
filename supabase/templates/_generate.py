"""Generate all Supabase Auth email templates from a shared NeuralReach
branded layout, so the design matches the Resend transactional templates
in `lib/email-templates/`.

Run:
    python3 supabase/templates/_generate.py

Outputs (overwrites in place):
    supabase/templates/magic_link.html
    supabase/templates/confirm_signup.html
    supabase/templates/reset_password.html
    supabase/templates/change_email.html
    supabase/templates/invite_user.html
    supabase/templates/reauthentication.html
    supabase/templates/_paste_guide.md   <- subject lines + paste instructions

Supabase Auth uses Go-template placeholders. The ones we use:
    {{ .Token }}             - 6-digit OTP code
    {{ .ConfirmationURL }}   - full confirmation URL (signed token + redirect)
    {{ .Email }}             - the user's email
    {{ .NewEmail }}          - new email for change-email flow
    {{ .SiteURL }}           - configured Supabase Auth site URL

These MUST be in the template verbatim; Supabase substitutes them at send
time. Don't escape them, don't change the casing.
"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parent

# ── Brand palette (matches lib/email-templates/layout.ts) ──────────────────
BRAND_BLUE      = "#0284c7"
INK             = "#1f2937"
MUTED           = "#64748b"
HAIRLINE        = "#e2e8f0"
PAGE_BG         = "#f8fafc"
CARD_BG         = "#ffffff"


def wrap(body: str, preheader: str, title: str = "NeuralReach") -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:{PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{INK};-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:{PAGE_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:{PAGE_BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:{CARD_BG};border:1px solid {HAIRLINE};border-radius:12px;">
<!-- Wordmark header -->
<tr><td style="padding:24px 32px 16px 32px;border-bottom:1px solid {HAIRLINE};">
<div style="font-size:15px;font-weight:700;color:{BRAND_BLUE};letter-spacing:0.4px;">
NEURALREACH
</div>
<div style="font-size:12px;color:{MUTED};margin-top:2px;">
AI Search Visibility for B2B SaaS
</div>
</td></tr>
<!-- Body -->
<tr><td style="padding:28px 32px;font-size:16px;line-height:1.6;color:{INK};">
{body}
</td></tr>
<!-- Footer -->
<tr><td style="padding:16px 32px 24px 32px;border-top:1px solid {HAIRLINE};font-size:13px;line-height:1.5;color:{MUTED};">
<p style="margin:0 0 6px 0;">Jonas Heinzmann &nbsp;&middot;&nbsp; NeuralMedic / NeuralReach</p>
<p style="margin:0;">
Reply to this email or write to <a href="mailto:jonas@neuralreach.de" style="color:{BRAND_BLUE};text-decoration:none;">jonas@neuralreach.de</a>.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def button(href: str, label: str) -> str:
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px 0;">'
        f'<tr><td style="border-radius:8px;background:{BRAND_BLUE};">'
        f'<a href="{href}" style="display:inline-block;padding:11px 22px;font-size:15px;'
        'font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">'
        f'{label}</a></td></tr></table>'
    )


def otp_block(token: str = "{{ .Token }}") -> str:
    """Big 6-digit OTP, monospace, centered. Used by magic_link + signup."""
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:8px 0 18px 0;width:100%;">'
        '<tr><td align="center" '
        f'style="background:{PAGE_BG};border:1px solid {HAIRLINE};border-radius:10px;padding:18px 12px;">'
        f'<div style="font-family:ui-monospace,Menlo,Monaco,\'Courier New\',monospace;'
        f'font-size:36px;font-weight:700;letter-spacing:8px;color:{INK};">'
        f'{token}</div>'
        f'<div style="font-size:12px;color:{MUTED};margin-top:8px;">'
        f'Code expires in 10 minutes. Do not share it.</div>'
        '</td></tr></table>'
    )


# ── Per-template content ──────────────────────────────────────────────────

TEMPLATES = {
    "magic_link": {
        "subject": "Your NeuralReach sign-in code: {{ .Token }}",
        "preheader": "Enter the 6-digit code below to sign in. Expires in 10 minutes.",
        "body": (
            '<p style="margin:0 0 14px 0;font-size:17px;font-weight:500;">'
            'Your NeuralReach sign-in code:</p>'
            + otp_block()
            + '<p style="margin:0 0 14px 0;">Or click this link to sign in directly:</p>'
            + button("{{ .ConfirmationURL }}", "Sign in to NeuralReach")
            + f'<p style="margin:18px 0 0 0;font-size:13px;color:{MUTED};">'
            'If you did not request this code, you can ignore this email. '
            'Nobody can sign in without it.</p>'
        ),
    },
    "confirm_signup": {
        "subject": "Confirm your NeuralReach account",
        "preheader": "One click to confirm your account and start tracking your brand in AI search.",
        "body": (
            '<p style="margin:0 0 14px 0;font-size:17px;font-weight:500;">'
            'Welcome to NeuralReach.</p>'
            '<p style="margin:0 0 14px 0;">Click below to confirm your account. '
            'After confirmation we run your first AI visibility report automatically.</p>'
            + button("{{ .ConfirmationURL }}", "Confirm Account")
            + f'<p style="margin:18px 0 0 0;font-size:13px;color:{MUTED};">'
            'If you did not sign up for NeuralReach, you can safely ignore this email.</p>'
        ),
    },
    "reset_password": {
        "subject": "Reset your NeuralReach password",
        "preheader": "Click the button to set a new password for your NeuralReach account.",
        "body": (
            '<p style="margin:0 0 14px 0;font-size:17px;font-weight:500;">'
            'Reset your password</p>'
            '<p style="margin:0 0 14px 0;">'
            'Someone requested a password reset for your NeuralReach account. '
            'If that was you, click below to set a new password.</p>'
            + button("{{ .ConfirmationURL }}", "Reset Password")
            + f'<p style="margin:18px 0 0 0;font-size:13px;color:{MUTED};">'
            'If you did not request this, you can ignore this email. '
            'Your password will not change until you click the link above.</p>'
        ),
    },
    "change_email": {
        # The Change-Email template fires twice when double_confirm_changes=true
        # in supabase/config.toml: once to the OLD address and once to the NEW
        # address. Supabase's template engine does not expose a variable that
        # tells you which one you are rendering, so the copy is kept
        # symmetric: it works whether the recipient is the old or new mailbox.
        # Supabase Auth does NOT expose `{{ .NewEmail }}` either; the only
        # email-related variable is `{{ .Email }}`, and what it points to
        # depends on which side of the confirmation we are on. Safer to omit.
        "subject": "Confirm your NeuralReach email change",
        "preheader": "Click to confirm the email change on your NeuralReach account.",
        "body": (
            '<p style="margin:0 0 14px 0;font-size:17px;font-weight:500;">'
            'Confirm your email change</p>'
            '<p style="margin:0 0 14px 0;">'
            'A request was made to change the email address on your NeuralReach '
            'account. Click below to confirm and complete the change.</p>'
            + button("{{ .ConfirmationURL }}", "Confirm Email Change")
            + f'<p style="margin:18px 0 0 0;font-size:13px;color:{MUTED};">'
            'If you did not request this change, please write to jonas@neuralreach.de '
            'right away. Until you click the link, the change does not take effect.</p>'
        ),
    },
    "invite_user": {
        "subject": "You have been invited to NeuralReach",
        "preheader": "Accept your invite to start tracking brand visibility across ChatGPT, Claude and Perplexity.",
        "body": (
            '<p style="margin:0 0 14px 0;font-size:17px;font-weight:500;">'
            'You have been invited to NeuralReach.</p>'
            '<p style="margin:0 0 14px 0;">'
            'NeuralReach tracks how brands appear across ChatGPT, Claude, Perplexity '
            'and Google AI Overviews. Click below to accept your invite and set up '
            'your account.</p>'
            + button("{{ .ConfirmationURL }}", "Accept Invite")
            + f'<p style="margin:18px 0 0 0;font-size:13px;color:{MUTED};">'
            'This invite link expires in 24 hours. If you were not expecting this '
            'invite, you can safely ignore the email.</p>'
        ),
    },
    "reauthentication": {
        "subject": "Confirm it is you: NeuralReach action code {{ .Token }}",
        "preheader": "Enter the code to confirm a sensitive action on your account.",
        "body": (
            '<p style="margin:0 0 14px 0;font-size:17px;font-weight:500;">'
            'Confirm a sensitive action on your account</p>'
            '<p style="margin:0 0 14px 0;">'
            'For your security we need to confirm it is you before completing this '
            'action. Enter the code below in the NeuralReach app to continue.</p>'
            + otp_block()
            + f'<p style="margin:18px 0 0 0;font-size:13px;color:{MUTED};">'
            'If you did not just trigger a sensitive action (changing email, '
            'enabling 2FA, deleting your account), please reply to this email '
            'immediately so we can secure the account.</p>'
        ),
    },
}


def main() -> int:
    written = []
    for name, spec in TEMPLATES.items():
        html = wrap(spec["body"], spec["preheader"], title=spec["subject"])
        out_path = OUT / f"{name}.html"
        out_path.write_text(html)
        written.append((name, spec["subject"]))
        print(f"wrote {out_path.relative_to(OUT.parent.parent)}")

    # Generate a paste guide
    guide = ["# Supabase Auth Email Templates — Paste Guide", "",
             "Where to paste:",
             "https://supabase.com/dashboard/project/unrfdcxkmelafypuyruk/auth/templates",
             "", "For each template below:",
             "1. Click into the matching tab in the Supabase Dashboard.",
             "2. Paste the SUBJECT into the 'Subject' field (verbatim, including `{{ .Token }}` placeholders).",
             "3. Paste the contents of the corresponding HTML file into the 'Message body' field.",
             "4. Click Save.",
             "", "All 6 templates share the NeuralReach branded layout (wordmark header, white card, brand-blue CTA, footer). Updating any single template only affects the one tab you save.",
             "", "---", ""]

    DASHBOARD_LABELS = {
        "confirm_signup":   "Confirm signup",
        "invite_user":      "Invite user",
        "magic_link":       "Magic Link",
        "change_email":     "Change Email Address",
        "reset_password":   "Reset Password",
        "reauthentication": "Reauthentication",
    }

    for name, subject in written:
        label = DASHBOARD_LABELS.get(name, name)
        guide.append(f"## {label}")
        guide.append("")
        guide.append(f"**Tab in dashboard:** `{label}`")
        guide.append(f"**Subject:** `{subject}`")
        guide.append(f"**Body file:** `supabase/templates/{name}.html`")
        guide.append("")

    (OUT / "_paste_guide.md").write_text("\n".join(guide) + "\n")
    print(f"\nwrote supabase/templates/_paste_guide.md")
    print(f"\n{len(written)} templates generated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
