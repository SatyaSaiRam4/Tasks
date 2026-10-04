from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import NoteType


class NoteCreate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    content: str = Field(min_length=1)
    category_id: UUID | None = None
    task_id: UUID | None = None
    note_type: NoteType = NoteType.QUICK


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    content: str | None = Field(default=None, min_length=1)
    category_id: UUID | None = None
    note_type: NoteType | None = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None
    content: str
    category_id: UUID | None
    task_id: UUID | None
    note_type: NoteType
    pinned: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
