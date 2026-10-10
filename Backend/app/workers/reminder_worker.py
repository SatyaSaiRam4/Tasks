"""Background jobs, run in-process on a single APScheduler instance.

  * WhatsApp side-channel for due reminders, then marking reminders whose time
    has passed as done (every REMINDER_POLL_SECONDS).
  * The daily cleanup at 02:00 IST (also callable by the GitHub Actions job):
    plans and tasks 7 days after their end, done reminders 7 days later.
  * Streak finalization for every user (every STREAK_FINALIZE_MINUTES), so
    ended days, Track bonuses and achievements are settled even for users who
    don't open the app. Request handlers also finalize lazily, so this job is a
    safety net, not a correctness requirement.

The local push notification (scheduled on-device) is independent of all of this.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.core.config import MSG91_WHATSAPP_TEMPLATE_STYLE, REMINDER_POLL_SECONDS, STREAK_FINALIZE_MINUTES
from app.integrations.messages import whatsapp_variables
from app.db.session import SessionLocal
from app.integrations.msg91 import is_configured, send_whatsapp_reminder
from app.modules.reminders import service as reminders_service

logger = logging.getLogger("workers")

_scheduler: BackgroundScheduler | None = None


def _poll_due_reminders() -> None:
    db = SessionLocal()
    try:
        whatsapp_ready = is_configured()
        if whatsapp_ready:
            from app.modules.auth.models import User

            for reminder in reminders_service.get_due_whatsapp_reminders(db):
                user = db.get(User, reminder.user_id)
                variables = whatsapp_variables(
                    MSG91_WHATSAPP_TEMPLATE_STYLE,
                    user.display_name if user else "",
                    reminder.title,
                    reminder.note,
                    reminder.remind_at,
                    user.timezone if user else None,
                )
                sent = send_whatsapp_reminder(reminder.whatsapp_number, variables)
                reminders_service.mark_whatsapp_result(db, reminder.id, sent)
                if not sent:
                    logger.warning("WhatsApp send failed for reminder %s", reminder.id)
        reminders_service.auto_complete_due(db, whatsapp_ready)
    except Exception:
        db.rollback()
        logger.exception("Reminder poll failed")
    finally:
        db.close()


def _daily_cleanup() -> None:
    from app.modules.maintenance.service import run_cleanup

    db = SessionLocal()
    try:
        run_cleanup(db)
    except Exception:
        db.rollback()
        logger.exception("Daily cleanup failed")
    finally:
        db.close()


def _finalize_all_streaks() -> None:
    from app.modules.auth.models import User
    from app.modules.streaks.engine import finalize_user

    db = SessionLocal()
    try:
        user_ids = db.scalars(select(User.id).where(User.is_active.is_(True))).all()
        for user_id in user_ids:
            try:
                user = db.get(User, user_id)
                if user is not None:
                    finalize_user(db, user)
            except Exception:  # one user's failure must not stop the rest
                db.rollback()
                logger.exception("Streak finalization failed for user %s", user_id)
    finally:
        db.close()


def start_reminder_worker() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    if not is_configured():
        logger.warning(
            "MSG91 WhatsApp is not configured: set MSG91_AUTH_KEY, MSG91_WHATSAPP_INTEGRATED_NUMBER, "
            "MSG91_WHATSAPP_TEMPLATE_NAME and MSG91_WHATSAPP_NAMESPACE in Backend/.env. "
            "Reminders will not be sent on WhatsApp until then."
        )
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_poll_due_reminders, "interval", seconds=REMINDER_POLL_SECONDS, id="reminder_whatsapp_poll")
    _scheduler.add_job(
        _finalize_all_streaks, "interval", minutes=STREAK_FINALIZE_MINUTES, id="streak_finalize", max_instances=1
    )
    # 20:30 UTC is 02:00 in India.
    _scheduler.add_job(_daily_cleanup, "cron", hour=20, minute=30, id="daily_cleanup", max_instances=1)
    _scheduler.start()


def stop_reminder_worker() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
