"""Deleting an account (app stores require it in the app and on the web):
an emailed code confirms it, then the account and all its data are gone."""

import re

from sqlalchemy import text

from tests.conftest import OUTBOX, register

API = "/api/v1"


def deletion_code(email):
    mails = [m for m in OUTBOX if m[0] == email and "deletion code" in m[1]]
    assert mails, "no deletion email"
    return re.search(r"\b(\d{6})\b", mails[-1][2]).group(1)


def test_deleting_an_account_removes_it_and_its_data(client, db):
    auth, _ = register(client, email="gone@example.com", name="Gone")
    other, _ = register(client, email="stays@example.com", name="Stays")
    for name, who in (("Fitness", auth), ("Reading", other)):
        made = client.post(f"{API}/tracks", json={"name": name, "start_date": "2026-10-05", "end_date": "2026-10-20"}, headers=who)
        assert made.status_code == 201, made.text
    assert db.execute(text("SELECT count(*) FROM tracks")).scalar() == 2

    res = client.post(f"{API}/auth/delete-account/request", json={"email": "gone@example.com"})
    assert res.status_code == 202
    code = deletion_code("gone@example.com")
    assert client.post(f"{API}/auth/delete-account/confirm", json={"email": "gone@example.com", "code": "000000" if code != "000000" else "111111"}).status_code == 400
    assert client.post(f"{API}/auth/delete-account/confirm", json={"email": "gone@example.com", "code": code}).status_code == 204

    assert db.execute(text("SELECT count(*) FROM users WHERE email = 'gone@example.com'")).scalar() == 0
    assert db.execute(text("SELECT count(*) FROM tracks t JOIN users u ON u.id = t.user_id WHERE u.email = 'stays@example.com'")).scalar() == 1
    assert db.execute(text("SELECT count(*) FROM tracks")).scalar() == 1
    # Signed out everywhere: the old token no longer works.
    assert client.get(f"{API}/users/me", headers=auth).status_code == 401
    # The code can't be used twice, and the email can sign up again as a new account.
    assert client.post(f"{API}/auth/delete-account/confirm", json={"email": "gone@example.com", "code": code}).status_code == 400


def test_the_request_never_reveals_whether_an_email_has_an_account(client):
    res = client.post(f"{API}/auth/delete-account/request", json={"email": "nobody@example.com"})
    assert res.status_code == 202 and "If that email has an account" in res.json()["message"]


def test_the_last_admin_cant_be_deleted(client, db):
    register(client, email="boss@example.com", name="Boss")
    db.execute(text("UPDATE users SET role = 'ADMIN'"))
    db.commit()
    client.post(f"{API}/auth/delete-account/request", json={"email": "boss@example.com"})
    res = client.post(f"{API}/auth/delete-account/confirm", json={"email": "boss@example.com", "code": deletion_code("boss@example.com")})
    assert res.status_code == 409
    assert db.execute(text("SELECT count(*) FROM users")).scalar() == 1


def test_privacy_and_deletion_pages_are_public(client):
    privacy = client.get("/privacy")
    assert privacy.status_code == 200 and "Privacy Policy" in privacy.text and "/account/delete" in privacy.text
    page = client.get("/account/delete")
    assert page.status_code == 200 and "Delete your Memo account" in page.text and "/api/v1/auth/delete-account" in page.text


def _request(client, email):
    res = client.post(f"{API}/auth/delete-account/request", json={"email": email})
    assert res.status_code == 202, res.text


def _confirm(client, email, code):
    return client.post(f"{API}/auth/delete-account/confirm", json={"email": email, "code": code})


