"""The words of a reminder sent on WhatsApp (the premium channel).

A phone notification is a short nudge on this device; an alarm is the same
nudge, loud. WhatsApp is personal and reaches any number, even when the app
is closed or uninstalled, so it says who it's for, what, and exactly when.
The one-line style also carries the note.

WhatsApp template variables can't contain line breaks, so every value here
is a single line; the template itself provides the layout.
"""

from datetime import datetime

from app.core.timeutil import zone_for


def _when(at: datetime, timezone: str | None) -> str:
    local = at.astimezone(zone_for(timezone))
    hour = local.strftime("%I:%M %p").lstrip("0")
    return f"{local.strftime('%a, %d %b')} at {hour}"


def whatsapp_variables(style: str, name: str, title: str, note: str | None, at: datetime, timezone: str | None) -> list[str]:
    first = (name or "there").split()[0]
    when = _when(at, timezone)
    extra = " ".join((note or "").split())
    if style == "detailed":
        return [first, title, when]
    one_line = f"⏰ {title} · {when}" + (f" · 📝 {extra}" if extra else "")
    return [one_line]


def consent_variables(style: str, requester: str) -> list[str]:
    """The one-time permission request sent through the same template: no code,
    just asking the owner of the number to reply YES (or STOP)."""
    who = (requester or "Someone").split()[0]
    if style == "detailed":
        return ["there", f"{who} wants to send you reminders from the Memo app here. Within 1 minute, tap 👍 to allow or 👎 to refuse (or reply YES / STOP)", "Within 1 minute"]
    return [f"👋 {who} wants to send you reminders from the Memo app on this WhatsApp. Within 1 minute, tap 👍 to allow or 👎 to refuse (or reply YES / STOP)."]
