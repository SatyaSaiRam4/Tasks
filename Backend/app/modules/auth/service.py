import hashlib
import logging
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

from .models import EmailVerificationCode, PasswordResetCode, RefreshSession, User, UserRole

logger = logging.getLogger("auth")

RESET_CODE_TTL_MINUTES = 15
RESET_CODE_MAX_ATTEMPTS = 5
VERIFY_CODE_TTL_MINUTES = 10
VERIFY_CODE_MAX_ATTEMPTS = 5
VERIFY_RESEND_SECONDS = 60


class EmailNotVerified(HTTPException):
    """Raised when a correct password meets an unverified email; the app then
    asks for the code (error code "EMAILNOTVERIFIED" in the response)."""

    def __init__(self, email: str):
        super().__init__(status.HTTP_403_FORBIDDEN, f"Enter the 6-digit code we sent to {email}.")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def register_user(db: Session, email: str, password: str, display_name: str, timezone_name: str | None) -> User:
    from app.modules.users.service import ensure_settings, generate_public_id

    existing = get_user_by_email(db, email)
    if existing and existing.email_verified_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    if existing:
        # Never verified, so nobody has proved they own it yet: let this sign-up
        # take it over (fixes a typo'd name or a forgotten password before
        # the first code is used).
        existing.password_hash = security.hash_password(password)
        existing.display_name = display_name.strip()
        existing.timezone = timezone_name or existing.timezone
        db.commit()
        return existing
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
    if not user.email_verified_at:
        # The password is right but the email isn't proven yet: send a code
        # (unless one just went out) and ask for it.
        send_verification_code(db, user, respect_cooldown=True)
        raise EmailNotVerified(user.email)
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
    # The code reached their inbox, so the email is theirs.
    if not user.email_verified_at:
        user.email_verified_at = utc_now()
    db.commit()
    # A password reset signs out every existing session.
    revoke_all_sessions(db, user.id)


# ---- Google sign-in ------------------------------------------------------------------

def google_sign_in(db: Session, id_token: str, timezone_name: str | None = None) -> User:
    """Signs in with a Google ID token, verified on this server (see
    app.integrations.google). Finds the user by their linked Google account
    first, then by email, under these rules:

      - No account with that email: a new, verified account is created.
      - A verified account (email already proven by its owner): it is linked
        to this Google account; both sides have proven the same email.
      - An unverified account: nobody ever proved they own that address, so
        whoever registered it gets no foothold. Google proves this user does:
        the account is taken over cleanly (old password, sessions and codes
        are wiped) and linked.
      - An admin account is never linked automatically; admins keep signing
        in with their password, so Google can't open admin access.
      - An account already linked to a different Google account is refused.
    """
    from app.integrations.google import GoogleTokenInvalid, GoogleUnavailable, verify_id_token
    from app.modules.users.service import ensure_settings, generate_public_id

    try:
        info = verify_id_token(id_token)
    except GoogleUnavailable:
        logger.warning("Google sign-in: Google's signing keys are unreachable")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Can't reach Google right now. Please try again.")
    except GoogleTokenInvalid as exc:
        logger.info("Google sign-in refused: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Google sign-in failed. {exc}")

    user = db.scalar(select(User).where(User.google_sub == info["sub"]))
    if user is None:
        user = get_user_by_email(db, info["email"])
        if user is not None:
            if user.role == UserRole.ADMIN:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin accounts sign in with email and password.")
            if user.google_sub and user.google_sub != info["sub"]:
                raise HTTPException(status.HTTP_409_CONFLICT, "This email is linked to a different Google account.")
            if not user.email_verified_at:
                # Unclaimed sign-up: drop everything its creator set.
                user.password_hash = security.hash_password(secrets.token_urlsafe(32))
                db.query(EmailVerificationCode).filter(
                    EmailVerificationCode.user_id == user.id, EmailVerificationCode.used_at.is_(None)
                ).update({"used_at": utc_now()})
                db.query(RefreshSession).filter(
                    RefreshSession.user_id == user.id, RefreshSession.revoked_at.is_(None)
                ).update({"revoked_at": utc_now()})
                user.email_verified_at = utc_now()
                logger.info("Google sign-in: unverified account %s claimed by its Google owner", user.id)
            else:
                logger.info("Google sign-in: linked existing account %s", user.id)
            user.google_sub = info["sub"]

    if user is not None:
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled.")
        if timezone_name and timezone_name != user.timezone:
            from app.modules.streaks.engine import finalize_user

            finalize_user(db, user)
            user.timezone = timezone_name
        db.commit()
        db.refresh(user)
        return user

    name = info["name"][:120] or "Memo user"
    user = User(
        email=info["email"],
        # No usable password: they sign in with Google (or set one via "Forgot password").
        password_hash=security.hash_password(secrets.token_urlsafe(32)),
        display_name=name,
        role=UserRole.USER,
        public_id=generate_public_id(db, name),
        timezone=timezone_name or DEFAULT_TIMEZONE,
        email_verified_at=utc_now(),
        google_sub=info["sub"],
    )
    db.add(user)
    db.flush()
    ensure_settings(db, user.id)
    db.commit()
    db.refresh(user)
    logger.info("Google sign-in: created account %s", user.id)
    return user


