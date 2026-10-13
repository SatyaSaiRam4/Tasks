"""Payments and the WhatsApp plan.

  payment_orders     one Razorpay order per purchase attempt (amount in paise,
                     provider ids, status), kept for auditing.
  payment_events     every Razorpay webhook event, by its event id, so a
                     repeated delivery is processed once.
  whatsapp_plans     what a paid order grants: 100 messages for 30 days. One
                     plan per paid order (unique), at most one open plan per
                     user (partial unique index), so no payment can grant twice
                     and periods never overlap.
  whatsapp_usage     the ledger of billable WhatsApp reminder sends, one row per
                     reminder occurrence (unique idempotency key), so a retry
                     can never count a message twice.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(UTC)


class PaymentOrder(Base):
    __tablename__ = "payment_orders"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_payment_orders_amount_positive"),
        CheckConstraint("status IN ('CREATED', 'PAID', 'FAILED', 'EXPIRED')", name="ck_payment_orders_status"),
        Index("ix_payment_orders_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Kept if the user is removed, for the accounts.
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    purpose: Mapped[str] = mapped_column(String(40), nullable=False)  # WHATSAPP_PLAN
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="razorpay")
    mode: Mapped[str] = mapped_column(String(8), nullable=False)  # test / live
    provider_order_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    # CREATED (waiting), PAID (confirmed by Razorpay), FAILED, EXPIRED (abandoned)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="CREATED")
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # When the server last asked Razorpay about it (to check a delayed payment, not too often).
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_event_id: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)  # x-razorpay-event-id
    event: Mapped[str] = mapped_column(String(60), nullable=False)
    provider_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result: Mapped[str] = mapped_column(String(120), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class WhatsAppPlan(Base):
    __tablename__ = "whatsapp_plans"
    __table_args__ = (
        CheckConstraint("messages_used >= 0", name="ck_whatsapp_plans_used_nonnegative"),
        CheckConstraint("messages_used <= messages_granted + messages_carried", name="ck_whatsapp_plans_used_within_allowance"),
        CheckConstraint("expires_at > starts_at", name="ck_whatsapp_plans_period"),
        # One open plan per user: a renewal closes the previous one first.
        Index("uq_whatsapp_plans_one_open", "user_id", unique=True, postgresql_where=text("ended_at IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payment_orders.id", ondelete="RESTRICT"), nullable=False, unique=True)
    messages_granted: Mapped[int] = mapped_column(Integer, nullable=False)  # 100
    # Unused messages brought over from the plan this one replaced (a renewal).
    messages_carried: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    messages_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Set when a renewal replaces it (its leftover messages move to the new plan).
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class WhatsAppUsage(Base):
    __tablename__ = "whatsapp_usage"
    __table_args__ = (
        CheckConstraint("source IN ('FREE', 'PLAN', 'NONE')", name="ck_whatsapp_usage_source"),
        CheckConstraint("status IN ('ATTEMPTED', 'ACCEPTED', 'REJECTED', 'UNKNOWN', 'BLOCKED')", name="ck_whatsapp_usage_status"),
        Index("ix_whatsapp_usage_user_source", "user_id", "source", "counted"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reminder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("reminders.id", ondelete="SET NULL"), nullable=True)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("whatsapp_plans.id", ondelete="SET NULL"), nullable=True)
    # FREE (one of the account's 3), PLAN (from a paid plan), NONE (blocked: nothing left)
    source: Mapped[str] = mapped_column(String(8), nullable=False)
    # "reminder:<id>:<remind_at>": one row per reminder occurrence, so retries never count twice.
    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # ATTEMPTED (counted, being sent) -> ACCEPTED (MSG91 took it) / REJECTED (MSG91
    # refused: not counted) / UNKNOWN (no answer: counted, not resent). BLOCKED: no allowance, not sent.
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    counted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # Delivered / read, if MSG91 delivery reports are ever wired in (not available yet).
    delivery_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