def test_deletion_removes_every_kind_of_data_and_keeps_only_unnamed_records(client, db):
    """Reminders, wallet, WhatsApp usage and plans, settings and streaks go;
    payment records and each number's YES/STOP answer stay, without the user."""
    auth, user = register(client, email="gone@example.com", name="Gone")
    uid = user["id"]
    at = "2030-01-01T09:00:00+00:00"
    assert client.post(f"{API}/reminders", json={"title": "Call mom", "remind_at": at}, headers=auth).status_code == 201
    client.get(f"{API}/wallet", headers=auth)  # creates the streak state
    db.execute(text("INSERT INTO wallet_redemptions (id, user_id, amount, points, phone, status, created_at) "
                    "VALUES (gen_random_uuid(), :u, 10, 500, '+919876543210', 'PENDING', now())"), {"u": uid})
    db.execute(text("INSERT INTO payment_orders (id, user_id, purpose, amount_paise, currency, provider, mode, provider_order_id, status, created_at, updated_at) "
                    "VALUES (gen_random_uuid(), :u, 'WHATSAPP_PLAN', 3000, 'INR', 'razorpay', 'test', 'order_DEL1', 'PAID', now(), now())"), {"u": uid})
    db.execute(text("INSERT INTO whatsapp_plans (id, user_id, payment_order_id, messages_granted, messages_carried, messages_used, starts_at, expires_at, created_at) "
                    "SELECT gen_random_uuid(), :u, id, 100, 0, 0, now(), now() + interval '30 days', now() FROM payment_orders WHERE provider_order_id = 'order_DEL1'"), {"u": uid})
    db.execute(text("INSERT INTO whatsapp_usage (id, user_id, source, idempotency_key, status, counted, created_at, updated_at) "
                    "VALUES (gen_random_uuid(), :u, 'FREE', 'del-1', 'ACCEPTED', true, now(), now())"), {"u": uid})
    db.execute(text("INSERT INTO whatsapp_contacts (phone, status, refusals, requested_by, created_at, updated_at) "
                    "VALUES ('+919876543210', 'STOPPED', 1, :u, now(), now())"), {"u": uid})
    db.commit()

    _request(client, "gone@example.com")
    assert _confirm(client, "gone@example.com", deletion_code("gone@example.com")).status_code == 204

    def count(table, where="user_id = :u"):
        return db.execute(text(f"SELECT count(*) FROM {table} WHERE {where}"), {"u": uid}).scalar()

    for table in ("users WHERE id = :u", "reminders", "wallet_redemptions", "whatsapp_plans", "whatsapp_usage",
                  "user_settings", "streak_states", "refresh_sessions", "account_deletion_codes"):
        name, _, where = table.partition(" WHERE ")
        assert count(name, where or "user_id = :u") == 0, table
    # Kept, without the user: the payment record, and the number's STOP (so it's still respected).
    assert db.execute(text("SELECT user_id, status FROM payment_orders WHERE provider_order_id = 'order_DEL1'")).one() == (None, "PAID")
    assert db.execute(text("SELECT requested_by, status FROM whatsapp_contacts")).one() == (None, "STOPPED")


def test_an_expired_code_is_refused(client, clock):
    register(client, email="gone@example.com", name="Gone")
    _request(client, "gone@example.com")
    code = deletion_code("gone@example.com")
    clock.advance(minutes=16)
    assert _confirm(client, "gone@example.com", code).status_code == 400


def test_five_wrong_tries_use_up_the_code(client, db):
    register(client, email="gone@example.com", name="Gone")
    _request(client, "gone@example.com")
    code = deletion_code("gone@example.com")
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert _confirm(client, "gone@example.com", wrong).status_code == 400
    assert _confirm(client, "gone@example.com", code).status_code == 400
    assert db.execute(text("SELECT count(*) FROM users")).scalar() == 1


def test_a_new_request_replaces_the_old_code(client):
    register(client, email="gone@example.com", name="Gone")
    _request(client, "gone@example.com")
    first = deletion_code("gone@example.com")
    _request(client, "gone@example.com")
    second = deletion_code("gone@example.com")
    if first != second:
        assert _confirm(client, "gone@example.com", first).status_code == 400
    assert _confirm(client, "gone@example.com", second).status_code == 204


def test_one_accounts_code_cant_delete_another(client, db):
    register(client, email="alice@example.com", name="Alice")
    register(client, email="bob@example.com", name="Bob")
    _request(client, "alice@example.com")
    assert _confirm(client, "bob@example.com", deletion_code("alice@example.com")).status_code == 400
    assert db.execute(text("SELECT count(*) FROM users")).scalar() == 2


def test_requests_are_rate_limited(client):
    register(client, email="gone@example.com", name="Gone")
    for _ in range(3):
        _request(client, "gone@example.com")
    assert client.post(f"{API}/auth/delete-account/request", json={"email": "gone@example.com"}).status_code == 429


def test_pages_show_the_support_email_or_a_neutral_contact(client, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config, "SUPPORT_EMAIL", "")
    for path in ("/privacy", "/account/delete"):
        page = client.get(path).text
        assert "the page where you downloaded Memo" in page and "Google Play" not in page
    monkeypatch.setattr(config, "SUPPORT_EMAIL", "help@example.com")
    for path in ("/privacy", "/account/delete"):
        assert 'href="mailto:help@example.com"' in client.get(path).text
    # A value with HTML in it can't break out of the page.
    monkeypatch.setattr(config, "SUPPORT_EMAIL", "<script>x</script>")
    assert "<script>x</script>" not in client.get("/privacy").text


def test_the_policy_states_what_the_app_does(client):
    page = client.get("/privacy").text
    for fact in ("not available yet", "never</b> sent to or stored on Memo's servers", "YES or STOP", "IP address",
                 "Vault", "7 days", "/account/delete"):
        assert fact in page, fact
