import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ReminderStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"


class WhatsAppStatus(str, enum.Enum):
    NOT_REQUESTED = "NOT_REQUESTED"
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    remind_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[ReminderStatus] = mapped_column(
        SAEnum(ReminderStatus, name="reminder_status"), default=ReminderStatus.ACTIVE, nullable=False
    )
    # E.164 phone number (e.g. +919876543210). Null/blank means WhatsApp is off for this reminder.
    whatsapp_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    whatsapp_status: Mapped[WhatsAppStatus] = mapped_column(
        SAEnum(WhatsAppStatus, name="reminder_whatsapp_status"),
        default=WhatsAppStatus.NOT_REQUESTED,
        nullable=False,
    )
    # Ring like an alarm on the device (looping sound, full screen) instead of a plain notification.
    alarm_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    # LOW / NORMAL / HIGH
    priority: Mapped[str] = mapped_column(String(8), default="NORMAL", server_default="NORMAL", nullable=False)
    track_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Set when the user marks the reminder done; null means not completed.
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
