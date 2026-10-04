from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.timeutil import local_today
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import TrackCreate, TrackDayOut, TrackOut, TrackUpdate

router = APIRouter(prefix="/tracks", tags=["tracks"])


@router.get("", response_model=list[TrackOut])
def list_tracks(
    include_archived: bool = False, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.list_tracks(db, current_user, include_archived)


@router.post("", response_model=TrackOut, status_code=status.HTTP_201_CREATED)
def create_track(payload: TrackCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.create_track(db, current_user, payload.model_dump())


@router.get("/{track_id}", response_model=TrackOut)
def get_track(track_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_track(db, current_user, track_id)


@router.patch("/{track_id}", response_model=TrackOut)
def update_track(
    track_id: UUID, payload: TrackUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return service.update_track(db, current_user, track_id, payload.model_dump(exclude_unset=True))


@router.post("/{track_id}/archive", response_model=TrackOut)
def archive_track(track_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_archived(db, current_user, track_id, True)


@router.post("/{track_id}/restore", response_model=TrackOut)
def restore_track(track_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.set_archived(db, current_user, track_id, False)


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_track(track_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.delete_track(db, current_user, track_id)


@router.get("/{track_id}/days", response_model=list[TrackDayOut])
def track_days(
    track_id: UUID,
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = local_today(current_user.timezone)
    start = from_ or today - timedelta(days=14)
    end = to or today + timedelta(days=7)
    return service.track_days(db, current_user, track_id, start, end)
