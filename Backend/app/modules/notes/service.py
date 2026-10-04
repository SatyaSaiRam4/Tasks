from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.tasks.models import Task

from .models import Note


def _get_owned_note(db: Session, user_id: UUID, note_id: UUID) -> Note:
    note = db.scalar(select(Note).where(Note.id == note_id, Note.user_id == user_id))
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
    return note


def list_notes(
    db: Session,
    user_id: UUID,
    category_id: UUID | None,
    task_id: UUID | None,
    include_archived: bool,
) -> list[Note]:
    stmt = select(Note).where(Note.user_id == user_id)
    if category_id is not None:
        stmt = stmt.where(Note.category_id == category_id)
    if task_id is not None:
        stmt = stmt.where(Note.task_id == task_id)
    if not include_archived:
        stmt = stmt.where(Note.is_archived.is_(False))
    stmt = stmt.order_by(Note.pinned.desc(), Note.updated_at.desc())
    return list(db.scalars(stmt))


def create_note(db: Session, user_id: UUID, data: dict) -> Note:
    note = Note(user_id=user_id, **data)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def get_note(db: Session, user_id: UUID, note_id: UUID) -> Note:
    return _get_owned_note(db, user_id, note_id)


def update_note(db: Session, user_id: UUID, note_id: UUID, fields: dict) -> Note:
    note = _get_owned_note(db, user_id, note_id)
    for key, value in fields.items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, user_id: UUID, note_id: UUID) -> None:
    note = _get_owned_note(db, user_id, note_id)
    db.delete(note)
    db.commit()


def set_pinned(db: Session, user_id: UUID, note_id: UUID, pinned: bool) -> Note:
    note = _get_owned_note(db, user_id, note_id)
    note.pinned = pinned
    db.commit()
    db.refresh(note)
    return note


def set_archived(db: Session, user_id: UUID, note_id: UUID, archived: bool) -> Note:
    note = _get_owned_note(db, user_id, note_id)
    note.is_archived = archived
    db.commit()
    db.refresh(note)
    return note


def convert_to_task(db: Session, user_id: UUID, note_id: UUID) -> Task:
    note = _get_owned_note(db, user_id, note_id)
    task = Task(
        user_id=user_id,
        category_id=note.category_id,
        title=note.title or note.content[:100],
        description=note.content,
    )
    db.add(task)
    db.flush()
    note.task_id = task.id
    db.commit()
    db.refresh(task)
    return task
