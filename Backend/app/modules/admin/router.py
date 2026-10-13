from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import (
    AdminPaymentOut,
    AdminPlanOut,
    AdminRedemptionOut,
    AdminUserOut,
    DashboardStats,
    PayoutPaidIn,
    PayoutRejectIn,
    UserRoleUpdate,
)

# require_admin runs for every route on this router, so ownership/role
# checks never need to be repeated in the handlers below.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db)):
    return service.get_dashboard_stats(db)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(search: str | None = None, db: Session = Depends(get_db)):
    return service.list_users(db, search)


@router.post("/users/{user_id}/disable", response_model=AdminUserOut)
def disable_user(user_id: UUID, db: Session = Depends(get_db)):
    return service.set_user_active(db, user_id, False)


@router.post("/users/{user_id}/enable", response_model=AdminUserOut)
def enable_user(user_id: UUID, db: Session = Depends(get_db)):
    return service.set_user_active(db, user_id, True)


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def update_role(user_id: UUID, payload: UserRoleUpdate, db: Session = Depends(get_db)):
    return service.set_user_role(db, user_id, payload.role)


# ---- Money: streak-point payouts, WhatsApp plan payments and plans.


@router.get("/redemptions", response_model=list[AdminRedemptionOut])
def list_redemptions(status: str | None = None, db: Session = Depends(get_db)):
    """Streak-point payouts, newest first (?status=PENDING for the ones to pay)."""
    return service.redemptions(db, status)


@router.post("/redemptions/{redemption_id}/paid", response_model=AdminRedemptionOut)
def mark_paid(redemption_id: UUID, payload: PayoutPaidIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Only after the money has actually been sent: records the reference, who and when."""
    return service.decide_redemption(db, admin, redemption_id, True, payload.reference.strip(), None)


@router.post("/redemptions/{redemption_id}/reject", response_model=AdminRedemptionOut)
def reject(redemption_id: UUID, payload: PayoutRejectIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Refuses a payout (e.g. a wrong number); its points go back to the user."""
    return service.decide_redemption(db, admin, redemption_id, False, None, payload.note.strip())


@router.get("/payments", response_model=list[AdminPaymentOut])
def list_payments(db: Session = Depends(get_db)):
    """WhatsApp plan payments (Razorpay orders), newest first."""
    return service.payments(db)


@router.get("/whatsapp-plans", response_model=list[AdminPlanOut])
def list_plans(db: Session = Depends(get_db)):
    """WhatsApp plans: allowance, usage and period, newest first."""
    return service.plans(db)
