import re
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service

router = APIRouter(prefix="/wallet", tags=["wallet"])


class MilestoneOut(BaseModel):
    days: int
    amount: int
    points: int = 0
    reached: bool


class ChoiceOut(BaseModel):
    points: int
    amount: int
    available: bool


class RedemptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    amount: int
    points: int
    phone: str
    # PENDING (waiting for the payout), PAID, REJECTED (points given back)
    status: str
    payout_reference: str | None = None
    note: str | None = None
    decided_at: datetime | None = None
    created_at: datetime


class WalletOut(BaseModel):
    best_streak: int
    # Includes today's finished plans, like the dashboard; payouts use best_streak.
    live_best_streak: int = 0
    # Rupees (older app versions read these).
    earned: int
    redeemed: int
    balance: int
    points_unlocked: int
    points_redeemed: int
    points_available: int
    choices: list[ChoiceOut]
    milestones: list[MilestoneOut]
    redemptions: list[RedemptionOut]


class RedeemIn(BaseModel):
    phone: str
    # 500 (₹10) or 1000 (₹20). Older apps send amount (10 / 20) instead.
    points: int | None = Field(default=None, ge=1)
    amount: int | None = Field(default=None, ge=1)
    # Any unique string per tap (e.g. a UUID): repeating it returns the same redemption.
    request_id: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        compact = re.sub(r"[\s-]", "", value)
        if re.fullmatch(r"\d{10}", compact):
            compact = f"+91{compact}"
        if not re.fullmatch(r"\+\d{8,15}", compact):
            raise ValueError("Enter a valid mobile number, e.g. 9876543210.")
        return compact


@router.get("", response_model=WalletOut)
def get_wallet(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.summary(db, current_user)


@router.get("/redemptions", response_model=list[RedemptionOut])
def list_redemptions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.redemptions(db, current_user)


@router.post("/redeem", response_model=RedemptionOut, status_code=status.HTTP_201_CREATED)
def redeem(payload: RedeemIn, response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rate_limit.hit(f"wallet-redeem:{current_user.id}", limit=10, window_seconds=3600)
    redemption, created = service.redeem(db, current_user, payload.phone, payload.points, payload.amount, payload.request_id)
    if not created:
        response.status_code = status.HTTP_200_OK  # the same request again: the first redemption
    return redemption
