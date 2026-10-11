from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.streaks import engine

from .models import WalletRedemption

# (best streak points reached, rupees earned). Each milestone pays once, ever.
MILESTONES: list[tuple[int, int]] = [(500, 10), (1000, 20)]


def _best_streak(db: Session, user: User) -> int:
    # Only finished days count, so ticking and un-ticking today can't mint money.
    engine.finalize_user(db, user)
    return engine.get_or_create_state(db, user).best_streak


def _redeemed(db: Session, user: User) -> int:
    return db.scalar(select(func.coalesce(func.sum(WalletRedemption.amount), 0)).where(WalletRedemption.user_id == user.id))


def summary(db: Session, user: User) -> dict:
    best = _best_streak(db, user)
    # What the dashboard shows: today's finished plans count straight away.
    # Money still waits for the day to finish (see _best_streak).
    live = engine.today_status(db, user).best_streak
    earned = sum(amount for days, amount in MILESTONES if best >= days)
    redeemed = _redeemed(db, user)
    redemptions = db.scalars(
        select(WalletRedemption).where(WalletRedemption.user_id == user.id).order_by(WalletRedemption.created_at.desc())
    ).all()
    return {
        "best_streak": best,
        "live_best_streak": max(live, best),
        "earned": earned,
        "redeemed": redeemed,
        "balance": max(earned - redeemed, 0),
        "milestones": [{"days": d, "amount": a, "reached": best >= d} for d, a in MILESTONES],
        "redemptions": redemptions,
    }


def redeem(db: Session, user: User, phone: str, amount: int | None = None) -> WalletRedemption:
    # Lock the user row so two taps at once can't both pay out the balance.
    db.execute(select(User.id).where(User.id == user.id).with_for_update())
    best = _best_streak(db, user)
    balance = sum(amount for days, amount in MILESTONES if best >= days) - _redeemed(db, user)
    if balance <= 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "There's nothing to redeem yet.")
    # No amount means the whole balance (older app versions send none).
    amount = balance if amount is None else amount
    if amount > balance:
        raise HTTPException(status.HTTP_409_CONFLICT, f"You can redeem up to ₹{balance}.")
    redemption = WalletRedemption(user_id=user.id, amount=amount, phone=phone)
    db.add(redemption)
    db.commit()
    db.refresh(redemption)
    return redemption
