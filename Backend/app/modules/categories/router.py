from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ChecklistItemCreate,
    ChecklistItemOut,
    ChecklistItemUpdate,
    ChecklistReorderRequest,
)

router = APIRouter(prefix="/categories", tags=["categories"])
checklist_router = APIRouter(prefix="/checklist-items", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_categories(db, current_user.id, include_archived)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.create_category(db, current_user.id, payload.name, payload.icon, payload.color)


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(
    category_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.get_category(db, current_user.id, category_id)


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_category(db, current_user.id, category_id, **payload.model_dump(exclude_unset=True))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    service.delete_category(db, current_user.id, category_id)


@router.post("/{category_id}/archive", response_model=CategoryOut)
def archive_category(
    category_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.set_archived(db, current_user.id, category_id, True)


@router.post("/{category_id}/restore", response_model=CategoryOut)
def restore_category(
    category_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.set_archived(db, current_user.id, category_id, False)


@router.post("/{category_id}/checklist", response_model=ChecklistItemOut, status_code=status.HTTP_201_CREATED)
def add_checklist_item(
    category_id: UUID,
    payload: ChecklistItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.add_checklist_item(db, current_user.id, category_id, payload.title)


@router.post("/{category_id}/checklist/reorder", response_model=CategoryOut)
def reorder_checklist(
    category_id: UUID,
    payload: ChecklistReorderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.reorder_checklist(db, current_user.id, category_id, payload.item_ids)


@checklist_router.patch("/{item_id}", response_model=ChecklistItemOut)
def update_checklist_item(
    item_id: UUID,
    payload: ChecklistItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_checklist_item(db, current_user.id, item_id, **payload.model_dump(exclude_unset=True))


@checklist_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_item(
    item_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    service.delete_checklist_item(db, current_user.id, item_id)
