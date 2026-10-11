"""Vault business logic. Nothing in this module may log entry content."""

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import config, security
from app.core.timeutil import utc_now
from app.integrations.email import EmailNotConfigured, EmailSendFailed, send_email
from app.modules.auth.models import User
from app.modules.users.models import UserSettings

from .crypto import decrypt_bytes, decrypt_payload, encrypt_bytes, encrypt_payload
from .models import VaultCredential, VaultEntry, VaultImage
from .schemas import VaultEntryOut, VaultEntrySummary, VaultFolderOut, VaultImageOut, VaultSessionOut, VaultStatusOut

VIEWS = ("all", "favorites", "pinned", "archived", "trash")


def _autolock_minutes(db: Session, user_id: UUID) -> int:
    settings = db.get(UserSettings, user_id)
    return settings.vault_autolock_minutes if settings else 5


def _session_minutes(db: Session, user_id: UUID) -> int:
    minutes = _autolock_minutes(db, user_id)
    if minutes <= 0:
        return config.VAULT_SESSION_MAX_MINUTES
    return min(minutes, config.VAULT_SESSION_MAX_MINUTES)


def vault_status(db: Session, user: User) -> VaultStatusOut:
    cred = db.get(VaultCredential, user.id)
    locked_until = cred.locked_until if cred and cred.locked_until and cred.locked_until > utc_now() else None
    return VaultStatusOut(has_pin=cred is not None, locked_until=locked_until, autolock_minutes=_autolock_minutes(db, user.id))


def _issue(db: Session, user: User) -> VaultSessionOut:
    token, expires = security.create_vault_token(str(user.id), _session_minutes(db, user.id))
    return VaultSessionOut(vault_token=token, expires_at=expires)


def setup_pin(db: Session, user: User, pin: str) -> VaultSessionOut:
    if db.get(VaultCredential, user.id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your Vault already has a PIN. Change it from Settings.")
    db.add(VaultCredential(user_id=user.id, pin_hash=security.hash_password(pin), failed_attempts=0))
    db.commit()
    return _issue(db, user)


def _verify_pin(db: Session, cred: VaultCredential, pin: str) -> None:
    now = utc_now()
    if cred.locked_until and cred.locked_until > now:
        seconds = int((cred.locked_until - now).total_seconds()) + 1
        raise HTTPException(
            status.HTTP_423_LOCKED,
            f"Too many wrong PINs. Try again in {max(seconds // 60, 1)} minute(s).",
        )
    if security.verify_password(pin, cred.pin_hash):
        cred.failed_attempts = 0
        cred.locked_until = None
        db.commit()
        return
    cred.failed_attempts += 1
    remaining = config.VAULT_MAX_FAILED_ATTEMPTS - cred.failed_attempts
    if remaining <= 0:
        cred.failed_attempts = 0
        cred.locked_until = now + timedelta(minutes=config.VAULT_LOCKOUT_MINUTES)
        db.commit()
        raise HTTPException(
            status.HTTP_423_LOCKED,
            f"Too many wrong PINs. The Vault is locked for {config.VAULT_LOCKOUT_MINUTES} minutes.",
        )
    db.commit()
    # 403, not 401: the user *is* logged in. A 401 makes the app refresh its
    # session and retry, which would spend two attempts on one wrong PIN.
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        f"Incorrect PIN. {remaining} attempt{'s' if remaining != 1 else ''} left.",
    )


def unlock(db: Session, user: User, pin: str) -> VaultSessionOut:
    cred = db.get(VaultCredential, user.id)
    if cred is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Set up a Vault PIN first.")
    _verify_pin(db, cred, pin)
    return _issue(db, user)


def change_pin(db: Session, user: User, current_pin: str, new_pin: str) -> VaultSessionOut:
    cred = db.get(VaultCredential, user.id)
    if cred is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Set up a Vault PIN first.")
    _verify_pin(db, cred, current_pin)
    cred.pin_hash = security.hash_password(new_pin)
    db.commit()
    return _issue(db, user)


def reset_pin(db: Session, user: User, password: str, new_pin: str) -> VaultSessionOut:
    """Forgot the PIN. Notes are encrypted with the server's key, not the PIN,
    so after the account password is checked a new PIN opens the same notes."""
    if not security.verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Incorrect account password.")
    cred = db.get(VaultCredential, user.id)
    if cred is None:
        cred = VaultCredential(user_id=user.id, pin_hash=security.hash_password(new_pin), failed_attempts=0)
        db.add(cred)
    else:
        cred.pin_hash = security.hash_password(new_pin)
        cred.failed_attempts = 0
        cred.locked_until = None
    db.commit()
    try:
        send_email(
            user.email,
            "Your Memo Vault PIN was reset",
            f"Hi {user.display_name},\n\nYour Vault PIN was just reset with your account password. "
            "If this wasn't you, change your Memo password now.\n\n— Memo",
        )
    except (EmailNotConfigured, EmailSendFailed):
        pass  # The reset itself worked; the notice is a courtesy.
    return _issue(db, user)


