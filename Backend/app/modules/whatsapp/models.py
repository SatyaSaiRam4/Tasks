import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ContactStatus(str, enum.Enum):
    PENDING = "PENDING"  # asked "reply YES to allow"; no reply yet
    VERIFIED = "VERIFIED"  # the owner replied YES: reminders may go to this number
    STOPPED = "STOPPED"  # the owner sent STOP: nothing goes there until they send YES themselves


class WhatsAppContact(Base):
    """Consent for one WhatsApp number. Memo only sends reminders to a number
    whose owner replied YES to a one-time permission message, so nobody can
    have Memo message someone else's number to tease them. STOP ends it; only
    the owner can turn it back on (by sending YES)."""

    __tablename__ = "whatsapp_contacts"

    phone: Mapped[str] = mapped_column(String(20), primary_key=True)  # E.164, e.g. +919876543210
    status: Mapped[ContactStatus] = mapped_column(SAEnum(ContactStatus, name="whatsapp_contact_status"), nullable=False)
    # When the permission message was last sent (a number is asked at most once a day).
    asked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
