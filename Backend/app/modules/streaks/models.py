import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class DayStatus:
    SUCCESS = "SUCCESS"  # every required Action due that day was completed
    FAILED = "FAILED"  # at least one required Action was missed
    NO_ACTIONS = "NO_ACTIONS"  # nothing required that day: neither extends nor breaks a streak
    ALL = (SUCCESS, FAILED, NO_ACTIONS)


class DailyRecord(Base):
    """The finalized, immutable outcome of one past day for one user.

    Written only once the day has ended in the user's timezone. Later edits to
    Tracks/Actions can never rewrite these, which is what keeps streak history
    trustworthy.
    """

    __tablename__ = "daily_records"
    __table_args__ = (UniqueConstraint("user_id", "record_date", name="uq_daily_records_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    required_count: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    streak_after: Mapped[int] = mapped_column(Integer, nullable=False)
    finalized_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class StreakState(Base):
    """Cached running totals derived from DailyRecord (which stays the source of truth)."""

    __tablename__ = "streak_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # First day the streak engine evaluated for this user. Days before it are
    # never judged, so history from before streaks existed can't count as missed.
    tracking_started_on: Mapped[date] = mapped_column(Date, nullable=False)
    last_success_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_finalized_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_success_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_failed_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bonus_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class TrackCompletion(Base):
    """Evaluated once, after a dated Track's end_date has fully passed. Keeps a
    name snapshot so the record survives even if the Track is later deleted."""

    __tablename__ = "track_completions"
    __table_args__ = (UniqueConstraint("track_id", name="uq_track_completions_track"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True
    )
    track_name: Mapped[str] = mapped_column(String(80), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    required_total: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_total: Mapped[int] = mapped_column(Integer, nullable=False)
    is_perfect: Mapped[bool] = mapped_column(Boolean, nullable=False)
    bonus_points: Mapped[int] = mapped_column(Integer, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
