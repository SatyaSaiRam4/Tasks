from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service

router = APIRouter(prefix="/achievements", tags=["achievements"])


class AchievementOut(BaseModel):
    code: str
    title: str
    description: str
    icon: str
    earned: bool
    earned_at: datetime | None


@router.get("", response_model=list[AchievementOut])
def list_achievements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.modules.streaks.engine import finalize_user

    finalize_user(db, current_user)  # settle ended days so earned badges are current
    return service.list_for_user(db, current_user.id)
