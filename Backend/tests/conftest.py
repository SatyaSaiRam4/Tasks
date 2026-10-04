"""Test harness.

Runs the real FastAPI app against a dedicated, Alembic-migrated test database
(TEST_DATABASE_URL, default: the local throwaway container). Tables are
truncated between tests. The app's lifespan (admin seeding, background jobs)
is deliberately not started, so nothing ever touches the real database.

A controllable clock replaces the server's notion of "now" so multi-day streak
behaviour can be tested deterministically.
"""

import os
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg2://postgres:test@127.0.0.1:55432/rememberly_test"
)

from app.core import rate_limit, timeutil  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402

engine = create_engine(TEST_DATABASE_URL)
TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

TABLES = [
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
        self.now = datetime(2026, 10, 5, 6, 0, tzinfo=timezone.utc)  # a Monday

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
    import app.modules.tracks.service as tracks_service
    import app.modules.users.service as users_service
    import app.modules.vault.service as vault_service
    import app.modules.auth.service as auth_service

    for module in (actions_service, tracks_service, users_service, vault_service, auth_service):
        if hasattr(module, "utc_now"):
            monkeypatch.setattr(module, "utc_now", c)
    return c


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
    body = res.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


@pytest.fixture
def auth(client):
    headers, user = register(client)
    return headers
