import re
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service

router = APIRouter(prefix="/wallet", tags=["wallet"])


class MilestoneOut(BaseModel):
    days: int
    amount: int
    reached: bool


class RedemptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    amount: int
    phone: str
    status: str
    created_at: datetime


class WalletOut(BaseModel):
    best_streak: int
    earned: int
    redeemed: int
    balance: int
    milestones: list[MilestoneOut]
    redemptions: list[RedemptionOut]


class RedeemIn(BaseModel):
    phone: str
    amount: int | None = Field(default=None, ge=1)

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


@router.post("/redeem", response_model=RedemptionOut, status_code=status.HTTP_201_CREATED)
def redeem(payload: RedeemIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.redeem(db, current_user, payload.phone, payload.amount)
