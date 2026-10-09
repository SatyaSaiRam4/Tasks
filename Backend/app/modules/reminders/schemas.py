from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Priority = Literal["LOW", "NORMAL", "HIGH"]

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
    note: str | None = Field(default=None, max_length=2000)
    remind_at: datetime
    whatsapp_number: str | None = None
    alarm_enabled: bool = False
    priority: Priority = "NORMAL"
    track_id: UUID | None = None

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp_number(cls, value: str | None) -> str | None:
        return _normalize_whatsapp_number(value)


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    note: str | None = Field(default=None, max_length=2000)
    remind_at: datetime | None = None
    whatsapp_number: str | None = None
    clear_whatsapp_number: bool = False
    alarm_enabled: bool | None = None
    priority: Priority | None = None
    track_id: UUID | None = None
    clear_track: bool = False

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
    alarm_enabled: bool
    priority: str
    track_id: UUID | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SnoozeRequest(BaseModel):
    minutes: int = Field(default=10, ge=1, le=24 * 60)
