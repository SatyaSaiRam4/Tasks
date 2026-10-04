from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timeutil import local_today
from app.modules.auth.models import User

from . import engine
from .models import DailyRecord, TrackCompletion
from .schemas import DayOut, StreakSummaryOut, TodayOut

MAX_HISTORY_DAYS = 400


def summary(db: Session, user: User) -> StreakSummaryOut:
    engine.finalize_user(db, user)
    state = engine.get_or_create_state(db, user)
    today = engine.today_status(db, user)
    totals = engine.totals(state, today)
    return StreakSummaryOut(
        current_streak=today.current_streak,
        best_streak=today.best_streak,
        total_success_days=totals.success_days,
        total_failed_days=totals.failed_days,
        bonus_points=state.bonus_points,
        consistency_score=totals.consistency_score,
        consistency_pct=totals.consistency_pct,
        tracking_started_on=state.tracking_started_on,
        at_risk=today.at_risk,
        today=TodayOut(
            date=today.date,
            required=today.required,
            completed=today.completed,
            optional_due=today.optional_due,
            optional_completed=today.optional_completed,
            secured=today.secured,
            remaining=max(today.required - today.completed, 0),
            progress=round(today.completed / today.required, 3) if today.required else 0.0,
        ),
    )


def history(db: Session, user: User, start: date, end: date) -> list[DayOut]:
    if end < start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "'to' must be on or after 'from'.")
    if (end - start).days > MAX_HISTORY_DAYS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Range is limited to {MAX_HISTORY_DAYS} days.")

    engine.finalize_user(db, user)
    state = engine.get_or_create_state(db, user)
    today = local_today(user.timezone)
    records = {
        r.record_date: r
        for r in db.scalars(
            select(DailyRecord).where(
                DailyRecord.user_id == user.id, DailyRecord.record_date >= start, DailyRecord.record_date <= end
            )
        ).all()
    }
    live = engine.today_status(db, user) if start <= today <= end else None

    days: list[DayOut] = []
    day = start
    while day <= end:
        record = records.get(day)
        if record is not None:
            days.append(DayOut(date=day, status=record.status, required=record.required_count, completed=record.completed_count))
        elif day == today and live is not None:
            status_ = "SUCCESS" if live.secured else ("PENDING" if live.required else "NO_ACTIONS")
            days.append(DayOut(date=day, status=status_, required=live.required, completed=live.completed))
        else:
            # Before tracking began, or in the future.
            status_ = "UNTRACKED" if day < state.tracking_started_on else "FUTURE"
            days.append(DayOut(date=day, status=status_, required=0, completed=0))
        day += timedelta(days=1)
    return days


def track_completions(db: Session, user: User) -> list[TrackCompletion]:
    engine.finalize_user(db, user)
    return list(
        db.scalars(
            select(TrackCompletion)
            .where(TrackCompletion.user_id == user.id)
            .order_by(TrackCompletion.evaluated_at.desc())
        ).all()
    )
