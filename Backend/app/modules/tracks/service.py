from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import local_today, utc_now
from app.modules.actions.models import Action
from app.modules.actions.scheduling import is_due
from app.modules.auth.models import User
from app.modules.streaks import engine

from .models import Track
from .schemas import TrackDayOut, TrackGridOut, TrackGridRowOut, TrackOut

MAX_DAYS_RANGE = 120


def get_owned_track(db: Session, user_id: UUID, track_id: UUID) -> Track:
    track = db.scalar(
        select(Track).where(Track.id == track_id, Track.user_id == user_id, Track.deleted_at.is_(None))
    )
    if not track:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Track not found.")
    return track


def _ensure_unique_name(db: Session, user_id: UUID, name: str, exclude_id: UUID | None = None) -> None:
    stmt = select(Track.id).where(
        Track.user_id == user_id, func.lower(Track.name) == name.lower(), Track.deleted_at.is_(None)
    )
    if exclude_id is not None:
        stmt = stmt.where(Track.id != exclude_id)
    if db.scalar(stmt):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a Track with this name.")


def _status_for(track: Track, today: date) -> str:
    if track.is_archived:
        return "ARCHIVED"
    if today < track.start_date:
        return "UPCOMING"
    if track.end_date is not None and today > track.end_date:
        return "ENDED"
    return "ACTIVE"


def decorate(
    tracks: list[Track], user: User, schedule: engine.Schedule, completions: set, today: date
) -> list[TrackOut]:
    out: list[TrackOut] = []
    for track in tracks:
        item = TrackOut.model_validate(track)
        item.status = _status_for(track, today)
        item.action_count = sum(1 for a, t in schedule.pairs if t.id == track.id and a.is_active)
        item.today_required, item.today_completed = engine.day_counts(schedule, completions, today, track_id=track.id)
        if today >= track.start_date:
            last = min(today, track.end_date) if track.end_date else today
            item.day_number = (last - track.start_date).days + 1
        if track.end_date is not None:
            item.total_days = (track.end_date - track.start_date).days + 1
            item.days_remaining = max((track.end_date - today).days, 0) if today <= track.end_date else 0
        item.streak = engine.track_streak(schedule, completions, track, today)

        required_total = completed_total = 0
        day = max(track.start_date, today - timedelta(days=365))
        last_day = min(today, track.end_date) if track.end_date else today
        while day <= last_day:
            r, c = engine.day_counts(schedule, completions, day, track_id=track.id)
            required_total += r
            completed_total += c
            day += timedelta(days=1)
        item.completion_rate = round(completed_total / required_total, 3) if required_total else 0.0
        out.append(item)
    return out


def _context(db: Session, user: User):
    today = local_today(user.timezone)
    schedule = engine.load_schedule(db, user.id)
    completions = engine.load_completions(db, user.id, today - timedelta(days=366), today)
    return today, schedule, completions


def list_tracks(db: Session, user: User, include_archived: bool) -> list[TrackOut]:
    engine.finalize_user(db, user)
    stmt = select(Track).where(Track.user_id == user.id, Track.deleted_at.is_(None))
    if not include_archived:
        stmt = stmt.where(Track.is_archived.is_(False))
    tracks = list(db.scalars(stmt.order_by(Track.sort_order, Track.created_at)).all())
    today, schedule, completions = _context(db, user)
    return decorate(tracks, user, schedule, completions, today)


def get_track(db: Session, user: User, track_id: UUID) -> TrackOut:
    track = get_owned_track(db, user.id, track_id)
    today, schedule, completions = _context(db, user)
    return decorate([track], user, schedule, completions, today)[0]


