from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Reminder, ReminderStatus, WhatsAppStatus


def _whatsapp_status_for(whatsapp_number: str | None) -> WhatsAppStatus:
    return WhatsAppStatus.PENDING if whatsapp_number else WhatsAppStatus.NOT_REQUESTED


def _get_owned_reminder(db: Session, user_id: UUID, reminder_id: UUID) -> Reminder:
    reminder = db.scalar(select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == user_id))
    if not reminder:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found.")
    return reminder


def list_reminders(db: Session, user_id: UUID, include_cancelled: bool = False) -> list[Reminder]:
    stmt = select(Reminder).where(Reminder.user_id == user_id)
    if not include_cancelled:
        stmt = stmt.where(Reminder.status == ReminderStatus.ACTIVE)
    stmt = stmt.order_by(Reminder.remind_at)
    return list(db.scalars(stmt))


def create_reminder(db: Session, user_id: UUID, data: dict) -> Reminder:
    reminder = Reminder(
        user_id=user_id,
        title=data["title"],
        note=data.get("note"),
        remind_at=data["remind_at"],
        whatsapp_number=data.get("whatsapp_number"),
        whatsapp_status=_whatsapp_status_for(data.get("whatsapp_number")),
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


def get_reminder(db: Session, user_id: UUID, reminder_id: UUID) -> Reminder:
    return _get_owned_reminder(db, user_id, reminder_id)


def update_reminder(db: Session, user_id: UUID, reminder_id: UUID, fields: dict) -> Reminder:
    reminder = _get_owned_reminder(db, user_id, reminder_id)

    clear_whatsapp = fields.pop("clear_whatsapp_number", False)
    whatsapp_touched = clear_whatsapp or "whatsapp_number" in fields

    for key, value in fields.items():
        setattr(reminder, key, value)
    if clear_whatsapp:
        reminder.whatsapp_number = None

    if whatsapp_touched:
        # Re-arm the WhatsApp side-channel whenever the number or time changes,
        # so an edited reminder still gets (re)sent instead of silently reusing
        # a stale SENT/FAILED status from before the edit.
        reminder.whatsapp_status = _whatsapp_status_for(reminder.whatsapp_number)

    db.commit()
    db.refresh(reminder)
    return reminder


def cancel_reminder(db: Session, user_id: UUID, reminder_id: UUID) -> Reminder:
    reminder = _get_owned_reminder(db, user_id, reminder_id)
    reminder.status = ReminderStatus.CANCELLED
    if reminder.whatsapp_status == WhatsAppStatus.PENDING:
        reminder.whatsapp_status = WhatsAppStatus.NOT_REQUESTED
    db.commit()
    db.refresh(reminder)
    return reminder


def delete_reminder(db: Session, user_id: UUID, reminder_id: UUID) -> None:
    reminder = _get_owned_reminder(db, user_id, reminder_id)
    db.delete(reminder)
    db.commit()


def get_due_whatsapp_reminders(db: Session) -> list[Reminder]:
    """Used by the background worker: active reminders whose time has arrived
    and whose WhatsApp side-channel hasn't been sent yet."""
    now = datetime.now(timezone.utc)
    stmt = select(Reminder).where(
        Reminder.status == ReminderStatus.ACTIVE,
        Reminder.whatsapp_status == WhatsAppStatus.PENDING,
        Reminder.remind_at <= now,
    )
    return list(db.scalars(stmt))


def mark_whatsapp_result(db: Session, reminder_id: UUID, sent: bool) -> None:
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        return
    reminder.whatsapp_status = WhatsAppStatus.SENT if sent else WhatsAppStatus.FAILED
    db.commit()
