import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ConfirmationMode:
    STANDARD = "STANDARD"  # full "Did you really complete…?" dialog
    QUICK = "QUICK"  # lighter one-tap confirm sheet; still never a bare checkbox
    ALL = (STANDARD, QUICK)


class UserSettings(Base):
    """One row per user. Privacy defaults are deliberately closed: nothing is
    discoverable until the user opts in."""

    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    # Appearance
    accent_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    animations_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    reduced_motion: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    # Satya
    satya_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    # Streak
    confirmation_mode: Mapped[str] = mapped_column(
        String(16), default=ConfirmationMode.STANDARD, server_default=ConfirmationMode.STANDARD, nullable=False
    )

    # Vault (0 = never auto-lock while the app stays in the foreground)
    vault_autolock_minutes: Mapped[int] = mapped_column(Integer, default=5, server_default="5", nullable=False)

    # Notifications
    notify_actions: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    notify_reminders: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    notify_streak_warnings: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    notify_achievements: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    # Privacy
    is_public_profile: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    show_current_streak: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    show_best_streak: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    show_achievements: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
