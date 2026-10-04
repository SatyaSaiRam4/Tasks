import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, REFRESH_TOKEN_EXPIRE_DAYS
from app.core.timeutil import DEFAULT_TIMEZONE, utc_now
from app.integrations.email import send_email

from .models import PasswordResetCode, RefreshSession, User, UserRole

RESET_CODE_TTL_MINUTES = 15
RESET_CODE_MAX_ATTEMPTS = 5


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def register_user(db: Session, email: str, password: str, display_name: str, timezone_name: str | None) -> User:
    from app.modules.users.service import ensure_settings, generate_public_id

    if get_user_by_email(db, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(
        email=email.lower(),
        password_hash=security.hash_password(password),
        display_name=display_name.strip(),
        role=UserRole.USER,
        public_id=generate_public_id(db, display_name),
        timezone=timezone_name or DEFAULT_TIMEZONE,
    )
    db.add(user)
    db.flush()
    ensure_settings(db, user.id)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str, timezone_name: str | None = None) -> User:
    user = get_user_by_email(db, email)
    if not user or not security.verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled.")
    if timezone_name and timezone_name != user.timezone:
        from app.modules.streaks.engine import finalize_user

        # Judge any finished days under the old zone before switching.
        finalize_user(db, user)
        user.timezone = timezone_name
        db.commit()
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not security.verify_password(current_password, user.password_hash):
        # 403, not 401: the session is valid, so the app must not refresh and retry.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your current password is incorrect.")
    user.password_hash = security.hash_password(new_password)
    db.commit()


def request_password_reset(db: Session, email: str) -> None:
    """Always succeeds from the caller's point of view, so it can't reveal
    which emails have accounts."""
    user = get_user_by_email(db, email)
    if not user or not user.is_active:
        return
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None)
    ).update({"used_at": utc_now()})
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_token(code),
            expires_at=utc_now() + timedelta(minutes=RESET_CODE_TTL_MINUTES),
        )
    )
    db.commit()
    send_email(
        user.email,
        "Your Memo reset code",
        f"Hi {user.display_name},\n\nYour password reset code is {code}. "
        f"It expires in {RESET_CODE_TTL_MINUTES} minutes.\n\n"
        "If you didn't ask for this, you can ignore this email.",
    )


def reset_password(db: Session, email: str, code: str, new_password: str) -> None:
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "That code is invalid or has expired.")
    user = get_user_by_email(db, email)
    if not user:
        raise invalid
    record = db.scalar(
        select(PasswordResetCode)
        .where(PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None))
        .order_by(PasswordResetCode.created_at.desc())
    )
    if not record or record.expires_at < utc_now() or record.attempts >= RESET_CODE_MAX_ATTEMPTS:
        raise invalid
    if not secrets.compare_digest(record.code_hash, _hash_token(code)):
        record.attempts += 1
        db.commit()
        raise invalid
    record.used_at = utc_now()
    user.password_hash = security.hash_password(new_password)
    db.commit()
    # A password reset signs out every existing session.
    revoke_all_sessions(db, user.id)


def issue_tokens(db: Session, user: User, device_name: str | None = None) -> tuple[str, str]:
    access_token = security.create_access_token(str(user.id), user.role.value)
    refresh_token = secrets.token_urlsafe(48)
    session = RefreshSession(
        user_id=user.id,
        token_hash=_hash_token(refresh_token),
        device_name=device_name,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()
    return access_token, refresh_token


def rotate_refresh_token(db: Session, refresh_token: str) -> tuple[str, str, User]:
    token_hash = _hash_token(refresh_token)
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == token_hash))
    if (
        not session
        or session.revoked_at is not None
        or session.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired or invalid. Please log in again.")

    session.revoked_at = datetime.now(timezone.utc)
    user = db.get(User, session.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is unavailable.")
    db.commit()

    access_token, new_refresh_token = issue_tokens(db, user, session.device_name)
    return access_token, new_refresh_token, user


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    token_hash = _hash_token(refresh_token)
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == token_hash))
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()


def revoke_all_sessions(db: Session, user_id: UUID) -> None:
    db.query(RefreshSession).filter(
        RefreshSession.user_id == user_id, RefreshSession.revoked_at.is_(None)
    ).update({"revoked_at": datetime.now(timezone.utc)})
    db.commit()


def seed_admin(db: Session) -> None:
    from app.modules.users.service import ensure_settings, generate_public_id

    if get_user_by_email(db, ADMIN_EMAIL):
        return
    admin = User(
        email=ADMIN_EMAIL.lower(),
        password_hash=security.hash_password(ADMIN_PASSWORD),
        display_name=ADMIN_NAME,
        role=UserRole.ADMIN,
        public_id=generate_public_id(db, ADMIN_NAME),
    )
    db.add(admin)
    db.flush()
    ensure_settings(db, admin.id)
    db.commit()
