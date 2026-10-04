import datetime as _dt
from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import ActionPriority, RepeatType


class _ScheduleFields(BaseModel):
    @field_validator("repeat_weekdays", check_fields=False)
    @classmethod
    def _weekdays(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        if any(d < 0 or d > 6 for d in value):
            raise ValueError("Weekdays must be between 0 (Mon) and 6 (Sun).")
        return sorted(set(value))


class ActionCreate(_ScheduleFields):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: ActionPriority = ActionPriority.NORMAL
    time_of_day: time | None = None
    start_date: date | None = None  # defaults to today (or the Track's start if later)
    end_date: date | None = None
    repeat_type: str = RepeatType.DAILY
    repeat_weekdays: list[int] | None = None
    repeat_interval_days: int | None = Field(default=None, ge=2, le=365)
    is_required: bool = True
    reminder_enabled: bool = False
    steps: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def _check(self):
        if self.repeat_type not in RepeatType.ALL:
            raise ValueError("Unknown repeat type.")
        if self.repeat_type == RepeatType.WEEKLY and not self.repeat_weekdays:
            raise ValueError("Pick at least one weekday for a weekly action.")
        if self.repeat_type == RepeatType.CUSTOM and not self.repeat_interval_days:
            raise ValueError("Choose how many days apart a custom action repeats.")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must be on or after the start date.")
        self.steps = [s.strip()[:160] for s in self.steps if s and s.strip()]
        return self


class ActionUpdate(_ScheduleFields):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: ActionPriority | None = None
    time_of_day: time | None = None
    clear_time: bool = False
    start_date: date | None = None
    end_date: date | None = None
    clear_end_date: bool = False
    repeat_type: str | None = None
    repeat_weekdays: list[int] | None = None
    repeat_interval_days: int | None = Field(default=None, ge=2, le=365)
    is_required: bool | None = None
    reminder_enabled: bool | None = None
    is_active: bool | None = None
    steps: list[str] | None = Field(default=None, max_length=30)


class ActionStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    sort_order: int


class ActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    track_id: UUID
    title: str
    description: str | None
    priority: ActionPriority
    time_of_day: time | None
    start_date: date
    end_date: date | None
    repeat_type: str
    repeat_weekdays: list[int] | None
    repeat_interval_days: int | None
    is_required: bool
    reminder_enabled: bool
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
    steps: list[ActionStepOut] = []


class TrackRef(BaseModel):
    id: UUID
    name: str
    icon: str | None
    color: str | None


class AgendaItem(BaseModel):
    action: ActionOut
    is_completed: bool
    completed_at: datetime | None


class AgendaGroup(BaseModel):
    track: TrackRef
    items: list[AgendaItem]
    required: int
    completed: int


class AgendaOut(BaseModel):
    date: _dt.date
    is_today: bool
    editable: bool  # completions can only be changed for today
    required: int
    completed: int
    groups: list[AgendaGroup]


class CompleteRequest(BaseModel):
    # Must be explicitly true: a bare tap never earns streak credit.
    confirmed: bool
    method: str = "STANDARD"
    date: _dt.date | None = None


class UncompleteRequest(BaseModel):
    date: _dt.date | None = None


class AchievementBrief(BaseModel):
    code: str
    title: str
    description: str
    icon: str


class CompletionResult(BaseModel):
    action_id: UUID
    date: _dt.date
    is_completed: bool
    completed_at: datetime | None
    already_completed: bool = False
    day_secured: bool  # all required actions for today are now done
    day_just_secured: bool  # …and this request is what secured it
    today_required: int
    today_completed: int
    current_streak: int
    best_streak: int
    new_achievements: list[AchievementBrief] = []
