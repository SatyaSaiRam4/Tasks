from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.tasks.schemas import TaskOut

from . import service
from .schemas import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteOut])
def list_notes(
    category_id: UUID | None = None,
    task_id: UUID | None = None,
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_notes(db, current_user.id, category_id, task_id, include_archived)


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.create_note(db, current_user.id, payload.model_dump())


@router.get("/{note_id}", response_model=NoteOut)
def get_note(note_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_note(db, current_user.id, note_id)


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_note(db, current_user.id, note_id, payload.model_dump(exclude_unset=True))


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.delete_note(db, current_user.id, note_id)


@router.post("/{note_id}/pin", response_model=NoteOut)
def pin_note(note_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_pinned(db, current_user.id, note_id, True)


@router.post("/{note_id}/unpin", response_model=NoteOut)
def unpin_note(note_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_pinned(db, current_user.id, note_id, False)


@router.post("/{note_id}/archive", response_model=NoteOut)
def archive_note(note_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_archived(db, current_user.id, note_id, True)


@router.post("/{note_id}/restore", response_model=NoteOut)
def restore_note(note_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_archived(db, current_user.id, note_id, False)


@router.post("/{note_id}/convert-to-task", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def convert_to_task(note_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.convert_to_task(db, current_user.id, note_id)
