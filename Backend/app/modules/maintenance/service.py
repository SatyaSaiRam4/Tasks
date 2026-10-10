"""The daily cleanup: removes what users no longer need, never the Vault.

  * Plans (and their tasks and ticks) CLEANUP_AFTER_DAYS after their end
    date, or after they were deleted.
  * Tasks CLEANUP_AFTER_DAYS after their own end date, or after deletion.
  * Reminders CLEANUP_AFTER_DAYS after they were marked done (the app's
    "Done" tab) or cancelled.
  * Vault notes VAULT_BIN_DAYS after they were put in the bin. Notes that
    are not in the bin are never touched.

Every user's ended days are finalized first, so streak points, history and
the wallet are settled before anything they were built from is removed.
"""

import logging
from datetime import timedelta

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core import config, timeutil
from app.modules.actions.models import Action
from app.modules.auth.models import User
from app.modules.reminders.models import Reminder, ReminderStatus
from app.modules.streaks.engine import finalize_user
from app.modules.tracks.models import Track
from app.modules.vault.models import VaultEntry

logger = logging.getLogger(__name__)


def run_cleanup(db: Session) -> dict[str, int]:
    finalized = 0
    for user_id in db.scalars(select(User.id)).all():
        try:
            user = db.get(User, user_id)
            if user is not None:
                finalize_user(db, user)
                finalized += 1
        except Exception:  # one user's failure must not stop the cleanup
            db.rollback()
            logger.exception("Finalizing user %s before cleanup failed", user_id)

    now = timeutil.utc_now()
    cutoff = now - timedelta(days=config.CLEANUP_AFTER_DAYS)
    cutoff_day = cutoff.date()

    plans = db.execute(
        delete(Track).where(or_(Track.end_date < cutoff_day, Track.deleted_at < cutoff))
    ).rowcount
    tasks = db.execute(
        delete(Action).where(or_(Action.end_date < cutoff_day, Action.deleted_at < cutoff))
    ).rowcount
    reminders = db.execute(
        delete(Reminder).where(
            or_(
                Reminder.completed_at < cutoff,
                (Reminder.status == ReminderStatus.CANCELLED) & (Reminder.updated_at < cutoff),
            )
        )
    ).rowcount
    bin_cutoff = now - timedelta(days=config.VAULT_BIN_DAYS)
    notes = db.execute(delete(VaultEntry).where(VaultEntry.deleted_at < bin_cutoff)).rowcount
    db.commit()
    result = {
        "users_finalized": finalized,
        "plans_deleted": plans,
        "tasks_deleted": tasks,
        "reminders_deleted": reminders,
        "bin_notes_deleted": notes,
    }
    logger.info("Daily cleanup: %s", result)
    return result
