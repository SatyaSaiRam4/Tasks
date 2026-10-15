import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ContactStatus(str, enum.Enum):
    PENDING = "PENDING"  # asked "reply YES to allow"; no reply yet
    VERIFIED = "VERIFIED"  # the owner replied YES: reminders may go to this number
    STOPPED = "STOPPED"  # the owner sent STOP: nothing goes there until they reply YES again


class WhatsAppContact(Base):
    """Consent for one WhatsApp number. Memo only sends reminders to a number
    whose owner replied YES to a permission message, so nobody can have Memo
    message someone else's number to tease them. STOP ends it; it can be
    asked again, but after 3 refusals in a day only the next day."""

    __tablename__ = "whatsapp_contacts"

    phone: Mapped[str] = mapped_column(String(20), primary_key=True)  # E.164, e.g. +919876543210
    status: Mapped[ContactStatus] = mapped_column(SAEnum(ContactStatus, name="whatsapp_contact_status"), nullable=False)
    # When the permission message was last sent (a number is asked at most once a day).
    asked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Refusals (STOP) in the current 24-hour stretch: after 3, it can't be asked until it ends.
    refusals: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    refusals_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class WhatsAppInboundLog(Base):
    """Every call MSG91 makes to the inbound webhook (numbers masked), so it's
    possible to see exactly what arrived, when, and what Memo did with it. The
    daily cleanup keeps 7 days."""

    __tablename__ = "whatsapp_inbound_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False, index=True)
    token_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)  # [(masked sender, text, result)]
    payload: Mapped[str] = mapped_column(Text, nullable=False)  # the body, numbers masked, cut to 4 KB


class WhatsAppAutoReply(Base):
    """When Memo last answered a number that wrote something other than YES or
    STOP (the short "only reminders come from this number" answer)."""

    __tablename__ = "whatsapp_auto_replies"

    phone: Mapped[str] = mapped_column(String(20), primary_key=True)  # E.164
    replied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class WhatsAppInboundSeen(Base):
    """WhatsApp message ids already handled. More than one backend can receive
    the same MSG91 webhook (two servers, two webhooks): a message is acted on
    only by whichever saw it first, so a STOP never counts twice and an
    automatic answer never goes twice. The daily cleanup keeps 7 days."""

    __tablename__ = "whatsapp_inbound_seen"

    message_id: Mapped[str] = mapped_column(String(160), primary_key=True)  # WhatsApp's "wamid…"
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False, index=True)
