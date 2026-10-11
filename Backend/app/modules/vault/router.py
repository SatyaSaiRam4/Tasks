from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core import rate_limit, security
from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User

from . import service
from .schemas import (
    PinChange,
    PinReset,
    PinSetup,
    PinUnlock,
    VaultEntryCreate,
    VaultEntryOut,
    VaultEntrySummary,
    VaultEntryUpdate,
    VaultFolderOut,
    VaultSessionOut,
    VaultStatusOut,
)


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def get_vault_user(
    response: Response,
    current_user: User = Depends(get_current_user),
    x_vault_token: str | None = Header(default=None),
) -> User:
    """Requires both a valid login and a valid, unexpired Vault unlock for that same user."""
    _no_store(response)
    if not x_vault_token:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The Vault is locked.", headers={"X-Vault-Locked": "1"})
    try:
        payload = security.decode_token(x_vault_token)
    except HTTPException:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The Vault is locked.", headers={"X-Vault-Locked": "1"})
    if payload.get("type") != "vault" or payload.get("sub") != str(current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The Vault is locked.", headers={"X-Vault-Locked": "1"})
    return current_user


router = APIRouter(prefix="/vault", tags=["vault"])


@router.get("/status", response_model=VaultStatusOut)
def vault_status(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _no_store(response)
    return service.vault_status(db, current_user)


@router.post("/setup", response_model=VaultSessionOut, status_code=status.HTTP_201_CREATED)
def setup(payload: PinSetup, response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _no_store(response)
    return service.setup_pin(db, current_user, payload.pin)


@router.post("/unlock", response_model=VaultSessionOut)
def unlock(payload: PinUnlock, response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _no_store(response)
    rate_limit.hit(f"vault-unlock:{current_user.id}", limit=10, window_seconds=60)
    return service.unlock(db, current_user, payload.pin)


@router.post("/change-pin", response_model=VaultSessionOut)
def change_pin(payload: PinChange, response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _no_store(response)
    rate_limit.hit(f"vault-unlock:{current_user.id}", limit=10, window_seconds=60)
    return service.change_pin(db, current_user, payload.current_pin, payload.new_pin)


@router.post("/reset-pin", response_model=VaultSessionOut)
def reset_pin(payload: PinReset, response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Forgot the PIN: the account password sets a new one. Notes are kept."""
    _no_store(response)
    rate_limit.hit(f"vault-reset:{current_user.id}", limit=5, window_seconds=600)
    return service.reset_pin(db, current_user, payload.password, payload.new_pin)


@router.get("/entries", response_model=list[VaultEntrySummary])
def list_entries(
    view: str = "all",
    q: str | None = None,
    folder: str | None = None,
    tag: str | None = None,
    user: User = Depends(get_vault_user),
    db: Session = Depends(get_db),
):
    return service.list_entries(db, user, view, q, folder, tag)


@router.get("/folders", response_model=list[VaultFolderOut])
def list_folders(user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    return service.folders(db, user)


@router.post("/entries", response_model=VaultEntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(payload: VaultEntryCreate, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    return service.create_entry(db, user, payload.model_dump())


@router.post("/trash/empty", status_code=status.HTTP_204_NO_CONTENT)
def empty_trash(user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    service.empty_trash(db, user)


@router.get("/entries/{entry_id}", response_model=VaultEntryOut)
def get_entry(entry_id: UUID, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    return service.get_entry(db, user, entry_id)


@router.patch("/entries/{entry_id}", response_model=VaultEntryOut)
def update_entry(
    entry_id: UUID, payload: VaultEntryUpdate, user: User = Depends(get_vault_user), db: Session = Depends(get_db)
):
    return service.update_entry(db, user, entry_id, payload.model_dump(exclude_unset=True))


@router.put("/entries/{entry_id}/audio", response_model=VaultEntryOut)
async def put_audio(
    entry_id: UUID,
    file: UploadFile = File(...),
    seconds: int = Form(...),
    user: User = Depends(get_vault_user),
    db: Session = Depends(get_db),
):
    """Attaches a voice recording to a note (replacing any earlier one)."""
    data = await file.read(service.MAX_AUDIO_BYTES + 1)
    return service.set_audio(db, user, entry_id, data, (file.content_type or "").split(";")[0].strip(), seconds)


@router.get("/entries/{entry_id}/audio")
def get_audio(entry_id: UUID, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    data, mime = service.get_audio(db, user, entry_id)
    # Private and decrypted on the fly: never cached anywhere along the way.
    return Response(content=data, media_type=mime, headers={"Cache-Control": "no-store"})


@router.delete("/entries/{entry_id}/audio", response_model=VaultEntryOut)
def delete_audio(entry_id: UUID, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    return service.delete_audio(db, user, entry_id)


@router.post("/entries/{entry_id}/images", response_model=VaultEntryOut)
async def add_image(
    entry_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_vault_user),
    db: Session = Depends(get_db),
):
    """Attaches a photo (an ID card, a document) to a note, encrypted."""
    data = await file.read(service.MAX_IMAGE_BYTES + 1)
    return service.add_image(db, user, entry_id, data, (file.content_type or "").split(";")[0].strip().lower())


@router.get("/entries/{entry_id}/images/{image_id}")
def get_image(entry_id: UUID, image_id: UUID, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    data, mime = service.get_image(db, user, entry_id, image_id)
    return Response(content=data, media_type=mime, headers={"Cache-Control": "no-store"})


@router.delete("/entries/{entry_id}/images/{image_id}", response_model=VaultEntryOut)
def delete_image(entry_id: UUID, image_id: UUID, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    return service.delete_image(db, user, entry_id, image_id)


_FLAG_ROUTES = {
    "pin": ("pinned", True),
    "unpin": ("pinned", False),
    "favorite": ("is_favorite", True),
    "unfavorite": ("is_favorite", False),
    "archive": ("is_archived", True),
    "unarchive": ("is_archived", False),
    "trash": ("trash", True),
    "restore": ("trash", False),
}


@router.post("/entries/{entry_id}/{action}", response_model=VaultEntryOut)
def set_flag(entry_id: UUID, action: str, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    if action not in _FLAG_ROUTES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown action.")
    flag, value = _FLAG_ROUTES[action]
    return service.set_flag(db, user, entry_id, flag, value)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: UUID, user: User = Depends(get_vault_user), db: Session = Depends(get_db)):
    service.delete_permanently(db, user, entry_id)
