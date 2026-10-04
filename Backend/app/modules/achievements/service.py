"""Achievements are computed only from server-side data (completions, finalized
days, scored Tracks), so they can't be granted by the client."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import zone_for
from app.modules.actions.models import ActionCompletion
from app.modules.auth.models import User
from app.modules.streaks.models import DailyRecord, DayStatus, StreakState, TrackCompletion

from .catalog import BY_CODE, CATALOG, STREAK_MILESTONES
from .models import UserAchievement


def earned_codes(db: Session, user_id) -> dict[str, datetime]:
    rows = db.execute(
        select(UserAchievement.code, UserAchievement.earned_at).where(UserAchievement.user_id == user_id)
    ).all()
    return {r.code: r.earned_at for r in rows}


def _had_comeback(db: Session, user_id) -> bool:
    statuses = db.scalars(
        select(DailyRecord.status)
        .where(DailyRecord.user_id == user_id, DailyRecord.status != DayStatus.NO_ACTIONS)
        .order_by(DailyRecord.record_date)
    ).all()
    seen_failure = False
    for status in statuses:
        if status == DayStatus.FAILED:
            seen_failure = True
        elif status == DayStatus.SUCCESS and seen_failure:
            return True
    return False


def _early_completions(db: Session, user: User) -> int:
    tz = zone_for(user.timezone)
    times = db.scalars(
        select(ActionCompletion.completed_at).where(
            ActionCompletion.user_id == user.id, ActionCompletion.revoked_at.is_(None)
        )
    ).all()
    return sum(1 for t in times if t.astimezone(tz).hour < 9)


def evaluate_achievements(db: Session, user: User, state: StreakState) -> list[str]:
    """Grants any newly met achievements (flushes, doesn't commit). Returns new codes."""
    have = earned_codes(db, user.id)
    new: list[str] = []

    def grant(code: str) -> None:
        if code not in have and code in BY_CODE:
            db.add(UserAchievement(user_id=user.id, code=code))
            have[code] = datetime.now()
            new.append(code)

    if state.total_success_days >= 1:
        grant("FIRST_STEP")
    for code, days in STREAK_MILESTONES.items():
        if state.best_streak >= days:
            grant(code)

    if "ACTIONS_100" not in have:
        total = db.scalar(
            select(func.count(ActionCompletion.id)).where(
                ActionCompletion.user_id == user.id, ActionCompletion.revoked_at.is_(None)
            )
        )
        if (total or 0) >= 100:
            grant("ACTIONS_100")

    if "EARLY_STARTER" not in have and _early_completions(db, user) >= 10:
        grant("EARLY_STARTER")

    if "COMEBACK" not in have and state.total_failed_days > 0 and _had_comeback(db, user.id):
        grant("COMEBACK")

    if "TRACK_FINISHER" not in have or "PERFECT_TRACK" not in have:
        for tc in db.scalars(select(TrackCompletion).where(TrackCompletion.user_id == user.id)).all():
            if tc.required_total > 0 and tc.completed_total / tc.required_total >= 0.8:
                grant("TRACK_FINISHER")
            if tc.is_perfect:
                grant("PERFECT_TRACK")

    if new:
        db.flush()
    return new


def list_for_user(db: Session, user_id) -> list[dict]:
    have = earned_codes(db, user_id)
    return [
        {
            "code": a.code,
            "title": a.title,
            "description": a.description,
            "icon": a.icon,
            "earned": a.code in have,
            "earned_at": have.get(a.code),
        }
        for a in CATALOG
    ]
