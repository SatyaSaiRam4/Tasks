import datetime as _dt
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TodayOut(BaseModel):
    date: _dt.date
    required: int
    completed: int
    optional_due: int
    optional_completed: int
    secured: bool
    remaining: int
    progress: float  # 0..1 over required actions


class StreakSummaryOut(BaseModel):
    current_streak: int
    best_streak: int
    total_success_days: int
    total_failed_days: int
    bonus_points: int
    consistency_score: int  # successful days + earned bonus
    consistency_pct: float  # successful / judged days, 0..100
    tracking_started_on: date
    at_risk: bool
    today: TodayOut


class DayOut(BaseModel):
    date: _dt.date
    status: str  # SUCCESS | FAILED | NO_ACTIONS | PENDING (today) | UNTRACKED
    required: int
    completed: int


class TrackCompletionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    track_id: UUID | None
    track_name: str
    start_date: date
    end_date: date
    duration_days: int
    required_total: int
    completed_total: int
    is_perfect: bool
    bonus_points: int
    evaluated_at: datetime
