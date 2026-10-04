from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.timeutil import is_valid_timezone


def _tz(value: str | None) -> str | None:
    if value is not None and not is_valid_timezone(value):
        return None  # ignore garbage rather than block sign-in
    return value


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def check_tz(cls, value: str | None) -> str | None:
        return _tz(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def check_tz(cls, value: str | None) -> str | None:
        return _tz(value)


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str
    role: str
    is_active: bool
    created_at: datetime
    public_id: str
    avatar: str | None
    timezone: str
    onboarding_completed: bool

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role.value,
            is_active=user.is_active,
            created_at=user.created_at,
            public_id=user.public_id,
            avatar=user.avatar,
            timezone=user.timezone,
            onboarding_completed=user.onboarding_completed_at is not None,
        )


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
