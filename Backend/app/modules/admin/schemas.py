from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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


class AdminRedemptionOut(BaseModel):
    id: UUID
    user_email: str | None
    amount: int
    points: int
    phone: str
    status: str
    payout_reference: str | None
    note: str | None
    decided_by_email: str | None
    decided_at: datetime | None
    created_at: datetime


class PayoutPaidIn(BaseModel):
    # The UPI / bank transaction reference of the payout actually made.
    reference: str = Field(min_length=3, max_length=120)


class PayoutRejectIn(BaseModel):
    note: str = Field(min_length=3, max_length=255)


class AdminPaymentOut(BaseModel):
    id: UUID
    user_email: str | None
    purpose: str
    amount_paise: int
    currency: str
    mode: str
    status: str
    provider_order_id: str
    provider_payment_id: str | None
    failure_reason: str | None
    created_at: datetime
    paid_at: datetime | None


class AdminPlanOut(BaseModel):
    user_email: str | None
    free_used: int
    messages_total: int
    messages_used: int
    starts_at: datetime
    expires_at: datetime
    ended_at: datetime | None
    active: bool
    provider_order_id: str
