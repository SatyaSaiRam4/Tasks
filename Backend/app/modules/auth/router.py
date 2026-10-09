from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.deps import get_current_user
from app.db.session import get_db
from app.integrations.email import EmailNotConfigured, EmailSendFailed

from . import service
from .models import User
from .schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens(db: Session, user: User) -> TokenResponse:
    access_token, refresh_token = service.issue_tokens(db, user)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserOut.from_user(user))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit.hit(f"register:{rate_limit.client_ip(request)}", limit=5, window_seconds=600)
    user = service.register_user(db, payload.email, payload.password, payload.display_name, payload.timezone)
    return _tokens(db, user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit.hit(f"login-ip:{rate_limit.client_ip(request)}", limit=20, window_seconds=300)
    rate_limit.hit(f"login-email:{payload.email.lower()}", limit=8, window_seconds=300)
    user = service.authenticate_user(db, payload.email, payload.password, payload.timezone)
    return _tokens(db, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    access_token, refresh_token, user = service.rotate_refresh_token(db, payload.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserOut.from_user(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    service.revoke_refresh_token(db, payload.refresh_token)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.revoke_all_sessions(db, current_user.id)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit.hit(f"forgot-ip:{rate_limit.client_ip(request)}", limit=10, window_seconds=900)
    rate_limit.hit(f"forgot-email:{payload.email.lower()}", limit=3, window_seconds=900)
    try:
        service.request_password_reset(db, payload.email)
    except EmailNotConfigured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Password reset email isn't available right now.")
    except EmailSendFailed:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "We couldn't send the email. Please try again in a minute.")
    return {"message": "If that email has an account, a reset code is on its way."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit.hit(f"reset-ip:{rate_limit.client_ip(request)}", limit=10, window_seconds=900)
    service.reset_password(db, payload.email, payload.code, payload.new_password)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    rate_limit.hit(f"change-password:{current_user.id}", limit=5, window_seconds=300)
    service.change_password(db, current_user, payload.current_password, payload.new_password)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.from_user(current_user)
