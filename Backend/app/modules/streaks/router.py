from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.timeutil import local_today
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import DayOut, StreakSummaryOut, TrackCompletionOut

router = APIRouter(prefix="/streaks", tags=["streaks"])


@router.get("/me", response_model=StreakSummaryOut)
def my_streak(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.summary(db, current_user)


@router.get("/history", response_model=list[DayOut])
def my_history(
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    end = to or local_today(current_user.timezone)
    start = from_ or (end - timedelta(days=83))  # 12 weeks: one heatmap's worth
    return service.history(db, current_user, start, end)


@router.get("/track-completions", response_model=list[TrackCompletionOut])
def my_track_completions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.track_completions(db, current_user)
