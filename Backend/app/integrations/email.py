"""Transactional email (password reset codes).

Provider order: Resend (RESEND_API_KEY) -> SMTP (SMTP_USER/SMTP_PASSWORD) ->
console. The console fallback exists only for local development and is used
only when SMTP_DEBUG is true; otherwise an unconfigured send is a hard failure.
"""

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import (
    EMAIL_PROVIDER,
    RESEND_API_KEY,
    RESEND_FROM,
    SMTP_DEBUG,
    SMTP_FROM,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)

logger = logging.getLogger("email")


class EmailNotConfigured(RuntimeError):
    pass


class EmailSendFailed(RuntimeError):
    pass


def _send_resend(to: str, subject: str, text: str) -> None:
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={"from": RESEND_FROM, "to": [to], "subject": subject, "text": text},
        timeout=10.0,
    )
    response.raise_for_status()


def _login(smtp: smtplib.SMTP) -> None:
    try:
        smtp.login(SMTP_USER, SMTP_PASSWORD)
    except (smtplib.SMTPAuthenticationError, smtplib.SMTPServerDisconnected) as exc:
        # Gmail refuses (often by hanging up) anything but a 16-letter App Password.
        raise smtplib.SMTPException(
            f"SMTP login refused for {SMTP_USER} ({exc}). For Gmail, SMTP_PASSWORD must be a "
            "16-letter App Password from https://myaccount.google.com/apppasswords."
        ) from exc


def _send_smtp(to: str, subject: str, text: str) -> None:
    message = EmailMessage()
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM}>"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    # Port 465 speaks TLS from the first byte; 587 (and others) upgrade with STARTTLS.
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            _login(smtp)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            _login(smtp)
            smtp.send_message(message)


def send_email(to: str, subject: str, text: str) -> None:
    provider = EMAIL_PROVIDER
    try:
        if provider in ("auto", "resend") and RESEND_API_KEY:
            return _send_resend(to, subject, text)
        if provider in ("auto", "smtp") and SMTP_USER and SMTP_PASSWORD:
            return _send_smtp(to, subject, text)
    except (smtplib.SMTPException, OSError, httpx.HTTPError) as exc:
        # Wrong password, blocked port, provider outage: report it, don't crash.
        logger.error("Email to %s failed: %s", to, exc)
        raise EmailSendFailed(str(exc)) from exc
    if SMTP_DEBUG:
        logger.warning("[DEV EMAIL — no provider configured] to=%s subject=%s\n%s", to, subject, text)
        print(f"\n[DEV EMAIL] to={to} subject={subject}\n{text}\n", flush=True)
        return
    raise EmailNotConfigured("No email provider is configured.")


if __name__ == "__main__":
    # Send a test email with the configured provider and show the real error:
    #   python -m app.integrations.email you@example.com
    import sys

    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m app.integrations.email you@example.com")
    if RESEND_API_KEY and EMAIL_PROVIDER in ("auto", "resend"):
        print("Provider: Resend")
    elif SMTP_USER and SMTP_PASSWORD and EMAIL_PROVIDER in ("auto", "smtp"):
        print(f"Provider: SMTP {SMTP_HOST}:{SMTP_PORT} as {SMTP_USER}")
    else:
        raise SystemExit("No provider configured: set SMTP_USER (or SMTP_EMAIL) and SMTP_PASSWORD in Backend/.env.")
    try:
        send_email(sys.argv[1], "Memo test email", "If you can read this, Memo can send password-reset codes.")
    except EmailSendFailed as exc:
        raise SystemExit(f"Sending failed: {exc}")
    print("Sent. Check the inbox (and the spam folder).")
