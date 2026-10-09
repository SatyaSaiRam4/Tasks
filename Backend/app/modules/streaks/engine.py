"""Server-authoritative streak engine.

Rules (see PROJECT.md for the product description):
  * The streak is a points score. Each finished day adds 1 point for every
    plan (Track) whose required Actions due that day were all completed, and
    takes 1 point away for every plan that had something due but wasn't
    finished. It never goes below 0, and best_streak keeps the highest score
    reached (the wallet pays on that, so a deduction never takes money back).
    A day with nothing due changes nothing.
  * A day's status is still recorded: SUCCESS when every required Action
    due that day was completed, FAILED when one was missed, NO_ACTIONS when
    nothing was due.
  * Days are judged in the user's timezone, using the server clock.
  * A day is finalized (written to DailyRecord, immutably) only after it has
    ended. Today is always provisional.
  * Completions can only be recorded for today, so a finalized day can never
    be repaired retroactively.
  * Every mutating request finalizes past days *before* applying its change,
    so edits to Tracks/Actions only ever affect today and later.
"""

import datetime as _dt
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import config
from app.core.timeutil import local_now, local_today
from app.modules.actions.models import Action, ActionCompletion
from app.modules.actions.scheduling import is_due
from app.modules.auth.models import User
from app.modules.tracks.models import Track

from .models import DailyRecord, DayStatus, StreakState, TrackCompletion

# Hour (local) after which an incomplete day is flagged as "at risk".
STREAK_RISK_HOUR = 18


@dataclass
class Schedule:
    """Every non-deleted Action of a user, paired with its Track."""

    pairs: list[tuple[Action, Track]] = field(default_factory=list)

    def due_on(self, day: date, track_id: UUID | None = None, required_only: bool = False):
        for action, track in self.pairs:
            if track_id is not None and track.id != track_id:
                continue
            if required_only and not action.is_required:
                continue
            if is_due(action, track, day):
                yield action, track


def load_schedule(db: Session, user_id: UUID) -> Schedule:
    rows = db.execute(
        select(Action, Track)
        .join(Track, Track.id == Action.track_id)
        .where(Action.user_id == user_id, Action.deleted_at.is_(None), Track.deleted_at.is_(None))
    ).all()
    return Schedule(pairs=[(a, t) for a, t in rows])


def load_completions(db: Session, user_id: UUID, start: date, end: date) -> set[tuple[UUID, date]]:
    rows = db.execute(
        select(ActionCompletion.action_id, ActionCompletion.scheduled_date).where(
            ActionCompletion.user_id == user_id,
            ActionCompletion.revoked_at.is_(None),
            ActionCompletion.scheduled_date >= start,
            ActionCompletion.scheduled_date <= end,
        )
    ).all()
    return {(r.action_id, r.scheduled_date) for r in rows}


def day_counts(
    schedule: Schedule, completions: set[tuple[UUID, date]], day: date, track_id: UUID | None = None
) -> tuple[int, int]:
    required = 0
    completed = 0
    for action, _track in schedule.due_on(day, track_id=track_id, required_only=True):
        required += 1
        if (action.id, day) in completions:
            completed += 1
    return required, completed


def plan_points(schedule: Schedule, completions: set[tuple[UUID, date]], day: date) -> tuple[int, int]:
    """(plans finished, plans missed) on `day`, counting only plans with something required due."""
    per_track: dict[UUID, list[int]] = {}
    for action, track in schedule.due_on(day, required_only=True):
        counts = per_track.setdefault(track.id, [0, 0])
        counts[0] += 1
        counts[1] += int((action.id, day) in completions)
    finished = sum(1 for required, done in per_track.values() if done >= required)
    return finished, len(per_track) - finished


def classify(required: int, completed: int) -> str:
    if required == 0:
        return DayStatus.NO_ACTIONS
    return DayStatus.SUCCESS if completed >= required else DayStatus.FAILED


