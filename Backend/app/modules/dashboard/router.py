"""One request that powers the whole Dashboard. Never includes Vault data."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.timeutil import local_now
from app.db.session import get_db
from app.modules.actions import service as actions_service
from app.modules.actions.schemas import AgendaOut
from app.modules.auth.models import User
from app.modules.reminders.models import Reminder, ReminderStatus
from app.modules.reminders.schemas import ReminderOut
from app.modules.streaks import service as streaks_service
from app.modules.streaks.schemas import StreakSummaryOut
from app.modules.tracks.models import Track
from app.modules.users.service import ensure_settings

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardOut(BaseModel):
    display_name: str
    local_hour: int  # for the greeting, computed from the server clock in the user's zone
    satya_enabled: bool
    animations_enabled: bool
    reduced_motion: bool
    streak: StreakSummaryOut
    agenda: AgendaOut
    active_tracks: int
    total_tracks: int
    upcoming_reminders: list[ReminderOut]
    reminder_count: int


@router.get("/summary", response_model=DashboardOut)
def summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    streak = streaks_service.summary(db, current_user)  # also finalizes past days
    agenda = actions_service.agenda(db, current_user, None)
    settings = ensure_settings(db, current_user.id)
    db.commit()

    tracks = db.execute(
        select(Track.start_date, Track.end_date, Track.is_archived).where(
            Track.user_id == current_user.id, Track.deleted_at.is_(None)
        )
    ).all()
    today = streak.today.date
    active = sum(
        1
        for t in tracks
        if not t.is_archived and t.start_date <= today and (t.end_date is None or t.end_date >= today)
    )

    now = datetime.now(timezone.utc)
    upcoming_filter = (
        Reminder.user_id == current_user.id,
        Reminder.status == ReminderStatus.ACTIVE,
        Reminder.completed_at.is_(None),
        Reminder.remind_at >= now,
    )
    upcoming = db.scalars(select(Reminder).where(*upcoming_filter).order_by(Reminder.remind_at).limit(5)).all()
    reminder_count = db.scalar(select(func.count(Reminder.id)).where(*upcoming_filter)) or 0

    return DashboardOut(
        display_name=current_user.display_name,
        local_hour=local_now(current_user.timezone).hour,
        satya_enabled=settings.satya_enabled,
        animations_enabled=settings.animations_enabled,
        reduced_motion=settings.reduced_motion,
        streak=streak,
        agenda=agenda,
        active_tracks=active,
        total_tracks=len(tracks),
        upcoming_reminders=[ReminderOut.model_validate(r) for r in upcoming],
        reminder_count=reminder_count,
    )
