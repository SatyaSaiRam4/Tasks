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


class VerifyOut(BaseModel):
    phone: str
    status: str
    code: str | None
    message: str | None
    link: str | None
    business_number: str
    expires_at: datetime | None


class StatusOut(BaseModel):
    phone: str
    status: str  # NONE, PENDING, VERIFIED or STOPPED


@router.post("/verify", response_model=VerifyOut)
def verify(payload: VerifyIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """A code for the number's owner to send from that number ("MEMO 123456")."""
    rate_limit.hit(f"wa-verify:{current_user.id}", limit=6, window_seconds=600)
    rate_limit.hit(f"wa-verify-phone:{payload.phone}", limit=6, window_seconds=3600)
    return service.start_verification(db, current_user, payload.phone)


@router.get("/status", response_model=StatusOut)
def contact_status(phone: str = Query(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    normalized = service.normalize(phone)
    if not normalized:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid number.")
    found = service.contact_status(db, normalized)
    return StatusOut(phone=normalized, status=found.value if found else "NONE")


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
