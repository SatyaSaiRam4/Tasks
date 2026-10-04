from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.auth.models import UserRole


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: UserRole


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    admin_users: int
    total_categories: int
    total_tasks: int
    completed_tasks: int
    total_notes: int
