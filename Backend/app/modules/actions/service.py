from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.timeutil import local_today, utc_now
from app.modules.achievements.catalog import BY_CODE
from app.modules.auth.models import User
from app.modules.streaks import engine
from app.modules.tracks.models import Track
from app.modules.tracks.service import get_owned_track
from app.modules.users.models import ConfirmationMode

from .models import Action, ActionCompletion, ActionStep, ConfirmationMethod, RepeatType
from .scheduling import is_due
from .schemas import (
    AchievementBrief,
    ActionOut,
    AgendaGroup,
    AgendaItem,
    AgendaOut,
    CompletionResult,
    TrackRef,
)


def get_owned_action(db: Session, user_id: UUID, action_id: UUID) -> Action:
    action = db.scalar(
        select(Action)
        .options(selectinload(Action.steps))
        .where(Action.id == action_id, Action.user_id == user_id, Action.deleted_at.is_(None))
    )
    if not action:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action not found.")
    return action


def _validate_schedule(action: Action) -> None:
    if action.repeat_type not in RepeatType.ALL:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown repeat type.")
    if action.repeat_type == RepeatType.WEEKLY and not action.repeat_weekdays:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Pick at least one weekday for a weekly action.")
    if action.repeat_type == RepeatType.CUSTOM and not action.repeat_interval_days:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose how many days apart this action repeats.")
    if action.end_date is not None and action.end_date < action.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "End date must be on or after the start date.")


def _set_steps(action: Action, titles: list[str]) -> None:
    action.steps.clear()
    for index, title in enumerate(titles):
        action.steps.append(ActionStep(title=title, sort_order=index))


def list_track_actions(db: Session, user: User, track_id: UUID) -> list[Action]:
    get_owned_track(db, user.id, track_id)
    return list(
        db.scalars(
            select(Action)
            .options(selectinload(Action.steps))
            .where(Action.track_id == track_id, Action.user_id == user.id, Action.deleted_at.is_(None))
            .order_by(Action.time_of_day.is_(None), Action.time_of_day, Action.sort_order, Action.created_at)
        ).all()
    )


def create_action(db: Session, user: User, track_id: UUID, data: dict) -> Action:
    engine.finalize_user(db, user)
    track = get_owned_track(db, user.id, track_id)
    today = local_today(user.timezone)
    steps = data.pop("steps", [])
    if data.get("start_date") is None:
        data["start_date"] = max(today, track.start_date)
    max_sort = db.scalar(select(func.max(Action.sort_order)).where(Action.track_id == track.id)) or 0
    action = Action(user_id=user.id, track_id=track.id, sort_order=max_sort + 1, **data)
    if action.repeat_type != RepeatType.WEEKLY:
        action.repeat_weekdays = None
    if action.repeat_type != RepeatType.CUSTOM:
        action.repeat_interval_days = None
    _validate_schedule(action)
    _set_steps(action, steps)
    db.add(action)
    db.commit()
    return get_owned_action(db, user.id, action.id)


def update_action(db: Session, user: User, action_id: UUID, fields: dict) -> Action:
    # Lock in every finished day first, so this edit can only affect today onward.
    engine.finalize_user(db, user)
    action = get_owned_action(db, user.id, action_id)

    steps = fields.pop("steps", None)
    clear_time = fields.pop("clear_time", False)
    clear_end = fields.pop("clear_end_date", False)
    for key, value in fields.items():
        if value is not None or key == "description":
            setattr(action, key, value)
    if clear_time:
        action.time_of_day = None
    if clear_end:
        action.end_date = None
    if action.repeat_type != RepeatType.WEEKLY:
        action.repeat_weekdays = None
    if action.repeat_type != RepeatType.CUSTOM:
        action.repeat_interval_days = None
    _validate_schedule(action)
    if steps is not None:
        _set_steps(action, [s.strip()[:160] for s in steps if s and s.strip()])
    db.commit()
    return get_owned_action(db, user.id, action.id)


def delete_action(db: Session, user: User, action_id: UUID) -> None:
    """Soft delete: past completions and finalized days stay untouched."""
    engine.finalize_user(db, user)
    action = get_owned_action(db, user.id, action_id)
    action.deleted_at = utc_now()
    db.commit()