# ---- entries -----------------------------------------------------------------


def _owned_entry(db: Session, user_id: UUID, entry_id: UUID) -> VaultEntry:
    entry = db.scalar(select(VaultEntry).where(VaultEntry.id == entry_id, VaultEntry.user_id == user_id))
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vault entry not found.")
    return entry


def _summary(entry: VaultEntry, data: dict) -> dict:
    content = data.get("content") or ""
    return {
        "id": entry.id,
        "title": data.get("title"),
        "preview": " ".join(content.split())[:120],
        "folder": data.get("folder"),
        "tags": data.get("tags") or [],
        "pinned": entry.pinned,
        "is_favorite": entry.is_favorite,
        "is_archived": entry.is_archived,
        "deleted_at": entry.deleted_at,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
        "has_audio": entry.audio_seconds is not None,
        "audio_seconds": entry.audio_seconds,
    }


def _image_counts(db: Session, entry_ids: list[UUID]) -> dict[UUID, int]:
    if not entry_ids:
        return {}
    rows = db.execute(
        select(VaultImage.entry_id, func.count()).where(VaultImage.entry_id.in_(entry_ids)).group_by(VaultImage.entry_id)
    ).all()
    return {entry_id: count for entry_id, count in rows}


def _full(db: Session, entry: VaultEntry) -> VaultEntryOut:
    data = decrypt_payload(entry.ciphertext)
    images = db.scalars(select(VaultImage).where(VaultImage.entry_id == entry.id).order_by(VaultImage.created_at)).all()
    return VaultEntryOut(
        **_summary(entry, data),
        image_count=len(images),
        content=data.get("content") or "",
        images=[VaultImageOut(id=i.id, mime=i.mime, created_at=i.created_at) for i in images],
    )


def list_entries(
    db: Session, user: User, view: str, q: str | None, folder: str | None, tag: str | None
) -> list[VaultEntrySummary]:
    if view not in VIEWS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"view must be one of {', '.join(VIEWS)}.")
    stmt = select(VaultEntry).where(VaultEntry.user_id == user.id)
    if view == "trash":
        stmt = stmt.where(VaultEntry.deleted_at.is_not(None))
    else:
        stmt = stmt.where(VaultEntry.deleted_at.is_(None))
        if view == "archived":
            stmt = stmt.where(VaultEntry.is_archived.is_(True))
        else:
            stmt = stmt.where(VaultEntry.is_archived.is_(False))
        if view == "favorites":
            stmt = stmt.where(VaultEntry.is_favorite.is_(True))
        if view == "pinned":
            stmt = stmt.where(VaultEntry.pinned.is_(True))
    entries = db.scalars(stmt.order_by(VaultEntry.pinned.desc(), VaultEntry.updated_at.desc())).all()

    needle = (q or "").strip().lower()
    counts = _image_counts(db, [e.id for e in entries])
    out: list[VaultEntrySummary] = []
    for entry in entries:
        data = decrypt_payload(entry.ciphertext)
        if folder is not None and (data.get("folder") or "") != folder:
            continue
        tags = data.get("tags") or []
        if tag is not None and tag.lower() not in (t.lower() for t in tags):
            continue
        if needle:
            haystack = " ".join([data.get("title") or "", data.get("content") or "", *tags]).lower()
            if needle not in haystack:
                continue
        out.append(VaultEntrySummary(**_summary(entry, data), image_count=counts.get(entry.id, 0)))
    return out


def folders(db: Session, user: User) -> list[VaultFolderOut]:
    entries = db.scalars(
        select(VaultEntry).where(
            VaultEntry.user_id == user.id, VaultEntry.deleted_at.is_(None), VaultEntry.is_archived.is_(False)
        )
    ).all()
    counts: dict[str, int] = {}
    for entry in entries:
        name = decrypt_payload(entry.ciphertext).get("folder") or "Unsorted"
        counts[name] = counts.get(name, 0) + 1
    return [VaultFolderOut(name=n, count=c) for n, c in sorted(counts.items(), key=lambda kv: kv[0].lower())]


def get_entry(db: Session, user: User, entry_id: UUID) -> VaultEntryOut:
    return _full(db, _owned_entry(db, user.id, entry_id))


