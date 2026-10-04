from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .models import TaskStatus
from .schemas import (
    TaskChecklistItemCreate,
    TaskChecklistItemOut,
    TaskChecklistItemUpdate,
    TaskCreate,
    TaskOut,
    TaskTypeCreate,
    TaskTypeOut,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])
task_types_router = APIRouter(prefix="/task-types", tags=["tasks"])
task_checklist_router = APIRouter(prefix="/task-checklist-items", tags=["tasks"])


@task_types_router.get("", response_model=list[TaskTypeOut])
def list_task_types(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_task_types(db, current_user.id)


@task_types_router.post("", response_model=TaskTypeOut, status_code=status.HTTP_201_CREATED)
def create_task_type(
    payload: TaskTypeCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.create_task_type(db, current_user.id, payload.name, payload.icon, payload.color)


@task_types_router.delete("/{task_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_type(
    task_type_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    service.delete_task_type(db, current_user.id, task_type_id)


@router.get("", response_model=list[TaskOut])
def list_tasks(
    status_filter: TaskStatus | None = None,
    category_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_tasks(db, current_user.id, status_filter, category_id)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"checklist"})
    checklist_titles = [item.title for item in payload.checklist]
    return service.create_task(db, current_user.id, data, checklist_titles)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_task(db, current_user.id, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_task(db, current_user.id, task_id, payload.model_dump(exclude_unset=True))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.delete_task(db, current_user.id, task_id)


@router.post("/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_task_complete(db, current_user.id, task_id, True)


@router.post("/{task_id}/uncomplete", response_model=TaskOut)
def uncomplete_task(task_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_task_complete(db, current_user.id, task_id, False)


@router.post("/{task_id}/checklist", response_model=TaskChecklistItemOut, status_code=status.HTTP_201_CREATED)
def add_checklist_item(
    task_id: UUID,
    payload: TaskChecklistItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.add_task_checklist_item(db, current_user.id, task_id, payload.title)


@task_checklist_router.patch("/{item_id}", response_model=TaskChecklistItemOut)
def update_checklist_item(
    item_id: UUID,
    payload: TaskChecklistItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_task_checklist_item(db, current_user.id, item_id, payload.model_dump(exclude_unset=True))


@task_checklist_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_item(
    item_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    service.delete_task_checklist_item(db, current_user.id, item_id)
