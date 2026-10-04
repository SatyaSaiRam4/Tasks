from datetime import datetime, timedelta, timezone
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
    since = datetime.now(timezone.utc) - timedelta(hours=24)

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
