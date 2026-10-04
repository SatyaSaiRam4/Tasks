from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import (
    ActionCreate,
    ActionOut,
    ActionUpdate,
    AgendaOut,
    CompleteRequest,
    CompletionResult,
    UncompleteRequest,
)

router = APIRouter(tags=["actions"])


@router.get("/actions/agenda", response_model=AgendaOut)
def agenda(day: date | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Everything due on `day` (default: today in the user's timezone), grouped by Track."""
    return service.agenda(db, current_user, day)


@router.get("/tracks/{track_id}/actions", response_model=list[ActionOut])
def list_track_actions(track_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_track_actions(db, current_user, track_id)


@router.post("/tracks/{track_id}/actions", response_model=ActionOut, status_code=status.HTTP_201_CREATED)
def create_action(
    track_id: UUID, payload: ActionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.create_action(db, current_user, track_id, payload.model_dump())


@router.get("/actions/{action_id}", response_model=ActionOut)
def get_action(action_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_owned_action(db, current_user.id, action_id)


@router.patch("/actions/{action_id}", response_model=ActionOut)
def update_action(
    action_id: UUID, payload: ActionUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.update_action(db, current_user, action_id, payload.model_dump(exclude_unset=True))


@router.delete("/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action(action_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.delete_action(db, current_user, action_id)


@router.post("/actions/{action_id}/complete", response_model=CompletionResult)
def complete_action(
    action_id: UUID, payload: CompleteRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.complete_action(db, current_user, action_id, payload.confirmed, payload.method, payload.date)


@router.post("/actions/{action_id}/uncomplete", response_model=CompletionResult)
def uncomplete_action(
    action_id: UUID,
    payload: UncompleteRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.uncomplete_action(db, current_user, action_id, payload.date if payload else None)
