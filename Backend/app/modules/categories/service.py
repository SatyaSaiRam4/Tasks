from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .models import Category, ChecklistItem


def _get_owned_category(db: Session, category_id: UUID, user_id: UUID) -> Category:
    category = db.scalar(
        select(Category)
        .options(selectinload(Category.checklist_items))
        .where(Category.id == category_id, Category.user_id == user_id)
    )
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found.")
    return category


def list_categories(db: Session, user_id: UUID, include_archived: bool = False) -> list[Category]:
    stmt = (
        select(Category)
        .options(selectinload(Category.checklist_items))
        .where(Category.user_id == user_id)
        .order_by(Category.sort_order, Category.created_at)
    )
    if not include_archived:
        stmt = stmt.where(Category.is_archived.is_(False))
    return list(db.scalars(stmt).unique())


def create_category(db: Session, user_id: UUID, name: str, icon: str | None, color: str | None) -> Category:
    existing = db.scalar(select(Category).where(Category.user_id == user_id, Category.name == name))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists.")

    max_sort = db.scalar(
        select(Category.sort_order).where(Category.user_id == user_id).order_by(Category.sort_order.desc())
    )
    category = Category(user_id=user_id, name=name, icon=icon, color=color, sort_order=(max_sort or 0) + 1)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def get_category(db: Session, user_id: UUID, category_id: UUID) -> Category:
    return _get_owned_category(db, category_id, user_id)


def update_category(db: Session, user_id: UUID, category_id: UUID, **fields) -> Category:
    category = _get_owned_category(db, category_id, user_id)
    for key, value in fields.items():
        if value is not None:
            setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, user_id: UUID, category_id: UUID) -> None:
    category = _get_owned_category(db, category_id, user_id)
    db.delete(category)
    db.commit()


def set_archived(db: Session, user_id: UUID, category_id: UUID, archived: bool) -> Category:
    category = _get_owned_category(db, category_id, user_id)
    category.is_archived = archived
    db.commit()
    db.refresh(category)
    return category


def add_checklist_item(db: Session, user_id: UUID, category_id: UUID, title: str) -> ChecklistItem:
    category = _get_owned_category(db, category_id, user_id)
    max_sort = max((item.sort_order for item in category.checklist_items), default=-1)
    item = ChecklistItem(category_id=category.id, title=title, sort_order=max_sort + 1)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _get_owned_checklist_item(db: Session, user_id: UUID, item_id: UUID) -> ChecklistItem:
    item = db.scalar(
        select(ChecklistItem).join(Category).where(ChecklistItem.id == item_id, Category.user_id == user_id)
    )
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checklist item not found.")
    return item


def update_checklist_item(db: Session, user_id: UUID, item_id: UUID, **fields) -> ChecklistItem:
    item = _get_owned_checklist_item(db, user_id, item_id)
    for key, value in fields.items():
        if value is not None:
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_checklist_item(db: Session, user_id: UUID, item_id: UUID) -> None:
    item = _get_owned_checklist_item(db, user_id, item_id)
    db.delete(item)
    db.commit()


def reorder_checklist(db: Session, user_id: UUID, category_id: UUID, item_ids: list[UUID]) -> Category:
    category = _get_owned_category(db, category_id, user_id)
    items_by_id = {item.id: item for item in category.checklist_items}
    for index, item_id in enumerate(item_ids):
        item = items_by_id.get(item_id)
        if item:
            item.sort_order = index
    db.commit()
    db.refresh(category)
    return category
