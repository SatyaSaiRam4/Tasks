from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import ReminderCreate, ReminderOut, ReminderUpdate

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    include_cancelled: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_reminders(db, current_user.id, include_cancelled)


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: ReminderCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.create_reminder(db, current_user.id, payload.model_dump())


@router.get("/{reminder_id}", response_model=ReminderOut)
def get_reminder(reminder_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_reminder(db, current_user.id, reminder_id)


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: UUID,
    payload: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_reminder(db, current_user.id, reminder_id, payload.model_dump(exclude_unset=True))


@router.post("/{reminder_id}/cancel", response_model=ReminderOut)
def cancel_reminder(
    reminder_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.cancel_reminder(db, current_user.id, reminder_id)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    service.delete_reminder(db, current_user.id, reminder_id)
