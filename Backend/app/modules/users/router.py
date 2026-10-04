from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import MeOut, MyProfileOut, ProfileUpdate, PublicProfileOut, SettingsOut, SettingsUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=MeOut)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.me(db, current_user)


@router.patch("/me", response_model=MeOut)
def update_me(payload: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.update_profile(db, current_user, payload.model_dump(exclude_unset=True))


@router.get("/me/profile", response_model=MyProfileOut)
def my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.my_profile(db, current_user)


@router.get("/me/settings", response_model=SettingsOut)
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.me(db, current_user).settings


@router.patch("/me/settings", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.update_settings(db, current_user, payload.model_dump(exclude_unset=True))


@router.post("/me/onboarding/complete", response_model=MeOut)
def complete_onboarding(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.complete_onboarding(db, current_user)


@router.post("/me/onboarding/reset", response_model=MeOut)
def reset_onboarding(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.reset_onboarding(db, current_user)


@router.get("/search", response_model=PublicProfileOut)
def search(
    public_id: str = Query(min_length=3, max_length=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rate_limit.hit(f"user-search:{current_user.id}", limit=20, window_seconds=60)
    return service.public_profile(db, public_id)
