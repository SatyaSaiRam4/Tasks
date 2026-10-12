"""WhatsApp consent: a number gets reminders only after its owner verifies it.

Verification works the other way round from an SMS OTP, so it needs no extra
WhatsApp template: Memo shows a code, and the owner of the number sends
"MEMO <code>" from that number to Memo's WhatsApp number (the app opens
WhatsApp with the message ready). MSG91 forwards incoming messages to
POST /api/v1/whatsapp/inbound. "STOP" from a number stops all reminders to it;
to receive them again the owner verifies again.
"""

import hashlib
import hmac
import re
import secrets
from datetime import timedelta
from urllib.parse import quote

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import JWT_SECRET, MSG91_WHATSAPP_INTEGRATED_NUMBER
from app.core.timeutil import utc_now
from app.modules.auth.models import User

from .models import ContactStatus, WhatsAppContact

CODE_MINUTES = 30
STOP_WORDS = {"STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "BAND", "BANDH"}
CODE_PATTERN = re.compile(r"(?:MEMO\s*)?(\d{6})")


def _hash(phone: str, code: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


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


def start_verification(db: Session, user: User, phone: str) -> dict:
    """A fresh code for `phone`, to be sent from that number. Already verified: nothing to do."""
    contact = db.get(WhatsAppContact, phone)
    if contact and contact.status == ContactStatus.VERIFIED:
        return {"phone": phone, "status": contact.status.value, "code": None, "message": None, "link": None, "business_number": business_number(), "expires_at": None}
    if not business_number():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "WhatsApp isn't set up on the server yet.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = utc_now() + timedelta(minutes=CODE_MINUTES)
    if contact is None:
        contact = WhatsAppContact(phone=phone, status=ContactStatus.PENDING)
        db.add(contact)
    elif contact.status != ContactStatus.STOPPED:
        contact.status = ContactStatus.PENDING
    contact.code_hash = _hash(phone, code)
    contact.code_expires_at = expires
    contact.requested_by = user.id
    db.commit()
    message = f"MEMO {code}"
    return {
        "phone": phone,
        "status": contact.status.value,
        "code": code,
        "message": message,
        "link": f"https://wa.me/{business_number()}?text={quote(message)}",
        "business_number": business_number(),
        "expires_at": expires,
    }


def handle_inbound(db: Session, sender: str | None, text: str | None) -> str:
    """One incoming WhatsApp message. Returns what happened (for the log)."""
    phone = normalize(sender)
    if not phone:
        return "ignored: no sender"
    words = (text or "").strip().upper()
    contact = db.get(WhatsAppContact, phone)
    if words.split(" ")[0] in STOP_WORDS:
        if contact is None:
            contact = WhatsAppContact(phone=phone, status=ContactStatus.STOPPED)
            db.add(contact)
        contact.status = ContactStatus.STOPPED
        contact.stopped_at = utc_now()
        contact.code_hash = None
        contact.code_expires_at = None
        db.commit()
        return "stopped"
    match = CODE_PATTERN.search(words)
    if not match or contact is None or not contact.code_hash:
        return "ignored: no code waiting"
    if contact.code_expires_at is None or contact.code_expires_at < utc_now():
        return "ignored: code expired"
    if not hmac.compare_digest(contact.code_hash, _hash(phone, match.group(1))):
        return "ignored: wrong code"
    contact.status = ContactStatus.VERIFIED
    contact.verified_at = utc_now()
    contact.stopped_at = None
    contact.code_hash = None
    contact.code_expires_at = None
    db.commit()
    return "verified"


def _find(payload, keys: tuple[str, ...]):
    """The first value under any of `keys`, searching nested dicts and lists."""
    if isinstance(payload, dict):
        for key in keys:
            if key in payload and isinstance(payload[key], (str, int)):
                return str(payload[key])
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


def messages_from(payload) -> list[tuple[str | None, str | None]]:
    """(sender, text) pairs from an MSG91 inbound webhook body. MSG91's field
    names differ between its old and new webhooks, so several are accepted."""
    items = payload if isinstance(payload, list) else [payload]
    out = []
    for item in items:
        if isinstance(item, dict) and str(item.get("direction", "inbound")).lower() not in ("inbound", "incoming", "0", ""):
            continue
        sender = _find(item, ("customer_number", "customerNumber", "sender", "from", "mobile", "wa_id", "source"))
        text = None
        if isinstance(item, dict):
            content = item.get("content") or item.get("text") or item.get("message")
            if isinstance(content, dict):
                text = _find(content, ("text", "body", "message"))
            elif isinstance(content, str):
                text = content
        text = text or _find(item, ("text", "body", "message", "content"))
        out.append((sender, text))
    return out
