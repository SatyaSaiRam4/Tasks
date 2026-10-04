import datetime as _dt
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TrackCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    icon: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=20)
    start_date: date | None = None  # defaults to today in the user's timezone
    end_date: date | None = None

    @model_validator(mode="after")
    def _check_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must be on or after the start date.")
        return self


class TrackUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    icon: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=20)
    start_date: date | None = None
    end_date: date | None = None
    clear_end_date: bool = False
    sort_order: int | None = None


class TrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    icon: str | None
    color: str | None
    start_date: date
    end_date: date | None
    sort_order: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    # Derived, computed per request.
    status: str = "ACTIVE"  # UPCOMING | ACTIVE | ENDED | ARCHIVED
    action_count: int = 0
    today_required: int = 0
    today_completed: int = 0
    day_number: int | None = None  # "Day 12" of the Track, if it has started
    total_days: int | None = None  # only for dated Tracks
    days_remaining: int | None = None
    streak: int = 0
    completion_rate: float = 0.0  # 0..1 over required actions so far


class TrackDayOut(BaseModel):
    date: _dt.date
    required: int
    completed: int
    status: str  # SUCCESS | FAILED | NO_ACTIONS | PENDING | FUTURE


class TrackGridRowOut(BaseModel):
    action_id: UUID
    title: str
    # One mark per entry in TrackGridOut.days:
    # DONE | MISSED | TODO (due today, not done yet) | FUTURE | NONE (not scheduled that day)
    cells: list[str]


class TrackGridOut(BaseModel):
    today: _dt.date
    days: list[_dt.date]
    rows: list[TrackGridRowOut]