# ---- Email verification ------------------------------------------------------------

def send_verification_code(db: Session, user: User, respect_cooldown: bool = False) -> bool:
    """Emails a fresh 6-digit code (earlier ones stop working). With
    respect_cooldown, does nothing if a code went out in the last minute.
    Returns whether a code was sent."""
    if respect_cooldown:
        last = db.scalar(
            select(EmailVerificationCode)
            .where(EmailVerificationCode.user_id == user.id)
            .order_by(EmailVerificationCode.created_at.desc())
        )
        if last and (utc_now() - last.created_at).total_seconds() < VERIFY_RESEND_SECONDS:
            return False
    db.query(EmailVerificationCode).filter(
        EmailVerificationCode.user_id == user.id, EmailVerificationCode.used_at.is_(None)
    ).update({"used_at": utc_now()})
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        EmailVerificationCode(
            user_id=user.id,
            code_hash=_hash_token(code),
            expires_at=utc_now() + timedelta(minutes=VERIFY_CODE_TTL_MINUTES),
            created_at=utc_now(),
        )
    )
    db.commit()
    send_email(
        user.email,
        "Your Memo verification code",
        f"Hi {user.display_name},\n\nYour Memo verification code is {code}. "
        f"It expires in {VERIFY_CODE_TTL_MINUTES} minutes.\n\n"
        "If you didn't create a Memo account, you can ignore this email.",
    )
    return True


def resend_verification_code(db: Session, email: str) -> None:
    """Sends a new code to an unverified account. Says nothing either way, so
    it can't reveal which emails have accounts."""
    user = get_user_by_email(db, email)
    if user and user.is_active and not user.email_verified_at:
        send_verification_code(db, user, respect_cooldown=True)


def verify_email(db: Session, email: str, code: str) -> User:
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "That code is invalid or has expired.")
    user = get_user_by_email(db, email)
    if not user or not user.is_active:
        raise invalid
    if user.email_verified_at:
        return user  # already done (e.g. a second tap): just sign them in
    record = db.scalar(
        select(EmailVerificationCode)
        .where(EmailVerificationCode.user_id == user.id, EmailVerificationCode.used_at.is_(None))
        .order_by(EmailVerificationCode.created_at.desc())
    )
    if not record or record.expires_at < utc_now() or record.attempts >= VERIFY_CODE_MAX_ATTEMPTS:
        raise invalid
    if not secrets.compare_digest(record.code_hash, _hash_token(code)):
        record.attempts += 1
        db.commit()
        raise invalid
    record.used_at = utc_now()
    user.email_verified_at = utc_now()
    db.commit()
    db.refresh(user)
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
    from app.modules.users.service import ensure_settings, generate_public_id

    if get_user_by_email(db, ADMIN_EMAIL):
        return
    admin = User(
        email=ADMIN_EMAIL.lower(),
        password_hash=security.hash_password(ADMIN_PASSWORD),
        display_name=ADMIN_NAME,
        role=UserRole.ADMIN,
        public_id=generate_public_id(db, ADMIN_NAME),
        email_verified_at=utc_now(),
    )
    db.add(admin)
    db.flush()
    ensure_settings(db, admin.id)
    db.commit()