def get_or_create_state(db: Session, user: User) -> StreakState:
    state = db.get(StreakState, user.id)
    if state is None:
        today = local_today(user.timezone)
        state = StreakState(
            user_id=user.id,
            current_streak=0,
            best_streak=0,
            tracking_started_on=today,
            last_finalized_date=today - timedelta(days=1),
            total_success_days=0,
            total_failed_days=0,
            bonus_points=0,
        )
        db.add(state)
        db.flush()
    return state


def compute_bonus(duration_days: int, required_total: int, completed_total: int) -> int:
    if duration_days < config.TRACK_BONUS_MIN_DAYS or required_total == 0:
        return 0
    rate = completed_total / required_total
    if config.TRACK_BONUS_REQUIRE_PERFECT:
        multiplier = 1.0 if completed_total >= required_total else 0.0
    else:
        multiplier = rate if rate >= config.TRACK_BONUS_MIN_COMPLETION else 0.0
    avg_per_day = required_total / duration_days
    difficulty = 1 + min(max(avg_per_day - 1, 0), config.TRACK_BONUS_DIFFICULTY_CAP) * config.TRACK_BONUS_DIFFICULTY_STEP
    return math.floor(duration_days * config.TRACK_BONUS_PER_DAY * multiplier * difficulty)


def _evaluate_track_completions(
    db: Session, user: User, state: StreakState, schedule: Schedule, through: date
) -> list[TrackCompletion]:
    """Scores every dated Track whose end_date has fully passed and hasn't been scored yet."""
    evaluated_ids = set(
        db.scalars(select(TrackCompletion.track_id).where(TrackCompletion.user_id == user.id)).all()
    )
    tracks = {t.id: t for _a, t in schedule.pairs}
    created: list[TrackCompletion] = []
    for track in tracks.values():
        if track.end_date is None or track.end_date > through or track.id in evaluated_ids:
            continue
        if track.is_archived:
            continue
        start = max(track.start_date, state.tracking_started_on)
        if start > track.end_date:
            continue  # the whole Track predates streak tracking
        completions = load_completions(db, user.id, start, track.end_date)
        required_total = 0
        completed_total = 0
        day = start
        while day <= track.end_date:
            r, c = day_counts(schedule, completions, day, track_id=track.id)
            required_total += r
            completed_total += c
            day += timedelta(days=1)
        duration = (track.end_date - start).days + 1
        bonus = compute_bonus(duration, required_total, completed_total)
        record = TrackCompletion(
            user_id=user.id,
            track_id=track.id,
            track_name=track.name,
            start_date=start,
            end_date=track.end_date,
            duration_days=duration,
            required_total=required_total,
            completed_total=completed_total,
            is_perfect=required_total > 0 and completed_total >= required_total,
            bonus_points=bonus,
        )
        db.add(record)
        state.bonus_points += bonus
        created.append(record)
    return created


def finalize_user(db: Session, user: User, check_achievements: bool = False) -> list[str]:
    """Finalizes every ended, unjudged day for `user` and scores ended Tracks.

    Idempotent and safe to call on every request. Achievements are checked
    only when a day was finalized here or `check_achievements` is set (after a
    completion), since the check costs several queries. Returns codes of any
    newly earned achievements. Commits.
    """
    from app.modules.achievements.service import evaluate_achievements

    state = get_or_create_state(db, user)
    today = local_today(user.timezone)
    yesterday = today - timedelta(days=1)

    finalized_any = state.last_finalized_date < yesterday
    if finalized_any:
        schedule = load_schedule(db, user.id)
        start = state.last_finalized_date + timedelta(days=1)
        completions = load_completions(db, user.id, start, yesterday)
        day = start
        while day <= yesterday:
            required, completed = day_counts(schedule, completions, day)
            status = classify(required, completed)
            finished, missed = plan_points(schedule, completions, day)
            state.current_streak = max(state.current_streak + finished - missed, 0)
            state.best_streak = max(state.best_streak, state.current_streak)
            if status == DayStatus.SUCCESS:
                state.total_success_days += 1
                state.last_success_date = day
            elif status == DayStatus.FAILED:
                state.total_failed_days += 1
            db.add(
                DailyRecord(
                    user_id=user.id,
                    record_date=day,
                    required_count=required,
                    completed_count=completed,
                    status=status,
                    streak_after=state.current_streak,
                )
            )
            state.last_finalized_date = day
            day += timedelta(days=1)
        _evaluate_track_completions(db, user, state, schedule, through=yesterday)

    if not (finalized_any or check_achievements):
        db.commit()  # keeps a newly created StreakState
        return []
    # The session doesn't autoflush; achievements query the rows written above.
    db.flush()
    new_codes = evaluate_achievements(db, user, state)
    db.commit()
    return new_codes


