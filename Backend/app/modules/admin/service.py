from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.actions.models import Action, ActionCompletion
from app.modules.auth.models import User, UserRole
from app.modules.reminders.models import Reminder, ReminderStatus, WhatsAppStatus
from app.modules.streaks.models import StreakState
from app.modules.tracks.models import Track
from app.modules.vault.models import VaultEntry


def list_users(db: Session, search: str | None) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            (User.email.ilike(like)) | (User.display_name.ilike(like)) | (User.public_id.ilike(like))
        )
    return list(db.scalars(stmt))


def _get_user(db: Session, user_id: UUID) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    return user


def set_user_active(db: Session, user_id: UUID, active: bool) -> User:
    user = _get_user(db, user_id)
    user.is_active = active
    db.commit()
    db.refresh(user)
    return user


def set_user_role(db: Session, user_id: UUID, role: UserRole) -> User:
    user = _get_user(db, user_id)
    user.role = role
    db.commit()
    db.refresh(user)
    return user


def get_dashboard_stats(db: Session) -> dict:
    since = datetime.now(UTC) - timedelta(hours=24)

    def count(stmt) -> int:
        return db.scalar(stmt) or 0

    whatsapp = dict(
        db.execute(select(Reminder.whatsapp_status, func.count(Reminder.id)).group_by(Reminder.whatsapp_status)).all()
    )
    return {
        "total_users": count(select(func.count(User.id))),
        "active_users": count(select(func.count(User.id)).where(User.is_active.is_(True))),
        "admin_users": count(select(func.count(User.id)).where(User.role == UserRole.ADMIN)),
        "total_tracks": count(select(func.count(Track.id)).where(Track.deleted_at.is_(None))),
        "total_actions": count(select(func.count(Action.id)).where(Action.deleted_at.is_(None))),
        "completions_today": count(
            select(func.count(ActionCompletion.id)).where(
                ActionCompletion.revoked_at.is_(None), ActionCompletion.completed_at >= since
            )
        ),
        "total_completions": count(
            select(func.count(ActionCompletion.id)).where(ActionCompletion.revoked_at.is_(None))
        ),
        "vault_entries": count(select(func.count(VaultEntry.id)).where(VaultEntry.deleted_at.is_(None))),
        "avg_current_streak": round(float(db.scalar(select(func.avg(StreakState.current_streak))) or 0), 1),
        "max_best_streak": count(select(func.max(StreakState.best_streak))),
        "reminders_active": count(
            select(func.count(Reminder.id)).where(
                Reminder.status == ReminderStatus.ACTIVE, Reminder.completed_at.is_(None)
            )
        ),
        "whatsapp_sent": whatsapp.get(WhatsAppStatus.SENT, 0),
        "whatsapp_failed": whatsapp.get(WhatsAppStatus.FAILED, 0),
        "whatsapp_pending": whatsapp.get(WhatsAppStatus.PENDING, 0),
    }



# ---- Money


def _emails(db: Session, ids) -> dict:
    from app.modules.auth.models import User as _User

    ids = {i for i in ids if i}
    if not ids:
        return {}
    return dict(db.execute(select(_User.id, _User.email).where(_User.id.in_(ids))).all())


def redemptions(db: Session, status_filter: str | None) -> list[dict]:
    from app.modules.wallet import service as wallet

    rows = wallet.list_for_admin(db, status_filter.upper() if status_filter else None)
    emails = _emails(db, [r.user_id for r in rows] + [r.decided_by for r in rows])
    return [_redemption_out(r, emails) for r in rows]


def _redemption_out(r, emails: dict) -> dict:
    return {
        "id": r.id, "user_email": emails.get(r.user_id), "amount": r.amount, "points": r.points, "phone": r.phone,
        "status": r.status, "payout_reference": r.payout_reference, "note": r.note,
        "decided_by_email": emails.get(r.decided_by), "decided_at": r.decided_at, "created_at": r.created_at,
    }


def decide_redemption(db: Session, admin, redemption_id, paid: bool, reference, note) -> dict:
    from app.modules.wallet import service as wallet

    r = wallet.decide(db, admin, redemption_id, paid, reference, note)
    return _redemption_out(r, _emails(db, [r.user_id, r.decided_by]))


def payments(db: Session) -> list[dict]:
    from app.modules.subscriptions.models import PaymentOrder

    rows = list(db.scalars(select(PaymentOrder).order_by(PaymentOrder.created_at.desc()).limit(200)))
    emails = _emails(db, [r.user_id for r in rows])
    return [
        {
            "id": r.id, "user_email": emails.get(r.user_id), "purpose": r.purpose, "amount_paise": r.amount_paise,
            "currency": r.currency, "mode": r.mode, "status": r.status, "provider_order_id": r.provider_order_id,
            "provider_payment_id": r.provider_payment_id, "failure_reason": r.failure_reason,
            "created_at": r.created_at, "paid_at": r.paid_at,
        }
        for r in rows
    ]


def plans(db: Session) -> list[dict]:
    from app.core import timeutil
    from app.modules.subscriptions import service as subs
    from app.modules.subscriptions.models import PaymentOrder, WhatsAppPlan

    now = timeutil.utc_now()
    rows = db.execute(
        select(WhatsAppPlan, PaymentOrder.provider_order_id)
        .join(PaymentOrder, PaymentOrder.id == WhatsAppPlan.payment_order_id)
        .order_by(WhatsAppPlan.created_at.desc())
        .limit(200)
    ).all()
    emails = _emails(db, [p.user_id for p, _ in rows])
    return [
        {
            "user_email": emails.get(p.user_id), "free_used": min(subs.free_used(db, p.user_id), subs.FREE_MESSAGES),
            "messages_total": p.messages_granted + p.messages_carried, "messages_used": p.messages_used,
            "starts_at": p.starts_at, "expires_at": p.expires_at, "ended_at": p.ended_at,
            "active": p.ended_at is None and p.starts_at <= now < p.expires_at, "provider_order_id": order_id,
        }
        for p, order_id in rows
    ]
