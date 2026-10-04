from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.auth.models import User, UserRole
from app.modules.categories.models import Category
from app.modules.notes.models import Note
from app.modules.tasks.models import Task, TaskStatus


def list_users(db: Session, search: str | None) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if search:
        like = f"%{search}%"
        stmt = stmt.where((User.email.ilike(like)) | (User.display_name.ilike(like)))
    return list(db.scalars(stmt))


def _get_user(db: Session, user_id: UUID) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    return user


def set_user_active(db: Session, user_id: UUID, active: bool) -> User:
    user = _get_user(db, user_id)
    user.is_active = active
    db.commit()
    db.refresh(user)
    return user


def set_user_role(db: Session, user_id: UUID, role: UserRole) -> User:
    user = _get_user(db, user_id)
    user.role = role
    db.commit()
    db.refresh(user)
    return user


def get_dashboard_stats(db: Session) -> dict:
    return {
        "total_users": db.scalar(select(func.count(User.id))) or 0,
        "active_users": db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0,
        "admin_users": db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN)) or 0,
        "total_categories": db.scalar(select(func.count(Category.id))) or 0,
        "total_tasks": db.scalar(select(func.count(Task.id))) or 0,
        "completed_tasks": db.scalar(select(func.count(Task.id)).where(Task.status == TaskStatus.COMPLETED)) or 0,
        "total_notes": db.scalar(select(func.count(Note.id))) or 0,
    }
