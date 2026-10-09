from datetime import datetime, timedelta, timezone
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


def _validate_track(db: Session, user_id: UUID, track_id: UUID | None) -> None:
    if track_id is None:
        return
    from app.modules.tracks.service import get_owned_track

    get_owned_track(db, user_id, track_id)


def list_reminders(
    db: Session, user_id: UUID, include_cancelled: bool = False, include_completed: bool = True
) -> list[Reminder]:
    stmt = select(Reminder).where(Reminder.user_id == user_id)
    if not include_cancelled:
        stmt = stmt.where(Reminder.status == ReminderStatus.ACTIVE)
    if not include_completed:
        stmt = stmt.where(Reminder.completed_at.is_(None))
    stmt = stmt.order_by(Reminder.remind_at)
    return list(db.scalars(stmt))


def create_reminder(db: Session, user_id: UUID, data: dict) -> Reminder:
    _validate_track(db, user_id, data.get("track_id"))
    reminder = Reminder(
        user_id=user_id,
        title=data["title"],
        note=data.get("note"),
        remind_at=data["remind_at"],
        whatsapp_number=data.get("whatsapp_number"),
        whatsapp_status=_whatsapp_status_for(data.get("whatsapp_number")),
        alarm_enabled=bool(data.get("alarm_enabled")),
        priority=data.get("priority") or "NORMAL",
        track_id=data.get("track_id"),
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
    clear_track = fields.pop("clear_track", False)
    whatsapp_touched = clear_whatsapp or "whatsapp_number" in fields or "remind_at" in fields
    if fields.get("alarm_enabled") is None:
        fields.pop("alarm_enabled", None)
    if fields.get("track_id") is not None:
        _validate_track(db, user_id, fields["track_id"])

    for key, value in fields.items():
        setattr(reminder, key, value)
    if clear_whatsapp:
        reminder.whatsapp_number = None
    if clear_track:
        reminder.track_id = None

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


def set_completed(db: Session, user_id: UUID, reminder_id: UUID, completed: bool) -> Reminder:
    reminder = _get_owned_reminder(db, user_id, reminder_id)
    reminder.completed_at = datetime.now(timezone.utc) if completed else None
    if completed and reminder.whatsapp_status == WhatsAppStatus.PENDING:
        reminder.whatsapp_status = WhatsAppStatus.NOT_REQUESTED
    db.commit()
    db.refresh(reminder)
    return reminder


def snooze(db: Session, user_id: UUID, reminder_id: UUID, minutes: int) -> Reminder:
    """Pushes the reminder `minutes` past now (or past its time, if that's later)
    and re-arms WhatsApp if a number is set."""
    reminder = _get_owned_reminder(db, user_id, reminder_id)
    if reminder.status != ReminderStatus.ACTIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only active reminders can be snoozed.")
    base = max(datetime.now(timezone.utc), reminder.remind_at)
    reminder.remind_at = base + timedelta(minutes=minutes)
    reminder.completed_at = None
    reminder.whatsapp_status = _whatsapp_status_for(reminder.whatsapp_number)
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
        Reminder.completed_at.is_(None),
        Reminder.remind_at <= now,
    )
    return list(db.scalars(stmt))


def mark_whatsapp_result(db: Session, reminder_id: UUID, sent: bool) -> None:
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        return
    reminder.whatsapp_status = WhatsAppStatus.SENT if sent else WhatsAppStatus.FAILED
    db.commit()
