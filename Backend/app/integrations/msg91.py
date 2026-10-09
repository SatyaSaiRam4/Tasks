"""MSG91 WhatsApp integration for the reminder side-channel.

This calls MSG91's template-message send API. MSG91 (like all WhatsApp
Business API providers) requires the message to use a pre-approved template
outside the 24-hour customer-service window, so you must have:

  1. An MSG91 account with WhatsApp enabled and a verified sender number.
  2. An approved message template with exactly one body variable (e.g.
     "Reminder: {{task_name}}" — MSG91 lets you give the variable a readable
     name in the template studio, but the send API still addresses it
     positionally as `body_1` regardless of that display name). If your
     approved template has a different number of variables, adjust the
     `components` dict built in `send_whatsapp_reminder` below to match.

Set MSG91_AUTH_KEY, MSG91_WHATSAPP_INTEGRATED_NUMBER,
MSG91_WHATSAPP_TEMPLATE_NAME, and MSG91_WHATSAPP_NAMESPACE in Backend/.env.
Leaving MSG91_AUTH_KEY blank disables sending (reminders still work as local
push notifications on the device either way).

The request shape below was confirmed delivering real WhatsApp messages
(2026-10-04), copied directly from MSG91's own auto-generated sample code
for this account's approved template — `namespace` IS required (MSG91's
dashboard shows it per-template under Templates → Code{JSON}), and the
`/bulk/` endpoint is the one that actually works, not the non-bulk one.
"""

import logging

import httpx

from app.core.config import (
    MSG91_AUTH_KEY,
    MSG91_WHATSAPP_INTEGRATED_NUMBER,
    MSG91_WHATSAPP_NAMESPACE,
    MSG91_WHATSAPP_TEMPLATE_NAME,
)

MSG91_WHATSAPP_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"

logger = logging.getLogger("msg91")


def is_configured() -> bool:
    return bool(
        MSG91_AUTH_KEY
        and MSG91_WHATSAPP_INTEGRATED_NUMBER
        and MSG91_WHATSAPP_TEMPLATE_NAME
        and MSG91_WHATSAPP_NAMESPACE
    )


def send_whatsapp_reminder(to_number: str, message: str) -> bool:
    """Sends `message` as the single body variable of the configured
    template to `to_number` (E.164, e.g. +919876543210). Returns True on a
    2xx response from MSG91, False otherwise (never raises, so a WhatsApp
    outage never breaks the reminder itself)."""
    if not is_configured():
        return False

    bare_number = to_number.lstrip("+")
    payload = {
        "integrated_number": MSG91_WHATSAPP_INTEGRATED_NUMBER,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": MSG91_WHATSAPP_TEMPLATE_NAME,
                "language": {"code": "en", "policy": "deterministic"},
                "namespace": MSG91_WHATSAPP_NAMESPACE,
                "to_and_components": [
                    {
                        "to": [bare_number],
                        "components": {"body_1": {"type": "text", "value": message}},
                    }
                ],
            },
        },
    }
    headers = {"authkey": MSG91_AUTH_KEY, "Content-Type": "application/json"}

    try:
        response = httpx.post(MSG91_WHATSAPP_URL, json=payload, headers=headers, timeout=10.0)
    except httpx.HTTPError as exc:
        logger.warning("MSG91 request to %s failed: %s", bare_number, exc)
        return False

    # MSG91 can answer 200 with {"hasError": true, ...}; that is not a send.
    try:
        body = response.json()
    except ValueError:
        body = {}
    if not response.is_success or (isinstance(body, dict) and body.get("hasError")):
        logger.warning("MSG91 rejected WhatsApp to %s: HTTP %s %s", bare_number, response.status_code, response.text[:300])
        return False
    logger.info("MSG91 accepted WhatsApp to %s (request_id=%s)", bare_number, body.get("request_id") if isinstance(body, dict) else None)
    return True
