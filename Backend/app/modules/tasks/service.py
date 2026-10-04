from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.categories.models import Category

from .models import Task, TaskChecklistItem, TaskStatus, TaskType


def list_task_types(db: Session, user_id: UUID) -> list[TaskType]:
    stmt = (
        select(TaskType)
        .where((TaskType.user_id == user_id) | (TaskType.is_system.is_(True)))
        .order_by(TaskType.is_system.desc(), TaskType.name)
    )
    return list(db.scalars(stmt))


def create_task_type(db: Session, user_id: UUID, name: str, icon: str | None, color: str | None) -> TaskType:
    task_type = TaskType(user_id=user_id, name=name, icon=icon, color=color, is_system=False)
    db.add(task_type)
    db.commit()
    db.refresh(task_type)
    return task_type


def delete_task_type(db: Session, user_id: UUID, task_type_id: UUID) -> None:
    task_type = db.scalar(
        select(TaskType).where(TaskType.id == task_type_id, TaskType.user_id == user_id, TaskType.is_system.is_(False))
    )
    if not task_type:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task type not found.")
    db.delete(task_type)
    db.commit()


def _validate_category(db: Session, user_id: UUID, category_id: UUID | None) -> None:
    if category_id is None:
        return
    exists = db.scalar(select(Category.id).where(Category.id == category_id, Category.user_id == user_id))
    if not exists:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found.")


def _get_owned_task(db: Session, user_id: UUID, task_id: UUID) -> Task:
    task = db.scalar(
        select(Task).options(selectinload(Task.checklist_items)).where(Task.id == task_id, Task.user_id == user_id)
    )
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found.")
    return task


def list_tasks(
    db: Session, user_id: UUID, status_filter: TaskStatus | None, category_id: UUID | None
) -> list[Task]:
    stmt = select(Task).options(selectinload(Task.checklist_items)).where(Task.user_id == user_id)
    if status_filter is not None:
        stmt = stmt.where(Task.status == status_filter)
    if category_id is not None:
        stmt = stmt.where(Task.category_id == category_id)
    stmt = stmt.order_by(Task.scheduled_at.is_(None), Task.scheduled_at, Task.created_at.desc())
    return list(db.scalars(stmt).unique())


def create_task(db: Session, user_id: UUID, data: dict, checklist_titles: list[str]) -> Task:
    _validate_category(db, user_id, data.get("category_id"))
    task = Task(user_id=user_id, **data)
    task.checklist_items = [
        TaskChecklistItem(title=title, sort_order=index) for index, title in enumerate(checklist_titles)
    ]
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_task(db: Session, user_id: UUID, task_id: UUID) -> Task:
    return _get_owned_task(db, user_id, task_id)


def update_task(db: Session, user_id: UUID, task_id: UUID, fields: dict) -> Task:
    task = _get_owned_task(db, user_id, task_id)
    if "category_id" in fields:
        _validate_category(db, user_id, fields["category_id"])
    for key, value in fields.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, user_id: UUID, task_id: UUID) -> None:
    task = _get_owned_task(db, user_id, task_id)
    db.delete(task)
    db.commit()


def set_task_complete(db: Session, user_id: UUID, task_id: UUID, completed: bool) -> Task:
    task = _get_owned_task(db, user_id, task_id)
    task.status = TaskStatus.COMPLETED if completed else TaskStatus.PENDING
    task.completed_at = datetime.now(timezone.utc) if completed else None
    db.commit()
    db.refresh(task)
    return task


def add_task_checklist_item(db: Session, user_id: UUID, task_id: UUID, title: str) -> TaskChecklistItem:
    task = _get_owned_task(db, user_id, task_id)
    max_sort = max((item.sort_order for item in task.checklist_items), default=-1)
    item = TaskChecklistItem(task_id=task.id, title=title, sort_order=max_sort + 1)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _get_owned_task_checklist_item(db: Session, user_id: UUID, item_id: UUID) -> TaskChecklistItem:
    item = db.scalar(
        select(TaskChecklistItem).join(Task).where(TaskChecklistItem.id == item_id, Task.user_id == user_id)
    )
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checklist item not found.")
    return item


def update_task_checklist_item(db: Session, user_id: UUID, item_id: UUID, fields: dict) -> TaskChecklistItem:
    item = _get_owned_task_checklist_item(db, user_id, item_id)
    for key, value in fields.items():
        if value is not None:
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_task_checklist_item(db: Session, user_id: UUID, item_id: UUID) -> None:
    item = _get_owned_task_checklist_item(db, user_id, item_id)
    db.delete(item)
    db.commit()
