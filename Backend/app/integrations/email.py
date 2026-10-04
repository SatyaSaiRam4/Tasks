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


def _send_resend(to: str, subject: str, text: str) -> None:
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={"from": RESEND_FROM, "to": [to], "subject": subject, "text": text},
        timeout=10.0,
    )
    response.raise_for_status()


def _send_smtp(to: str, subject: str, text: str) -> None:
    message = EmailMessage()
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM}>"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.send_message(message)


def send_email(to: str, subject: str, text: str) -> None:
    provider = EMAIL_PROVIDER
    if provider in ("auto", "resend") and RESEND_API_KEY:
        return _send_resend(to, subject, text)
    if provider in ("auto", "smtp") and SMTP_USER and SMTP_PASSWORD:
        return _send_smtp(to, subject, text)
    if SMTP_DEBUG:
        logger.warning("[DEV EMAIL — no provider configured] to=%s subject=%s\n%s", to, subject, text)
        print(f"\n[DEV EMAIL] to={to} subject={subject}\n{text}\n", flush=True)
        return
    raise EmailNotConfigured("No email provider is configured.")
