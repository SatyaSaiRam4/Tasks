import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, REFRESH_TOKEN_EXPIRE_DAYS

from .models import RefreshSession, User, UserRole


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def register_user(db: Session, email: str, password: str, display_name: str) -> User:
    if get_user_by_email(db, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(
        email=email.lower(),
        password_hash=security.hash_password(password),
        display_name=display_name,
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if not user or not security.verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled.")
    return user


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
    if get_user_by_email(db, ADMIN_EMAIL):
        return
    admin = User(
        email=ADMIN_EMAIL.lower(),
        password_hash=security.hash_password(ADMIN_PASSWORD),
        display_name=ADMIN_NAME,
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.commit()
