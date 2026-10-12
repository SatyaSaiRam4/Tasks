import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.config import MSG91_INBOUND_SECRET
from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class VerifyIn(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, value: str) -> str:
        phone = service.normalize(value)
        if not phone:
            raise ValueError("Enter a WhatsApp number in international format, e.g. +919876543210.")
        return phone


class StatusOut(BaseModel):
    phone: str
    status: str  # NONE, PENDING (asked, waiting for YES), VERIFIED or STOPPED
    asked_at: datetime | None = None
    business_number: str = ""
    last_reply: str | None = None
    last_reply_at: datetime | None = None


@router.post("/verify", response_model=StatusOut)
def verify(payload: VerifyIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sends the number the "reply YES to allow Memo reminders" message (3 times a day at most)."""
    rate_limit.hit(f"wa-verify:{current_user.id}", limit=10, window_seconds=3600)
    rate_limit.hit(f"wa-verify-phone:{payload.phone}", limit=3, window_seconds=24 * 3600)
    return service.ask_permission(db, current_user, payload.phone)


@router.get("/status", response_model=StatusOut)
def contact_status(phone: str = Query(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    normalized = service.normalize(phone)
    if not normalized:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid number.")
    return service.describe(db, normalized)


@router.post("/inbound")
async def inbound(request: Request, token: str = Query(default=""), db: Session = Depends(get_db)):
    """MSG91 forwards incoming WhatsApp messages here (set the webhook URL to
    .../api/v1/whatsapp/inbound?token=<MSG91_INBOUND_SECRET>)."""
    if not MSG91_INBOUND_SECRET or token != MSG91_INBOUND_SECRET:
        # Logged, so a missing or wrong secret shows up in the server log.
        logger.warning("WhatsApp inbound refused: %s", "MSG91_INBOUND_SECRET is not set on the server" if not MSG91_INBOUND_SECRET else "wrong token in the webhook URL")
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    raw = await request.body()
    try:
        payload = json.loads(raw or b"{}")
    except ValueError:
        form = await request.form()
        payload = dict(form)
    messages = service.messages_from(payload)
    results = [service.handle_inbound(db, sender, text) for sender, text in messages]
    summary = [{"from": service.mask(service.normalize(s)), "text": (t or "")[:30], "result": r} for (s, t), r in zip(messages, results)]
    keys = sorted(payload.keys()) if isinstance(payload, dict) else f"list[{len(payload)}]"
    service.recent.appendleft({"at": datetime.now(timezone.utc).isoformat(), "keys": keys, "messages": summary})
    logger.info("WhatsApp inbound: %s (payload keys %s)", summary, keys)
    return {"ok": True, "results": results}


@router.get("/inbound/recent")
def recent_inbound(current_user: User = Depends(get_current_user)):
    """Admins: the last webhook calls (numbers masked), to check MSG91 is forwarding replies."""
    if current_user.role != "ADMIN" and getattr(current_user.role, "value", None) != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only.")
    return {"secret_set": bool(MSG91_INBOUND_SECRET), "calls": list(service.recent)}
