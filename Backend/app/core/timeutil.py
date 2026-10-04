from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIMEZONE = "UTC"


def is_valid_timezone(name: str) -> bool:
    try:
        ZoneInfo(name)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def zone_for(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TIMEZONE)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def local_now(tz_name: str | None) -> datetime:
    """The current moment in the user's zone, always derived from the server clock."""
    return utc_now().astimezone(zone_for(tz_name))


def local_today(tz_name: str | None) -> date:
    return local_now(tz_name).date()
