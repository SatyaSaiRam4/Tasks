"""WhatsApp consent: a number gets reminders only after its owner says YES.

No codes. When a user adds a WhatsApp number, Memo sends that number one
short message through the approved reminder template: "<name> wants to send
you Memo reminders here. Reply YES to allow or STOP to refuse." MSG91
forwards replies to POST /api/v1/whatsapp/inbound:

- YES (or START / OK / ALLOW / HAAN) marks the number VERIFIED. A YES the
  owner sends on their own (for example after STOP) counts too: it's theirs.
- STOP (or UNSUBSCRIBE / CANCEL / END / QUIT / NO) marks it STOPPED at any
  time, even right after YES: nothing more goes there. It can be asked again
  ("Send again"), but after 3 refusals within a day only once that day is over.
- An emoji reply (👍 / 👎) is still read as YES / STOP, though the message
  only asks for the words.
- Anything else isn't a chat: WhatsApp can't stop people writing to a
  business number, so Memo answers once ("This number only sends Memo
  reminders. Messages here aren't read…"), at most once a day per number.

The app counts down 1 minute after asking; after that the request expires
and can be sent again, at most 3 times a day, so nobody can be pestered.
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
from app.integrations.msg91 import is_configured, send_whatsapp_reminder, send_whatsapp_text
from app.modules.auth.models import User

from .models import ContactStatus, WhatsAppAutoReply, WhatsAppContact, WhatsAppInboundLog

# The owner has this long to reply YES after being asked; after that the
# request expires and the user asks again (3 times a day at most: see the
# router). STOP always works.
ANSWER_WINDOW = timedelta(minutes=1)
# A YES that MSG91 delivers late still counts up to this long after the ask
# (the app shows the 1-minute countdown; the network can be slower).
LATE_GRACE = timedelta(minutes=10)
# After this many refusals within a day, the number can't be asked again until the day is over.
MAX_REFUSALS = 3
REFUSAL_PERIOD = timedelta(hours=24)
# What Memo answers to anything other than YES / STOP, once a day per number.
AUTO_REPLY = "This number only sends Memo reminders. Messages here aren't read. Reply STOP to stop getting reminders."
AUTO_REPLY_EVERY = timedelta(hours=24)
STOP_WORDS = {"STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "BAND", "BANDH", "NO"}
YES_WORDS = {"YES", "Y", "YA", "YEAH", "YEP", "YES!", "OK", "OKAY", "ALLOW", "START", "HAAN", "HA", "HAN", "AGREE", "SURE"}
YES_EMOJI = ("👍", "✅", "👌")
NO_EMOJI = ("👎", "❌", "🚫")

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


def _expired(contact: WhatsAppContact | None) -> bool:
    """Asked, but the answer window has passed without a YES."""
    return bool(
        contact
        and contact.status == ContactStatus.PENDING
        and (contact.asked_at is None or utc_now() - contact.asked_at > ANSWER_WINDOW)
    )


def _refusals_now(contact: WhatsAppContact | None) -> int:
    if not contact or not contact.refusals_since or utc_now() - contact.refusals_since > REFUSAL_PERIOD:
        return 0
    return contact.refusals


def try_again_at(contact: WhatsAppContact | None):
    """When a number that refused 3 times today can be asked again (None if it can be now)."""
    if _refusals_now(contact) >= MAX_REFUSALS:
        return contact.refusals_since + REFUSAL_PERIOD
    return None


def describe(db: Session, phone: str) -> dict:
    contact = db.get(WhatsAppContact, phone)
    reply = last_reply.get(phone)
    status_ = "EXPIRED" if _expired(contact) else (contact.status.value if contact else "NONE")
    return {
        "phone": phone,
        # NONE, PENDING (asked, inside the answer window), EXPIRED (no answer in time), VERIFIED or STOPPED
        "status": status_,
        "expires_at": contact.asked_at + ANSWER_WINDOW if contact and contact.asked_at and status_ == "PENDING" else None,
        "refusals_today": _refusals_now(contact),
        "try_again_at": try_again_at(contact),
        "asked_at": contact.asked_at if contact else None,
        "business_number": business_number(),
        # The last message that reached the server from this number (since the server started), if any.
        "last_reply": reply["text"] if reply else None,
        "last_reply_at": reply["at"] if reply else None,
    }


def ask_permission(db: Session, user: User, phone: str) -> dict:
    """Sends the number the "reply YES to allow" message (again once the 1-minute window has passed)."""
    contact = db.get(WhatsAppContact, phone)
    if contact and contact.status == ContactStatus.VERIFIED:
        return describe(db, phone)
    if try_again_at(contact):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "This number refused 3 times today. Try again tomorrow.")
    now = utc_now()
    if contact and not _expired(contact) and contact.status == ContactStatus.PENDING:
        return describe(db, phone)  # still inside the answer window: keep waiting
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
    if any(e in raw for e in NO_EMOJI):
        return "STOP"
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
    # A YES to an ask counts up to 10 minutes after it (MSG91 can be slow); a
    # YES the owner sends to a stopped number turns it back on.
    if (
        kind == "YES"
        and contact is not None
        and contact.status == ContactStatus.PENDING
        and (contact.asked_at is None or utc_now() - contact.asked_at > LATE_GRACE)
    ):
        return "ignored: answered more than 10 minutes after the ask"
    if kind == "YES" and contact is not None and contact.status == ContactStatus.VERIFIED:
        return "verified (already)"
    if contact is None:
        contact = WhatsAppContact(phone=phone, status=status_)
        db.add(contact)
    contact.status = status_
    if status_ == ContactStatus.VERIFIED:
        contact.verified_at = utc_now()
        contact.stopped_at = None
    else:
        contact.stopped_at = utc_now()
        # Count the refusal (a new 24-hour stretch starts after the last one ended).
        if not contact.refusals_since or utc_now() - contact.refusals_since > REFUSAL_PERIOD:
            contact.refusals = 0
            contact.refusals_since = utc_now()
        contact.refusals += 1
    db.commit()
    return "verified" if status_ == ContactStatus.VERIFIED else "stopped"


def claim_auto_reply(db: Session, phone: str) -> bool:
    """True if Memo should answer this number now (and records it first, so a
    webhook MSG91 sends twice never gets two answers); False if it answered
    within the last 24 hours."""
    now = utc_now()
    row = db.get(WhatsAppAutoReply, phone)
    if row and now - row.replied_at < AUTO_REPLY_EVERY:
        return False
    if row is None:
        db.add(WhatsAppAutoReply(phone=phone, replied_at=now))
    else:
        row.replied_at = now
    db.commit()
    return True


def send_auto_reply(phone: str) -> None:
    """Sends the "messages here aren't read" answer (run after the webhook has answered MSG91)."""
    send_whatsapp_text(phone, AUTO_REPLY)


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
TEXT_KEYS = ("text", "body", "message", "caption", "title", "payload", "emoji", "content")


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


def log_call(db: Session, token_ok: bool, summary: str, raw: bytes) -> None:
    """Keeps one webhook call in whatsapp_inbound_log, with phone numbers masked."""
    try:
        text_ = raw.decode("utf-8", "replace")
        masked = re.sub(r"(\+?\d{6,})(\d{4})", lambda m: "…" + m.group(2), text_)
        db.add(WhatsAppInboundLog(token_ok=token_ok, summary=summary[:2000], payload=masked[:4000]))
        db.commit()
    except Exception:  # noqa: BLE001 - logging must never break the webhook
        db.rollback()
