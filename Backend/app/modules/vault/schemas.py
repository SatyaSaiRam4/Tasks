from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

PIN_PATTERN = r"^\d{4,6}$"


class VaultStatusOut(BaseModel):
    has_pin: bool
    locked_until: datetime | None
    autolock_minutes: int


class PinSetup(BaseModel):
    pin: str = Field(pattern=PIN_PATTERN, description="4–6 digits")


class PinUnlock(BaseModel):
    pin: str = Field(min_length=1, max_length=12)


class PinChange(BaseModel):
    current_pin: str = Field(min_length=1, max_length=12)
    new_pin: str = Field(pattern=PIN_PATTERN)


class VaultSessionOut(BaseModel):
    vault_token: str
    expires_at: datetime


def _clean_tags(tags: list[str] | None) -> list[str] | None:
    if tags is None:
        return None
    seen: list[str] = []
    for tag in tags:
        t = tag.strip()[:24]
        if t and t.lower() not in (s.lower() for s in seen):
            seen.append(t)
    return seen[:10]


class VaultEntryCreate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    # Empty is fine for a voice note; the recording is uploaded separately.
    content: str = Field(default="", max_length=20000)
    folder: str | None = Field(default=None, max_length=40)
    tags: list[str] = Field(default_factory=list, max_length=10)
    pinned: bool = False
    is_favorite: bool = False

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str]) -> list[str]:
        return _clean_tags(value) or []


class VaultEntryUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    content: str | None = Field(default=None, max_length=20000)
    folder: str | None = Field(default=None, max_length=40)
    tags: list[str] | None = Field(default=None, max_length=10)

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str] | None) -> list[str] | None:
        return _clean_tags(value)


class VaultEntrySummary(BaseModel):
    id: UUID
    title: str | None
    preview: str
    folder: str | None
    tags: list[str]
    pinned: bool
    is_favorite: bool
    is_archived: bool
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    has_audio: bool = False
    audio_seconds: int | None = None


class VaultEntryOut(VaultEntrySummary):
    content: str


class VaultFolderOut(BaseModel):
    name: str
    count: int
