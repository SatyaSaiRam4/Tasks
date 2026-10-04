from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    sort_order: int
    is_active: bool


class ChecklistItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class ChecklistItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    is_active: bool | None = None


class ChecklistReorderRequest(BaseModel):
    item_ids: list[UUID]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    icon: str | None = None
    color: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    icon: str | None = None
    color: str | None = None
    sort_order: int | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    icon: str | None
    color: str | None
    sort_order: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    checklist_items: list[ChecklistItemOut] = []
