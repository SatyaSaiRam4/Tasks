"""Vault encryption at rest.

Each entry's user-written fields are serialized to JSON and encrypted with
Fernet (AES-128-CBC + HMAC-SHA256). Keys come from VAULT_ENCRYPTION_KEYS in the
environment, never from the database, so a database leak alone doesn't expose
Vault content. MultiFernet lets a new key be prepended while older ones still
decrypt existing entries.
"""

import json
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.core.config import VAULT_ENCRYPTION_KEYS


class VaultKeyError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _cipher() -> MultiFernet:
    if not VAULT_ENCRYPTION_KEYS:
        raise VaultKeyError("VAULT_ENCRYPTION_KEYS is not configured.")
    return MultiFernet([Fernet(k) for k in VAULT_ENCRYPTION_KEYS])


def encrypt_payload(payload: dict) -> str:
    return _cipher().encrypt(json.dumps(payload, ensure_ascii=False).encode()).decode()


def encrypt_bytes(data: bytes) -> bytes:
    return _cipher().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    try:
        return _cipher().decrypt(token)
    except InvalidToken as exc:
        raise VaultKeyError("A Vault recording could not be decrypted with the configured keys.") from exc


def decrypt_payload(ciphertext: str) -> dict:
    try:
        return json.loads(_cipher().decrypt(ciphertext.encode()))
    except InvalidToken as exc:
        raise VaultKeyError("A Vault entry could not be decrypted with the configured keys.") from exc
