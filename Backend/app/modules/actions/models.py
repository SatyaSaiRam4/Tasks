import enum
import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ActionPriority(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"


class RepeatType:
    ONCE = "ONCE"  # only on start_date
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"  # on repeat_weekdays (0=Mon … 6=Sun)
    CUSTOM = "CUSTOM"  # every repeat_interval_days days from start_date
    ALL = (ONCE, DAILY, WEEKLY, CUSTOM)


class Action(Base):
    """A concrete activity inside a Track ("07:00 — Morning Workout").
    Completion is tracked per scheduled date in ActionCompletion, never on
    the Action itself, so recurring Actions keep a full history."""

    __tablename__ = "actions"
    __table_args__ = (
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="ck_actions_date_range"),
        CheckConstraint("repeat_type IN ('ONCE', 'DAILY', 'WEEKLY', 'CUSTOM')", name="ck_actions_repeat_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[ActionPriority] = mapped_column(
        SAEnum(ActionPriority, name="action_priority"), default=ActionPriority.NORMAL, nullable=False
    )
    time_of_day: Mapped[time | None] = mapped_column(Time, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    repeat_type: Mapped[str] = mapped_column(String(12), default=RepeatType.ONCE, server_default=RepeatType.ONCE, nullable=False)
    repeat_weekdays: Mapped[list[int] | None] = mapped_column(JSONB, nullable=True)
    repeat_interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    steps: Mapped[list["ActionStep"]] = relationship(
        back_populates="action", cascade="all, delete-orphan", order_by="ActionStep.sort_order"
    )


class ActionStep(Base):
    """An optional sub-step shown with an Action (e.g. "Stretch", "Warm up")."""

    __tablename__ = "action_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    action: Mapped["Action"] = relationship(back_populates="steps")


class ConfirmationMethod:
    STANDARD = "STANDARD"
    QUICK = "QUICK"
    MIGRATED = "MIGRATED"  # carried over from the pre-streak task model
    ALL = (STANDARD, QUICK, MIGRATED)


class ActionCompletion(Base):
    """The audit record of one confirmed completion of an Action for one date.

    Undoing a completion sets revoked_at rather than deleting the row, so the
    full history of confirmations survives. Only one live (non-revoked)
    completion can exist per Action per date.
    """

    __tablename__ = "action_completions"
    __table_args__ = (
        Index(
            "uq_action_completions_live",
            "action_id",
            "scheduled_date",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
        Index("ix_action_completions_user_date", "user_id", "scheduled_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Server clock, never the device's.
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    confirmation_method: Mapped[str] = mapped_column(String(16), default=ConfirmationMethod.STANDARD, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
