from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import TaskPriority, TaskStatus


class TaskTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    icon: str | None = None
    color: str | None = None


class TaskTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    icon: str | None
    color: str | None
    is_system: bool


class TaskChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    is_completed: bool
    sort_order: int


class TaskChecklistItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class TaskChecklistItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    is_completed: bool | None = None


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category_id: UUID | None = None
    task_type_id: UUID | None = None
    priority: TaskPriority = TaskPriority.NORMAL
    scheduled_at: datetime | None = None
    repeat_rule: dict | None = None
    checklist: list[TaskChecklistItemCreate] = []


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: UUID | None = None
    task_type_id: UUID | None = None
    priority: TaskPriority | None = None
    scheduled_at: datetime | None = None
    repeat_rule: dict | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    category_id: UUID | None
    task_type_id: UUID | None
    status: TaskStatus
    priority: TaskPriority
    scheduled_at: datetime | None
    repeat_rule: dict | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    checklist_items: list[TaskChecklistItemOut] = []
