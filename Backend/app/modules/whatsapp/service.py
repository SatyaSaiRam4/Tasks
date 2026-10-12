"""WhatsApp consent: a number gets reminders only after its owner says YES.

No codes. When a user adds a WhatsApp number, Memo sends that number one
message through the approved reminder template: "<name> wants to send you
reminders from the Memo app… Reply YES to allow them, or STOP to never get
them." MSG91 forwards replies to POST /api/v1/whatsapp/inbound:

- YES (or START / OK / ALLOW / HAAN) marks the number VERIFIED. A YES the
  owner sends on their own (for example after STOP) counts too: it's theirs.
- STOP (or UNSUBSCRIBE / CANCEL / END / QUIT) marks it STOPPED: Memo never
  messages it again, and nobody can ask it again. Only its owner can turn
  reminders back on, by sending YES to Memo themselves.

A number can be asked at most once a day, so it can't be used to pester anyone.
"""

import json
import re
from collections import deque
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import MSG91_WHATSAPP_INTEGRATED_NUMBER, MSG91_WHATSAPP_TEMPLATE_STYLE
from app.core.timeutil import utc_now
from app.integrations.messages import consent_variables
from app.integrations.msg91 import is_configured, send_whatsapp_reminder
from app.modules.auth.models import User

from .models import ContactStatus, WhatsAppContact

