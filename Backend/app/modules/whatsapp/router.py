import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from datetime import datetime
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


@router.post("/verify", response_model=StatusOut)
def verify(payload: VerifyIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sends the number one "reply YES to allow Memo reminders" message (at most once a day)."""
    rate_limit.hit(f"wa-verify:{current_user.id}", limit=5, window_seconds=3600)
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
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    try:
        payload = await request.json()
    except ValueError:
        form = await request.form()
        payload = dict(form)
    results = [service.handle_inbound(db, sender, text) for sender, text in service.messages_from(payload)]
    logger.info("WhatsApp inbound: %s", results)
    return {"ok": True, "results": results}
