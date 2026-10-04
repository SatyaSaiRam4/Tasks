from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.timeutil import is_valid_timezone

from .models import ConfirmationMode

AUTOLOCK_CHOICES = (0, 1, 5, 15, 30)  # 0 = never
ACCENT_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar: str | None = Field(default=None, max_length=16)
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_timezone(value):
            raise ValueError("Unknown timezone.")
        return value


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    accent_color: str | None
    animations_enabled: bool
    reduced_motion: bool
    satya_enabled: bool
    confirmation_mode: str
    vault_autolock_minutes: int
    notify_actions: bool
    notify_reminders: bool
    notify_streak_warnings: bool
    notify_achievements: bool
    is_public_profile: bool
    show_current_streak: bool
    show_best_streak: bool
    show_achievements: bool


class SettingsUpdate(BaseModel):
    accent_color: str | None = Field(default=None, pattern=ACCENT_PATTERN)
    clear_accent_color: bool = False
    animations_enabled: bool | None = None
    reduced_motion: bool | None = None
    satya_enabled: bool | None = None
    confirmation_mode: str | None = None
    vault_autolock_minutes: int | None = None
    notify_actions: bool | None = None
    notify_reminders: bool | None = None
    notify_streak_warnings: bool | None = None
    notify_achievements: bool | None = None
    is_public_profile: bool | None = None
    show_current_streak: bool | None = None
    show_best_streak: bool | None = None
    show_achievements: bool | None = None

    @field_validator("confirmation_mode")
    @classmethod
    def _mode(cls, value: str | None) -> str | None:
        if value is not None and value not in ConfirmationMode.ALL:
            raise ValueError("Confirmation mode must be STANDARD or QUICK.")
        return value

    @field_validator("vault_autolock_minutes")
    @classmethod
    def _autolock(cls, value: int | None) -> int | None:
        if value is not None and value not in AUTOLOCK_CHOICES:
            raise ValueError("Auto-lock must be 1, 5, 15 or 30 minutes, or 0 for never.")
        return value


class AchievementBadge(BaseModel):
    code: str
    title: str
    icon: str
    earned_at: datetime | None


class MeOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    public_id: str
    avatar: str | None
    timezone: str
    role: str
    created_at: datetime
    onboarding_completed: bool
    settings: SettingsOut


class ProfileStatsOut(BaseModel):
    current_streak: int
    best_streak: int
    consistency_pct: float
    consistency_score: int
    total_success_days: int
    completed_tracks: int
    perfect_tracks: int
    total_completed_actions: int
    tracking_started_on: date


class MyProfileOut(BaseModel):
    me: MeOut
    stats: ProfileStatsOut
    achievements: list[AchievementBadge]


class PublicProfileOut(BaseModel):
    """Only what the user explicitly made public; fields they hid are null."""

    display_name: str
    public_id: str
    avatar: str | None
    member_since: date
    current_streak: int | None
    best_streak: int | None
    consistency_pct: float
    completed_tracks: int
    achievements: list[AchievementBadge] | None
