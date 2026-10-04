from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.auth.models import UserRole


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    public_id: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: UserRole


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    admin_users: int
    total_tracks: int
    total_actions: int
    completions_today: int
    total_completions: int
    vault_entries: int  # a count only; admins never see Vault content
    avg_current_streak: float
    max_best_streak: int
    reminders_active: int
    whatsapp_sent: int
    whatsapp_failed: int
    whatsapp_pending: int
