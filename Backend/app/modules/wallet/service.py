"""The wallet: streak points that turn into money.

  * Points are unlocked by best-streak milestones, each once, ever: 500 points
    at a best streak of 500 and 1000 more at 1000 (1500 in all). The best
    streak never goes down, so unlocked points never shrink, and redeeming
    never touches the streak, badges or milestones.
  * Spendable points = unlocked points - points in PENDING or PAID
    redemptions (a REJECTED redemption gives its points back).
  * A redemption spends exactly 500 points (₹10) or 1000 points (₹20). The
    choice, the rupees and the points are fixed here, never taken from the app.
  * The account row is locked while a redemption is made, so two requests at
    once can't spend the same points; an optional request id makes a repeated
    request return the first redemption instead of creating another.
"""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import timeutil
from app.modules.auth.models import User
from app.modules.streaks import engine
from app.modules.streaks.models import StreakState

from .models import WalletRedemption

# (best streak reached, points unlocked). Each milestone unlocks once, ever.
MILESTONES: list[tuple[int, int]] = [(500, 500), (1000, 1000)]
# What can be redeemed: (points, rupees). 50 points = ₹1.
CHOICES: list[tuple[int, int]] = [(500, 10), (1000, 20)]
POINTS_PER_RUPEE = 50


def _best_streak(db: Session, user: User) -> int:
    # Only finished days count, so ticking and un-ticking today can't mint money.
    engine.finalize_user(db, user)
    return engine.get_or_create_state(db, user).best_streak


def _unlocked(best: int) -> int:
    return sum(points for days, points in MILESTONES if best >= days)


def _spent(db: Session, user: User) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(WalletRedemption.points), 0)).where(
            WalletRedemption.user_id == user.id, WalletRedemption.status != "REJECTED"
        )
    )


def summary(db: Session, user: User) -> dict:
    best = _best_streak(db, user)
    # What the dashboard shows: today's finished plans count straight away.
    # Money still waits for the day to finish (see _best_streak).
    live = engine.today_status(db, user).best_streak
    unlocked = _unlocked(best)
    spent = _spent(db, user)
    available = max(unlocked - spent, 0)
    redemptions = db.scalars(
        select(WalletRedemption).where(WalletRedemption.user_id == user.id).order_by(WalletRedemption.created_at.desc())
    ).all()
    return {
        "best_streak": best,
        "live_best_streak": max(live, best),
        # Rupees, as before (older app versions read these).
        "earned": unlocked // POINTS_PER_RUPEE,
        "redeemed": spent // POINTS_PER_RUPEE,
        "balance": available // POINTS_PER_RUPEE,
        "points_unlocked": unlocked,
        "points_redeemed": spent,
        "points_available": available,
        "choices": [{"points": p, "amount": a, "available": available >= p} for p, a in CHOICES],
        "milestones": [
            {"days": d, "amount": p // POINTS_PER_RUPEE, "points": p, "reached": best >= d} for d, p in MILESTONES
        ],
        "redemptions": redemptions,
    }


def redemptions(db: Session, user: User) -> list[WalletRedemption]:
    return list(
        db.scalars(
            select(WalletRedemption).where(WalletRedemption.user_id == user.id).order_by(WalletRedemption.created_at.desc())
        )
    )


def _points_for(points: int | None, amount: int | None) -> int:
    """The choice the app made: 500 / 1000 points, or (older apps) ₹10 / ₹20."""
    by_amount = {a: p for p, a in CHOICES}
    if points is None and amount is not None:
        points = by_amount.get(amount)
    if points not in {p for p, _ in CHOICES}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose 500 points (₹10) or 1000 points (₹20).")
    return points


def redeem(
    db: Session, user: User, phone: str, points: int | None = None, amount: int | None = None, request_id: str | None = None
) -> tuple[WalletRedemption, bool]:
    """Spends 500 or 1000 points. Returns (redemption, created_now)."""
    points = _points_for(points, amount)
    rupees = dict(CHOICES)[points]

    def earlier() -> WalletRedemption | None:
        if not request_id:
            return None
        return db.scalar(select(WalletRedemption).where(WalletRedemption.user_id == user.id, WalletRedemption.request_id == request_id))

    if (found := earlier()) is not None:
        return found, False
    # Settle finished days first: that commits, which would release a lock.
    _best_streak(db, user)
    # Lock the account so two taps at once can't both spend the same points,
    # then read everything again under the lock.
    db.execute(select(User.id).where(User.id == user.id).with_for_update())
    if (found := earlier()) is not None:
        db.commit()
        return found, False
    best = db.scalar(select(StreakState.best_streak).where(StreakState.user_id == user.id)) or 0
    available = _unlocked(best) - _spent(db, user)
    if available <= 0:
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, "There are no points to redeem yet.")
    if points > available:
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, f"You have {available} points: not enough for {points}.")
    redemption = WalletRedemption(user_id=user.id, amount=rupees, points=points, phone=phone, request_id=request_id)
    db.add(redemption)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if (found := earlier()) is not None:
            return found, False
        raise
    db.refresh(redemption)
    return redemption, True


# -------------------------------------------------------------- admin payouts


def list_for_admin(db: Session, status_filter: str | None = None) -> list[WalletRedemption]:
    stmt = select(WalletRedemption).order_by(WalletRedemption.created_at.desc()).limit(200)
    if status_filter:
        stmt = stmt.where(WalletRedemption.status == status_filter)
    return list(db.scalars(stmt))


def decide(db: Session, admin: User, redemption_id, paid: bool, reference: str | None, note: str | None) -> WalletRedemption:
    """An admin marks a PENDING payout PAID (only after actually paying it,
    with the UPI/bank reference) or REJECTED (its points come back). Who and
    when are recorded. A decided redemption can't be changed again."""
    redemption = db.scalar(select(WalletRedemption).where(WalletRedemption.id == redemption_id).with_for_update())
    if redemption is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Redemption not found.")
    if redemption.status != "PENDING":
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, f"This redemption is already {redemption.status}.")
    redemption.status = "PAID" if paid else "REJECTED"
    redemption.payout_reference = reference if paid else None
    redemption.note = note
    redemption.decided_by = admin.id
    redemption.decided_at = timeutil.utc_now()
    db.commit()
    db.refresh(redemption)
    return redemption