ASK_AGAIN_AFTER = timedelta(hours=24)
STOP_WORDS = {"STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "BAND", "BANDH", "NO"}
YES_WORDS = {"YES", "Y", "YA", "YEAH", "YEP", "YES!", "OK", "OKAY", "ALLOW", "START", "HAAN", "HA", "HAN", "AGREE", "SURE"}
YES_EMOJI = ("👍", "✅", "👌")

# The last incoming messages (masked), so the app and admins can see whether
# replies reach the server at all. In memory: one API instance (see PROJECT.md).
recent: deque = deque(maxlen=50)
last_reply: dict[str, dict] = {}


def mask(phone: str | None) -> str:
    return f"…{phone[-4:]}" if phone and len(phone) > 4 else "?"


def normalize(phone: str | None) -> str | None:
    """+<digits> from anything with digits ("91 98765 43210", "whatsapp:+91…")."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) < 8 or len(digits) > 15:
        return None
    return "+" + digits


def business_number() -> str:
    return re.sub(r"\D", "", MSG91_WHATSAPP_INTEGRATED_NUMBER or "")


def contact_status(db: Session, phone: str) -> ContactStatus | None:
    contact = db.get(WhatsAppContact, phone)
    return contact.status if contact else None


def is_verified(db: Session, phone: str | None) -> bool:
    return bool(phone) and contact_status(db, phone) == ContactStatus.VERIFIED


def describe(db: Session, phone: str) -> dict:
    contact = db.get(WhatsAppContact, phone)
    reply = last_reply.get(phone)
    return {
        "phone": phone,
        "status": contact.status.value if contact else "NONE",
        "asked_at": contact.asked_at if contact else None,
        "business_number": business_number(),
        # The last message that reached the server from this number (since the server started), if any.
        "last_reply": reply["text"] if reply else None,
        "last_reply_at": reply["at"] if reply else None,
    }


def ask_permission(db: Session, user: User, phone: str) -> dict:
    """Sends the number one "reply YES to allow" message (at most once a day)."""
    contact = db.get(WhatsAppContact, phone)
    if contact and contact.status in (ContactStatus.VERIFIED, ContactStatus.STOPPED):
        # Verified: nothing to do. Stopped: only the owner can turn it back on.
        return describe(db, phone)
    now = utc_now()
    if contact and contact.asked_at and now - contact.asked_at < ASK_AGAIN_AFTER:
        return describe(db, phone)  # already asked today: just keep waiting for the reply
    if not is_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "WhatsApp isn't set up on the server yet.")
    if not send_whatsapp_reminder(phone, consent_variables(MSG91_WHATSAPP_TEMPLATE_STYLE, user.display_name)):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't send the WhatsApp message. Check the number and try again.")
    if contact is None:
        contact = WhatsAppContact(phone=phone, status=ContactStatus.PENDING)
        db.add(contact)
    contact.status = ContactStatus.PENDING
    contact.asked_at = now
    contact.requested_by = user.id
    db.commit()
    return describe(db, phone)


def classify(text: str | None) -> str | None:
    """'YES', 'STOP' or None, from a reply such as "Yes!", "stop please", "👍"."""
    raw = (text or "").strip()
    if any(e in raw for e in YES_EMOJI):
        return "YES"
    words = [re.sub(r"[^A-Z]", "", w) for w in raw.upper().split()]
    words = [w for w in words if w]
    if not words:
        return None
    if words[0] in STOP_WORDS:
        return "STOP"
    if words[0] in YES_WORDS:
        return "YES"
    return None


def handle_inbound(db: Session, sender: str | None, text: str | None) -> str:
    """One incoming WhatsApp message. Returns what happened (for the log)."""
    phone = normalize(sender)
    if not phone:
        return "ignored: no sender"
    last_reply[phone] = {"text": (text or "")[:60], "at": utc_now()}
    kind = classify(text)
    if kind is None:
        return "ignored: not YES or STOP"
    status_ = ContactStatus.STOPPED if kind == "STOP" else ContactStatus.VERIFIED
    contact = db.get(WhatsAppContact, phone)
    if contact is None:
        contact = WhatsAppContact(phone=phone, status=status_)
        db.add(contact)
    contact.status = status_
    if status_ == ContactStatus.VERIFIED:
        contact.verified_at = utc_now()
        contact.stopped_at = None
    else:
        contact.stopped_at = utc_now()
    db.commit()
    return "verified" if status_ == ContactStatus.VERIFIED else "stopped"


def _unpack(value):
    """Parses JSON hidden inside strings (MSG91 sometimes sends `content` as a JSON string)."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped[:1] in ("{", "["):
            try:
                return _unpack(json.loads(stripped))
            except ValueError:
                return value
        return value
    if isinstance(value, dict):
        return {k: _unpack(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_unpack(v) for v in value]
    return value


def _find(payload, keys: tuple[str, ...]):
    """The first text value under any of `keys`, searching nested dicts and lists."""
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if isinstance(value, (str, int)) and str(value).strip():
                return str(value)
        for value in payload.values():
            found = _find(value, keys)
            if found:
                return found
    elif isinstance(payload, list):
        for value in payload:
            found = _find(value, keys)
            if found:
                return found
    return None


SENDER_KEYS = ("customer_number", "customerNumber", "customer_mobile", "sender", "from", "mobile", "wa_id", "source", "phone")
TEXT_KEYS = ("text", "body", "message", "caption", "title", "payload", "content")


def messages_from(payload) -> list[tuple[str | None, str | None]]:
    """(sender, text) pairs from an MSG91 inbound webhook body. MSG91's formats
    differ between its old webhook, its new one and Meta's own shape, so this
    reads them all: JSON hidden in strings, Meta's entry/changes/messages,
    button and quick-reply answers. Only messages clearly marked outgoing (our
    own sends' delivery reports) are skipped."""
    payload = _unpack(payload)
    items = payload if isinstance(payload, list) else [payload]
    # Meta's shape: entry[].changes[].value.messages[]
    expanded = []
    for item in items:
        msgs = []
        if isinstance(item, dict):
            for entry in item.get("entry") or []:
                for change in (entry or {}).get("changes") or []:
                    msgs.extend(((change or {}).get("value") or {}).get("messages") or [])
            if isinstance(item.get("messages"), list):
                msgs.extend(item["messages"])
        expanded.extend(msgs or [item])
    out = []
    for item in expanded:
        if isinstance(item, dict) and "out" in str(item.get("direction", "")).lower():
            continue
        sender = _find(item, SENDER_KEYS)
        text = _find(item, TEXT_KEYS) if isinstance(item, dict) else None
        out.append((sender, text))
    return out