@dataclass
class TodayStatus:
    date: _dt.date
    required: int
    completed: int
    optional_due: int
    optional_completed: int
    secured: bool  # every required Action for today is done
    plans_due: int  # plans with something required due today
    plans_done: int  # of those, plans already finished today
    current_streak: int  # includes today's finished plans (provisional)
    best_streak: int
    at_risk: bool


def today_status(db: Session, user: User) -> TodayStatus:
    """Today's live progress. Assumes finalize_user ran recently."""
    state = get_or_create_state(db, user)
    today = local_today(user.timezone)
    schedule = load_schedule(db, user.id)
    completions = load_completions(db, user.id, today, today)

    required = completed = optional_due = optional_completed = 0
    for action, _track in schedule.due_on(today):
        done = (action.id, today) in completions
        if action.is_required:
            required += 1
            completed += int(done)
        else:
            optional_due += 1
            optional_completed += int(done)

    secured = required > 0 and completed >= required
    # Today's finished plans count straight away; missed ones are only
    # deducted once the day has ended.
    plans_done, plans_missed = plan_points(schedule, completions, today)
    current = state.current_streak + plans_done
    best = max(state.best_streak, current)
    at_risk = (
        required > 0
        and not secured
        and state.current_streak > 0
        and local_now(user.timezone).hour >= STREAK_RISK_HOUR
    )
    return TodayStatus(
        date=today,
        required=required,
        completed=completed,
        optional_due=optional_due,
        optional_completed=optional_completed,
        secured=secured,
        plans_due=plans_done + plans_missed,
        plans_done=plans_done,
        current_streak=current,
        best_streak=best,
        at_risk=at_risk,
    )


@dataclass
class Totals:
    success_days: int
    failed_days: int
    consistency_pct: float
    consistency_score: int


def totals(state: StreakState, today: TodayStatus) -> Totals:
    """Lifetime totals. Like current_streak, a secured today counts as a
    success straight away (provisionally), so the numbers never disagree
    with the streak shown next to them. An unfinished today isn't judged."""
    success = state.total_success_days + (1 if today.secured else 0)
    failed = state.total_failed_days
    judged = success + failed
    return Totals(
        success_days=success,
        failed_days=failed,
        consistency_pct=round(100 * success / judged, 1) if judged else 0.0,
        consistency_score=success + state.bonus_points,
    )


def track_streak(schedule: Schedule, completions: set[tuple[UUID, date]], track: Track, today: date) -> int:
    """Consecutive successful days for one Track, counting back from today
    (today counts only once secured; an unfinished today doesn't break it)."""
    streak = 0
    day = today
    r, c = day_counts(schedule, completions, day, track_id=track.id)
    if r > 0 and c >= r:
        streak += 1
    day -= timedelta(days=1)
    lower = max(track.start_date, today - timedelta(days=366))
    while day >= lower:
        r, c = day_counts(schedule, completions, day, track_id=track.id)
        if r == 0:
            day -= timedelta(days=1)
            continue
        if c < r:
            break
        streak += 1
        day -= timedelta(days=1)
    return streak
