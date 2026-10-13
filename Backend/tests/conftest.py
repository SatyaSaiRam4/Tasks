"""Test harness.

Runs the real FastAPI app against a dedicated, Alembic-migrated test database
(TEST_DATABASE_URL, default: the local throwaway container). Tables are
truncated between tests. The app's lifespan (admin seeding, background jobs)
is deliberately not started, so nothing ever touches the real database.

A controllable clock replaces the server's notion of "now" so multi-day streak
behaviour can be tested deterministically.
"""

import os
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg2://postgres:test@127.0.0.1:55432/rememberly_test"
)

from app.core import rate_limit, timeutil
from app.db.session import get_db
from app.main import app

engine = create_engine(TEST_DATABASE_URL)
TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

TABLES = [
    "whatsapp_usage",
    "whatsapp_plans",
    "payment_events",
    "payment_orders",
    "whatsapp_auto_replies",
    "whatsapp_inbound_log",
    "whatsapp_contacts",
    "vault_images",
    "email_verification_codes",
    "wallet_redemptions",
    "user_achievements",
    "track_completions",
    "streak_states",
    "daily_records",
    "action_completions",
    "action_steps",
    "actions",
    "reminders",
    "legacy_category_checklist_items",
    "tracks",
    "vault_entries",
    "vault_credentials",
    "password_reset_codes",
    "user_settings",
    "refresh_sessions",
    "users",
]


def _override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


class Clock:
    def __init__(self):
        self.now = datetime(2026, 10, 5, 6, 0, tzinfo=UTC)  # a Monday

    def set(self, value: datetime) -> None:
        self.now = value

    def advance(self, **kwargs) -> None:
        self.now = self.now + timedelta(**kwargs)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setattr(timeutil, "utc_now", c)
    # Modules that imported utc_now by name need patching too.
    import app.modules.actions.service as actions_service
    import app.modules.auth.service as auth_service
    import app.modules.tracks.service as tracks_service
    import app.modules.users.service as users_service
    import app.modules.vault.service as vault_service

    for module in (actions_service, tracks_service, users_service, vault_service, auth_service):
        if hasattr(module, "utc_now"):
            monkeypatch.setattr(module, "utc_now", c)
    return c


# Emails the app "sent" during a test: (to, subject, text). Codes are read from here.
OUTBOX: list[tuple[str, str, str]] = []


@pytest.fixture(autouse=True)
def capture_email(monkeypatch):
    import app.modules.auth.service as auth_service

    OUTBOX.clear()
    monkeypatch.setattr(auth_service, "send_email", lambda to, subject, text: OUTBOX.append((to, subject, text)))
    yield OUTBOX


def last_code(email: str) -> str:
    """The most recent 6-digit code emailed to `email`."""
    import re

    for to, _subject, body in reversed(OUTBOX):
        if to == email.lower():
            return re.search(r"\b(\d{6})\b", body).group(1)
    raise AssertionError(f"no email sent to {email}")


@pytest.fixture(autouse=True)
def clean_db():
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
    rate_limit.reset_all()
    yield


@pytest.fixture
def client(clock):
    return TestClient(app)


@pytest.fixture
def db():
    session = TestingSession()
    yield session
    session.close()


def register(client, email="alex@example.com", name="Alex", tz="UTC"):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "display_name": name, "timezone": tz},
    )
    assert res.status_code == 201, res.text
    assert res.json()["verification_required"] is True
    # Prove the email with the code it was sent, which signs the user in.
    res = client.post("/api/v1/auth/verify-email", json={"email": email, "code": last_code(email)})
    assert res.status_code == 200, res.text
    body = res.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


@pytest.fixture
def auth(client):
    headers, _user = register(client)
    return headers


@pytest.fixture(autouse=True)
def _no_real_whatsapp(monkeypatch):
    """Tests never message a real WhatsApp number, even with MSG91 keys in .env."""
    from app.modules.whatsapp import service as wa

    monkeypatch.setattr(wa, "send_whatsapp_text", lambda phone, text: (True, "test"))