def create_entry(db: Session, user: User, data: dict) -> VaultEntryOut:
    payload = {
        "title": (data.get("title") or "").strip() or None,
        "content": data["content"],
        "folder": (data.get("folder") or "").strip() or None,
        "tags": data.get("tags") or [],
    }
    entry = VaultEntry(
        user_id=user.id,
        ciphertext=encrypt_payload(payload),
        pinned=bool(data.get("pinned")),
        is_favorite=bool(data.get("is_favorite")),
        is_archived=False,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _full(db, entry)


def update_entry(db: Session, user: User, entry_id: UUID, fields: dict) -> VaultEntryOut:
    entry = _owned_entry(db, user.id, entry_id)
    payload = decrypt_payload(entry.ciphertext)
    if "title" in fields:
        payload["title"] = (fields["title"] or "").strip() or None
    if fields.get("content") is not None:
        payload["content"] = fields["content"]
    if "folder" in fields:
        payload["folder"] = (fields["folder"] or "").strip() or None
    if fields.get("tags") is not None:
        payload["tags"] = fields["tags"]
    entry.ciphertext = encrypt_payload(payload)
    entry.updated_at = utc_now()
    db.commit()
    db.refresh(entry)
    return _full(db, entry)


def set_flag(db: Session, user: User, entry_id: UUID, flag: str, value: bool) -> VaultEntryOut:
    entry = _owned_entry(db, user.id, entry_id)
    if flag == "trash":
        entry.deleted_at = utc_now() if value else None
    else:
        setattr(entry, flag, value)
    db.commit()
    db.refresh(entry)
    return _full(db, entry)


def delete_permanently(db: Session, user: User, entry_id: UUID) -> None:
    entry = _owned_entry(db, user.id, entry_id)
    if entry.deleted_at is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Move the entry to Trash before deleting it permanently.")
    db.delete(entry)
    db.commit()


def empty_trash(db: Session, user: User) -> int:
    entries = db.scalars(
        select(VaultEntry).where(VaultEntry.user_id == user.id, VaultEntry.deleted_at.is_not(None))
    ).all()
    for entry in entries:
        db.delete(entry)
    db.commit()
    return len(entries)


# ---- voice recordings ----------------------------------------------------------

MAX_AUDIO_BYTES = 4 * 1024 * 1024  # about 4 minutes of voice
AUDIO_TYPES = {"audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/webm", "audio/ogg"}


def set_audio(db: Session, user: User, entry_id: UUID, data: bytes, mime: str, seconds: int) -> VaultEntryOut:
    """Stores (or replaces) a note's voice recording, encrypted."""
    entry = _owned_entry(db, user.id, entry_id)
    if entry.deleted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Restore this note before changing its recording.")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The recording is empty.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Recordings can be up to about 4 minutes.")
    if mime not in AUDIO_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "That doesn't look like a voice recording.")
    entry.audio = encrypt_bytes(data)
    entry.audio_mime = mime
    entry.audio_seconds = max(1, min(int(seconds), 600))
    db.commit()
    db.refresh(entry)
    return _full(db, entry)


def get_audio(db: Session, user: User, entry_id: UUID) -> tuple[bytes, str]:
    entry = _owned_entry(db, user.id, entry_id)
    if entry.audio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This note has no recording.")
    return decrypt_bytes(entry.audio), entry.audio_mime or "audio/mp4"


def delete_audio(db: Session, user: User, entry_id: UUID) -> VaultEntryOut:
    entry = _owned_entry(db, user.id, entry_id)
    entry.audio = None
    entry.audio_mime = None
    entry.audio_seconds = None
    db.commit()
    db.refresh(entry)
    return _full(db, entry)


# ---- photos ------------------------------------------------------------------

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGES_PER_NOTE = 6
IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"}


def add_image(db: Session, user: User, entry_id: UUID, data: bytes, mime: str) -> VaultEntryOut:
    """Attaches a photo to a note, encrypted like everything else in the Vault."""
    entry = _owned_entry(db, user.id, entry_id)
    if entry.deleted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Restore this note before adding photos.")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The photo is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Photos can be up to 10 MB.")
    if mime not in IMAGE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Choose a JPEG, PNG or WebP photo.")
    if _image_counts(db, [entry.id]).get(entry.id, 0) >= MAX_IMAGES_PER_NOTE:
        raise HTTPException(status.HTTP_409_CONFLICT, f"A note can hold up to {MAX_IMAGES_PER_NOTE} photos.")
    db.add(VaultImage(entry_id=entry.id, user_id=user.id, data=encrypt_bytes(data), mime="image/jpeg" if mime == "image/jpg" else mime))
    entry.updated_at = utc_now()
    db.commit()
    db.refresh(entry)
    return _full(db, entry)


def _owned_image(db: Session, user: User, entry_id: UUID, image_id: UUID) -> VaultImage:
    image = db.scalar(
        select(VaultImage).where(VaultImage.id == image_id, VaultImage.entry_id == entry_id, VaultImage.user_id == user.id)
    )
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found.")
    return image


def get_image(db: Session, user: User, entry_id: UUID, image_id: UUID) -> tuple[bytes, str]:
    image = _owned_image(db, user, entry_id, image_id)
    return decrypt_bytes(image.data), image.mime


def delete_image(db: Session, user: User, entry_id: UUID, image_id: UUID) -> VaultEntryOut:
    image = _owned_image(db, user, entry_id, image_id)
    db.delete(image)
    entry = _owned_entry(db, user.id, entry_id)
    entry.updated_at = utc_now()
    db.commit()
    db.refresh(entry)
    return _full(db, entry)
