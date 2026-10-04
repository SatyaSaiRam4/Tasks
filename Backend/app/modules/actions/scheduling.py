"""Decides which Actions are due on which date.

This is the single definition of "due" shared by today's checklist, the
streak engine, and Track completion, so all three always agree.
"""

from datetime import date

from app.modules.tracks.models import Track

from .models import Action, RepeatType


def track_covers(track: Track, day: date) -> bool:
    if track.deleted_at is not None or track.is_archived:
        return False
    if day < track.start_date:
        return False
    return track.end_date is None or day <= track.end_date


def repeats_on(action: Action, day: date) -> bool:
    if day < action.start_date:
        return False
    if action.end_date is not None and day > action.end_date:
        return False

    if action.repeat_type == RepeatType.ONCE:
        return day == action.start_date
    if action.repeat_type == RepeatType.DAILY:
        return True
    if action.repeat_type == RepeatType.WEEKLY:
        weekdays = action.repeat_weekdays or [action.start_date.weekday()]
        return day.weekday() in weekdays
    if action.repeat_type == RepeatType.CUSTOM:
        interval = action.repeat_interval_days or 1
        return (day - action.start_date).days % interval == 0
    return False


def is_due(action: Action, track: Track, day: date) -> bool:
    """True if this Action should be done on `day` (required or not)."""
    if action.deleted_at is not None or not action.is_active:
        return False
    return track_covers(track, day) and repeats_on(action, day)