def agenda(db: Session, user: User, day: date | None) -> AgendaOut:
    engine.finalize_user(db, user)
    today = local_today(user.timezone)
    day = day or today
    schedule = engine.load_schedule(db, user.id)
    completion_rows = db.execute(
        select(ActionCompletion.action_id, ActionCompletion.completed_at).where(
            ActionCompletion.user_id == user.id,
            ActionCompletion.scheduled_date == day,
            ActionCompletion.revoked_at.is_(None),
        )
    ).all()
    completed_at = {r.action_id: r.completed_at for r in completion_rows}

    groups: dict[UUID, AgendaGroup] = {}
    track_order: dict[UUID, tuple] = {}
    for action, track in schedule.due_on(day):
        group = groups.get(track.id)
        if group is None:
            group = AgendaGroup(
                track=TrackRef(id=track.id, name=track.name, icon=track.icon, color=track.color),
                items=[],
                required=0,
                completed=0,
            )
            groups[track.id] = group
            track_order[track.id] = (track.sort_order, track.created_at)
        done = action.id in completed_at
        group.items.append(
            AgendaItem(action=ActionOut.model_validate(action), is_completed=done, completed_at=completed_at.get(action.id))
        )
        if action.is_required:
            group.required += 1
            group.completed += int(done)

    ordered = sorted(groups.values(), key=lambda g: track_order[g.track.id])
    for group in ordered:
        group.items.sort(
            key=lambda i: (i.action.time_of_day is None, i.action.time_of_day or 0, i.action.sort_order)
        )
    return AgendaOut(
        date=day,
        is_today=day == today,
        editable=day == today,
        required=sum(g.required for g in ordered),
        completed=sum(g.completed for g in ordered),
        groups=ordered,
    )


def _check_today(user: User, requested: date | None) -> date:
    today = local_today(user.timezone)
    day = requested or today
    if day > today:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "You can't complete an action for a future day.")
    if day < today:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Past days are locked, which keeps every streak honest."
        )
    return day


def _result(db: Session, user: User, action_id: UUID, day: date, was_secured: bool, new_codes: list[str], already: bool) -> CompletionResult:
    live = db.scalar(
        select(ActionCompletion).where(
            ActionCompletion.action_id == action_id,
            ActionCompletion.scheduled_date == day,
            ActionCompletion.revoked_at.is_(None),
        )
    )
    today = engine.today_status(db, user)
    return CompletionResult(
        action_id=action_id,
        date=day,
        is_completed=live is not None,
        completed_at=live.completed_at if live else None,
        already_completed=already,
        day_secured=today.secured,
        day_just_secured=today.secured and not was_secured,
        today_required=today.required,
        today_completed=today.completed,
        current_streak=today.current_streak,
        best_streak=today.best_streak,
        new_achievements=[
            AchievementBrief(code=c, title=BY_CODE[c].title, description=BY_CODE[c].description, icon=BY_CODE[c].icon)
            for c in new_codes
            if c in BY_CODE
        ],
    )


def complete_action(db: Session, user: User, action_id: UUID, confirmed: bool, method: str, requested: date | None) -> CompletionResult:
    if not confirmed:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Please confirm you actually completed this action."
        )
    if method not in ConfirmationMode.ALL:
        method = ConfirmationMethod.STANDARD

    engine.finalize_user(db, user)
    day = _check_today(user, requested)
    action = get_owned_action(db, user.id, action_id)
    track = db.get(Track, action.track_id)
    if track is None or not is_due(action, track, day):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "This action isn't scheduled for today.")

    was_secured = engine.today_status(db, user).secured
    existing = db.scalar(
        select(ActionCompletion).where(
            ActionCompletion.action_id == action.id,
            ActionCompletion.scheduled_date == day,
            ActionCompletion.revoked_at.is_(None),
        )
    )
    if existing is not None:
        return _result(db, user, action.id, day, was_secured, [], already=True)

    db.add(
        ActionCompletion(
            user_id=user.id,
            action_id=action.id,
            track_id=action.track_id,
            scheduled_date=day,
            completed_at=utc_now(),
            confirmation_method=method,
        )
    )
    try:
        db.flush()
    except IntegrityError:
        # A concurrent request recorded it first; the unique index kept it single.
        db.rollback()
        return _result(db, user, action.id, day, was_secured, [], already=True)

    new_codes = engine.finalize_user(db, user)  # evaluates achievements, commits
    return _result(db, user, action.id, day, was_secured, new_codes, already=False)


def uncomplete_action(db: Session, user: User, action_id: UUID, requested: date | None) -> CompletionResult:
    engine.finalize_user(db, user)
    day = _check_today(user, requested)
    action = get_owned_action(db, user.id, action_id)
    was_secured = engine.today_status(db, user).secured
    live = db.scalar(
        select(ActionCompletion).where(
            ActionCompletion.action_id == action.id,
            ActionCompletion.scheduled_date == day,
            ActionCompletion.revoked_at.is_(None),
        )
    )
    if live is not None:
        live.revoked_at = utc_now()  # kept for the audit trail
        db.commit()
    return _result(db, user, action.id, day, was_secured, [], already=False)
