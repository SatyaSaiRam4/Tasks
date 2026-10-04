"""Polls for reminders whose WhatsApp side-channel is due and sends them.

The local push notification (scheduled on-device via react-native-notify-kit)
is independent of this worker and fires with or without a backend connection.
This worker only handles the optional WhatsApp message, since that has to be
sent from a server. Runs as a simple in-process polling loop rather than a
separate worker process — fine at this scale (see the project's "start
simple" philosophy); split it into its own process behind Celery/Redis if
reminder volume ever grows enough to matter.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import REMINDER_POLL_SECONDS
from app.db.session import SessionLocal
from app.integrations.msg91 import is_configured, send_whatsapp_reminder
from app.modules.reminders import service as reminders_service

logger = logging.getLogger("reminder_worker")

_scheduler: BackgroundScheduler | None = None


def _poll_due_reminders() -> None:
    if not is_configured():
        return

    db = SessionLocal()
    try:
        due = reminders_service.get_due_whatsapp_reminders(db)
        for reminder in due:
            message = reminder.title if not reminder.note else f"{reminder.title} — {reminder.note}"
            sent = send_whatsapp_reminder(reminder.whatsapp_number, message)
            reminders_service.mark_whatsapp_result(db, reminder.id, sent)
            if not sent:
                logger.warning("WhatsApp send failed for reminder %s", reminder.id)
    finally:
        db.close()


def start_reminder_worker() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_poll_due_reminders, "interval", seconds=REMINDER_POLL_SECONDS, id="reminder_whatsapp_poll")
    _scheduler.start()


def stop_reminder_worker() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
