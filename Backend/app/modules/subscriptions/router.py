from datetime import datetime

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service

router = APIRouter(tags=["subscriptions"])


class PlanStatusOut(BaseModel):
    free_total: int
    free_used: int
    free_remaining: int
    # NONE (never bought), ACTIVE, USED_UP (all messages used, period not over), EXPIRED
    plan_status: str
    paid_remaining: int
    plan_messages_total: int
    plan_messages_used: int
    plan_starts_at: datetime | None
    plan_expires_at: datetime | None
    purchase_required: bool
    payments_enabled: bool
    payments_mode: str
    price_paise: int
    currency: str
    plan_messages: int
    plan_days: int
    pending_order_id: str | None


class OrderOut(BaseModel):
    order_id: str
    key_id: str
    amount_paise: int
    currency: str
    name: str
    description: str
    prefill_email: str
    prefill_name: str
    mode: str


class VerifyIn(BaseModel):
    # Only Razorpay's own ids and signature: amount, plan and user come from the server.
    razorpay_order_id: str = Field(min_length=4, max_length=64, pattern=r"^[A-Za-z0-9_]+$")
    razorpay_payment_id: str = Field(min_length=4, max_length=64, pattern=r"^[A-Za-z0-9_]+$")
    razorpay_signature: str = Field(min_length=16, max_length=128, pattern=r"^[A-Fa-f0-9]+$")


class VerifyOut(BaseModel):
    # PAID (plan active), PENDING (Razorpay hasn't confirmed yet: check again soon), FAILED, MISMATCH
    state: str
    plan: PlanStatusOut


@router.get("/subscriptions/whatsapp", response_model=PlanStatusOut)
def whatsapp_plan(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The account's WhatsApp allowance: free messages, plan, and whether a purchase is needed."""
    return service.summary(db, current_user)


@router.post("/subscriptions/whatsapp/order", response_model=OrderOut)
def start_purchase(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Starts a ₹30 WhatsApp plan purchase (the price comes from the server only)."""
    rate_limit.hit(f"plan-order:{current_user.id}", limit=10, window_seconds=3600)
    return service.create_order(db, current_user)


@router.post("/subscriptions/whatsapp/verify", response_model=VerifyOut)
def confirm_purchase(payload: VerifyIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """After checkout: checks Razorpay's signature, then the payment itself on Razorpay."""
    rate_limit.hit(f"plan-verify:{current_user.id}", limit=30, window_seconds=3600)
    state = service.verify_checkout(db, current_user, payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature)
    return {"state": state, "plan": service.summary(db, current_user)}


@router.post("/payments/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: str = Header(default=""),
    x_razorpay_event_id: str | None = Header(default=None),
):
    """Razorpay's server-to-server events (payment.captured, payment.failed,
    order.paid). Checked against RAZORPAY_WEBHOOK_SECRET over the raw body;
    a repeated event id is answered without doing anything again."""
    raw = await request.body()
    return {"result": service.handle_webhook(db, raw, x_razorpay_signature, x_razorpay_event_id)}
