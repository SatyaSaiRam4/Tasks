import secrets

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import utc_now
from app.modules.achievements.catalog import BY_CODE
from app.modules.achievements.service import earned_codes
from app.modules.actions.models import ActionCompletion
from app.modules.auth.models import User
from app.modules.streaks import engine
from app.modules.streaks.models import TrackCompletion

from .models import UserSettings
from .schemas import (
    AchievementBadge,
    MeOut,
    MyProfileOut,
    ProfileStatsOut,
    PublicProfileOut,
    SettingsOut,
)

ONBOARDING_VERSION = 1


def generate_public_id(db: Session, display_name: str) -> str:
    base = "".join(ch for ch in display_name.upper() if ch.isalnum())[:8] or "USER"
    for _ in range(20):
        candidate = f"{base}_{secrets.token_hex(3).upper()[:5]}"
        if not db.scalar(select(User.id).where(User.public_id == candidate)):
            return candidate
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not allocate a user ID. Please try again.")


def ensure_settings(db: Session, user_id) -> UserSettings:
    settings = db.get(UserSettings, user_id)
    if settings is None:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        db.flush()
    return settings


def me(db: Session, user: User) -> MeOut:
    settings = ensure_settings(db, user.id)
    db.commit()
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        public_id=user.public_id,
        avatar=user.avatar,
        timezone=user.timezone,
        role=user.role.value,
        created_at=user.created_at,
        onboarding_completed=user.onboarding_completed_at is not None
        and user.onboarding_version >= ONBOARDING_VERSION,
        settings=SettingsOut.model_validate(settings),
    )


def update_profile(db: Session, user: User, fields: dict) -> MeOut:
    if fields.get("display_name"):
        user.display_name = fields["display_name"].strip()
    if "avatar" in fields:
        user.avatar = (fields["avatar"] or "").strip() or None
    if fields.get("timezone"):
        # Lock in days under the old zone before the definition of "today" moves.
        engine.finalize_user(db, user)
        user.timezone = fields["timezone"]
    db.commit()
    db.refresh(user)
    return me(db, user)


def update_settings(db: Session, user: User, fields: dict) -> SettingsOut:
    settings = ensure_settings(db, user.id)
    clear_accent = fields.pop("clear_accent_color", False)
    for key, value in fields.items():
        if value is not None:
            setattr(settings, key, value)
    if clear_accent:
        settings.accent_color = None
    db.commit()
    db.refresh(settings)
    return SettingsOut.model_validate(settings)


def complete_onboarding(db: Session, user: User) -> MeOut:
    user.onboarding_completed_at = utc_now()
    user.onboarding_version = ONBOARDING_VERSION
    db.commit()
    return me(db, user)


def reset_onboarding(db: Session, user: User) -> MeOut:
    user.onboarding_completed_at = None
    db.commit()
    return me(db, user)


def _badges(db: Session, user_id) -> list[AchievementBadge]:
    have = earned_codes(db, user_id)
    return [
        AchievementBadge(code=code, title=BY_CODE[code].title, icon=BY_CODE[code].icon, earned_at=at)
        for code, at in sorted(have.items(), key=lambda kv: kv[1])
        if code in BY_CODE
    ]


def _stats(db: Session, user: User) -> ProfileStatsOut:
    engine.finalize_user(db, user)
    state = engine.get_or_create_state(db, user)
    today = engine.today_status(db, user)
    totals = engine.totals(state, today)
    completions = db.execute(
        select(func.count(TrackCompletion.id), func.count(TrackCompletion.id).filter(TrackCompletion.is_perfect)).where(
            TrackCompletion.user_id == user.id, TrackCompletion.required_total > 0
        )
    ).one()
    total_actions = db.scalar(
        select(func.count(ActionCompletion.id)).where(
            ActionCompletion.user_id == user.id, ActionCompletion.revoked_at.is_(None)
        )
    )
    return ProfileStatsOut(
        current_streak=today.current_streak,
        best_streak=today.best_streak,
        consistency_pct=totals.consistency_pct,
        consistency_score=totals.consistency_score,
        total_success_days=totals.success_days,
        completed_tracks=completions[0] or 0,
        perfect_tracks=completions[1] or 0,
        total_completed_actions=total_actions or 0,
        tracking_started_on=state.tracking_started_on,
    )


def my_profile(db: Session, user: User) -> MyProfileOut:
    return MyProfileOut(me=me(db, user), stats=_stats(db, user), achievements=_badges(db, user.id))


def public_profile(db: Session, public_id: str) -> PublicProfileOut:
    """Returns the same 404 for "no such user" and "not public", so the search
    can't be used to discover which IDs exist."""
    not_found = HTTPException(status.HTTP_404_NOT_FOUND, "No public profile found for that User ID.")
    user = db.scalar(select(User).where(func.upper(User.public_id) == public_id.strip().upper()))
    if user is None or not user.is_active:
        raise not_found
    settings = ensure_settings(db, user.id)
    if not settings.is_public_profile:
        raise not_found
    stats = _stats(db, user)
    return PublicProfileOut(
        display_name=user.display_name,
        public_id=user.public_id,
        avatar=user.avatar,
        member_since=user.created_at.date(),
        current_streak=stats.current_streak if settings.show_current_streak else None,
        best_streak=stats.best_streak if settings.show_best_streak else None,
        consistency_pct=stats.consistency_pct,
        completed_tracks=stats.completed_tracks,
        achievements=_badges(db, user.id) if settings.show_achievements else None,
    )
