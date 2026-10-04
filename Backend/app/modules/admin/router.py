from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db

from . import service
from .schemas import AdminUserOut, DashboardStats, UserRoleUpdate

# require_admin runs for every route on this router, so ownership/role
# checks never need to be repeated in the handlers below.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db)):
    return service.get_dashboard_stats(db)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(search: str | None = None, db: Session = Depends(get_db)):
    return service.list_users(db, search)


@router.post("/users/{user_id}/disable", response_model=AdminUserOut)
def disable_user(user_id: UUID, db: Session = Depends(get_db)):
    return service.set_user_active(db, user_id, False)


@router.post("/users/{user_id}/enable", response_model=AdminUserOut)
def enable_user(user_id: UUID, db: Session = Depends(get_db)):
    return service.set_user_active(db, user_id, True)


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def update_role(user_id: UUID, payload: UserRoleUpdate, db: Session = Depends(get_db)):
    return service.set_user_role(db, user_id, payload.role)