def create_track(db: Session, user: User, data: dict) -> TrackOut:
    engine.finalize_user(db, user)
    _ensure_unique_name(db, user.id, data["name"])
    today = local_today(user.timezone)
    start = data.get("start_date") or today
    if data.get("end_date") and data["end_date"] < start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "End date must be on or after the start date.")
    max_sort = db.scalar(select(func.max(Track.sort_order)).where(Track.user_id == user.id)) or 0
    track = Track(
        user_id=user.id,
        name=data["name"].strip(),
        description=data.get("description"),
        icon=data.get("icon"),
        color=data.get("color"),
        start_date=start,
        end_date=data.get("end_date"),
        sort_order=max_sort + 1,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return get_track(db, user, track.id)


def update_track(db: Session, user: User, track_id: UUID, fields: dict) -> TrackOut:
    # Lock in every finished day first, so this edit can only affect today onward.
    engine.finalize_user(db, user)
    track = get_owned_track(db, user.id, track_id)

    if fields.get("name"):
        _ensure_unique_name(db, user.id, fields["name"], exclude_id=track.id)
    clear_end = fields.pop("clear_end_date", False)
    for key in ("name", "description", "icon", "color", "start_date", "end_date", "sort_order"):
        if key in fields and fields[key] is not None:
            setattr(track, key, fields[key].strip() if key == "name" else fields[key])
    if "description" in fields and fields["description"] is None:
        track.description = None
    if clear_end:
        track.end_date = None
    if track.end_date is not None and track.end_date < track.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "End date must be on or after the start date.")

    db.commit()
    return get_track(db, user, track.id)


def set_archived(db: Session, user: User, track_id: UUID, archived: bool) -> TrackOut:
    engine.finalize_user(db, user)
    track = get_owned_track(db, user.id, track_id)
    track.is_archived = archived
    db.commit()
    return get_track(db, user, track.id)


def delete_track(db: Session, user: User, track_id: UUID) -> None:
    """Soft delete: finalized history that included this Track stays intact."""
    engine.finalize_user(db, user)
    track = get_owned_track(db, user.id, track_id)
    track.deleted_at = utc_now()
    db.commit()


def track_days(db: Session, user: User, track_id: UUID, start: date, end: date) -> list[TrackDayOut]:
    if end < start or (end - start).days > MAX_DAYS_RANGE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Choose a range of at most {MAX_DAYS_RANGE} days.")
    track = get_owned_track(db, user.id, track_id)
    today = local_today(user.timezone)
    schedule = engine.load_schedule(db, user.id)
    completions = engine.load_completions(db, user.id, start, min(end, today))

    out: list[TrackDayOut] = []
    day = start
    while day <= end:
        required, completed = engine.day_counts(schedule, completions, day, track_id=track.id)
        if day > today:
            status_ = "FUTURE"
        elif day == today:
            status_ = "SUCCESS" if required and completed >= required else ("PENDING" if required else "NO_ACTIONS")
        else:
            status_ = engine.classify(required, completed)
        out.append(TrackDayOut(date=day, required=required, completed=completed, status=status_))
        day += timedelta(days=1)
    return out


def track_grid(db: Session, user: User, track_id: UUID, start: date, end: date) -> TrackGridOut:
    """The category table: one row per task, one column per day, a mark in each cell."""
    if end < start or (end - start).days > MAX_DAYS_RANGE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Choose a range of at most {MAX_DAYS_RANGE} days.")
    track = get_owned_track(db, user.id, track_id)
    today = local_today(user.timezone)
    actions = db.scalars(
        select(Action)
        .where(Action.track_id == track.id, Action.deleted_at.is_(None))
        .order_by(Action.sort_order, Action.created_at)
    ).all()
    completions = engine.load_completions(db, user.id, start, min(end, today))

    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    rows = []
    for action in actions:
        cells = []
        for day in days:
            if not is_due(action, track, day):
                cells.append("NONE")
            elif day > today:
                cells.append("FUTURE")
            elif (action.id, day) in completions:
                cells.append("DONE")
            else:
                cells.append("TODO" if day == today else "MISSED")
        rows.append(TrackGridRowOut(action_id=action.id, title=action.title, cells=cells))
    return TrackGridOut(today=today, days=days, rows=rows)
