from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import ReminderStatus, WhatsAppStatus


def _normalize_whatsapp_number(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if not trimmed.startswith("+") or not trimmed[1:].isdigit() or len(trimmed) < 8:
        raise ValueError("WhatsApp number must be in international format, e.g. +919876543210.")
    return trimmed


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    note: str | None = None
    remind_at: datetime
    whatsapp_number: str | None = None

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp_number(cls, value: str | None) -> str | None:
        return _normalize_whatsapp_number(value)


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    note: str | None = None
    remind_at: datetime | None = None
    whatsapp_number: str | None = None
    clear_whatsapp_number: bool = False

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp_number(cls, value: str | None) -> str | None:
        return _normalize_whatsapp_number(value)


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    note: str | None
    remind_at: datetime
    status: ReminderStatus
    whatsapp_number: str | None
    whatsapp_status: WhatsAppStatus
    created_at: datetime
    updated_at: datetime
