"""Google sign-in, with real signed tokens.

A test RSA key stands in for Google's: tokens are genuinely signed JWTs and go
through the real verification (signature, expiry, issuer, audience, claims).
Only the lookup of Google's public key is replaced.
"""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import config
from app.integrations import google

API = "/api/v1/auth"
CLIENT_ID = "test-web-client.apps.googleusercontent.com"
GOOGLE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
FORGER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def google_keys(monkeypatch):
    monkeypatch.setattr(config, "GOOGLE_CLIENT_IDS", [CLIENT_ID])
    monkeypatch.setattr(google, "_signing_key", lambda token: GOOGLE_KEY.public_key())


def token(email="gina@gmail.com", sub="google-sub-1", key=GOOGLE_KEY, **overrides):
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": sub,
        "email": email,
        "email_verified": True,
        "name": "Gina Google",
        "iat": now,
        "exp": now + 3600,
        **overrides,
    }
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})


def sign_in(client, id_token):
    return client.post(f"{API}/google", json={"id_token": id_token, "timezone": "Asia/Kolkata"})


# ---- Verification -------------------------------------------------------------------------


def test_valid_token_creates_a_verified_account(client):
    res = sign_in(client, token())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["email"] == "gina@gmail.com"
    assert body["user"]["display_name"] == "Gina Google"
    assert body["user"]["role"] == "USER"


@pytest.mark.parametrize(
    "bad",
    [
        pytest.param({"exp": int(time.time()) - 600, "iat": int(time.time()) - 4200}, id="expired"),
        pytest.param({"aud": "someone-elses-app.apps.googleusercontent.com"}, id="wrong-audience"),
        pytest.param({"iss": "https://evil.example.com"}, id="wrong-issuer"),
        pytest.param({"email_verified": False}, id="unverified-email"),
    ],
)
def test_bad_tokens_are_refused(client, bad):
    res = sign_in(client, token(**bad))
    assert res.status_code == 401, res.text


def test_forged_signature_is_refused(client):
    assert sign_in(client, token(key=FORGER_KEY)).status_code == 401


def test_unsigned_or_garbage_tokens_are_refused(client):
    unsigned = jwt.encode({"iss": "accounts.google.com", "aud": CLIENT_ID, "sub": "x", "email": "a@b.co"}, None, algorithm="none")
    assert sign_in(client, unsigned + "x" * 20).status_code == 401
    assert sign_in(client, "not-a-jwt-at-all-but-long-enough").status_code == 401


def test_server_without_client_ids_refuses(client, monkeypatch):
    monkeypatch.setattr(config, "GOOGLE_CLIENT_IDS", [])
    assert sign_in(client, token()).status_code == 401


def test_google_down_is_a_503(client, monkeypatch):
    def down(_token):
        raise google.GoogleUnavailable("no network")

    monkeypatch.setattr(google, "_signing_key", down)
    assert sign_in(client, token()).status_code == 503


# ---- Accounts -----------------------------------------------------------------------------


def test_signing_in_again_reuses_the_account(client):
    first = sign_in(client, token()).json()["user"]["id"]
    second = sign_in(client, token()).json()["user"]["id"]
    assert first == second


def test_links_a_verified_password_account(client):
    from tests.conftest import register

    _, user = register(client, email="gina@gmail.com", name="Gina")
    res = sign_in(client, token())
    assert res.json()["user"]["id"] == user["id"]
    # The password still works too.
    assert client.post(f"{API}/login", json={"email": "gina@gmail.com", "password": "password123"}).status_code == 200


def test_unverified_account_is_claimed_and_its_password_wiped(client):
    # Someone pre-registered this address but never proved they own it.
    client.post(f"{API}/register", json={"email": "gina@gmail.com", "password": "squatter-pass1", "display_name": "Squatter"})
    assert sign_in(client, token()).status_code == 200
    # The squatter's password no longer opens the account.
    res = client.post(f"{API}/login", json={"email": "gina@gmail.com", "password": "squatter-pass1"})
    assert res.status_code == 401


def test_different_google_account_cannot_take_a_linked_email(client):
    assert sign_in(client, token(sub="google-sub-1")).status_code == 200
    assert sign_in(client, token(sub="google-sub-2")).status_code == 409


def test_admin_accounts_are_never_linked(client, db):
    from sqlalchemy import text

    from tests.conftest import register

    register(client, email="boss@gmail.com", name="Boss")
    db.execute(text("UPDATE users SET role = 'ADMIN' WHERE email = 'boss@gmail.com'"))
    db.commit()
    res = sign_in(client, token(email="boss@gmail.com"))
    assert res.status_code == 403


def test_email_from_the_client_is_never_trusted(client):
    """Only the signed token says who the user is; there is no email field to spoof."""
    res = client.post(f"{API}/google", json={"id_token": token(email="gina@gmail.com"), "email": "victim@gmail.com"})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "gina@gmail.com"
