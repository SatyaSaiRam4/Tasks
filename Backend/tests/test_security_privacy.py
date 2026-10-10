from datetime import timedelta

from sqlalchemy import text

from tests.conftest import register

API = "/api/v1"


def unlock_headers(client, auth, pin="2468"):
    status_ = client.get(f"{API}/vault/status", headers=auth).json()
    if not status_["has_pin"]:
        res = client.post(f"{API}/vault/setup", json={"pin": pin}, headers=auth)
    else:
        res = client.post(f"{API}/vault/unlock", json={"pin": pin}, headers=auth)
    assert res.status_code in (200, 201), res.text
    return {**auth, "X-Vault-Token": res.json()["vault_token"]}


# ---- Vault -------------------------------------------------------------------


def test_vault_entries_require_an_unlock(client, auth):
    res = client.get(f"{API}/vault/entries", headers=auth)
    assert res.status_code == 403
    assert res.headers.get("X-Vault-Locked") == "1"


def test_vault_content_is_encrypted_at_rest(client, auth, db):
    vh = unlock_headers(client, auth)
    secret = "bank pin is 9911"
    res = client.post(f"{API}/vault/entries", json={"title": "Bank", "content": secret, "folder": "Credentials", "tags": ["money"]}, headers=vh)
    assert res.status_code == 201
    stored = db.execute(text("SELECT ciphertext FROM vault_entries")).scalar()
    assert secret not in stored and "Bank" not in stored and "Credentials" not in stored
    assert res.headers["Cache-Control"] == "no-store"


def test_vault_search_folders_and_views(client, auth):
    vh = unlock_headers(client, auth)
    a = client.post(f"{API}/vault/entries", json={"title": "Wifi", "content": "home password", "folder": "Home"}, headers=vh).json()
    client.post(f"{API}/vault/entries", json={"title": "Idea", "content": "an app", "folder": "Ideas", "tags": ["work"]}, headers=vh)
    assert [e["title"] for e in client.get(f"{API}/vault/entries", params={"q": "password"}, headers=vh).json()] == ["Wifi"]
    assert [e["title"] for e in client.get(f"{API}/vault/entries", params={"tag": "work"}, headers=vh).json()] == ["Idea"]
    folders = {f["name"]: f["count"] for f in client.get(f"{API}/vault/folders", headers=vh).json()}
    assert folders == {"Home": 1, "Ideas": 1}

    client.post(f"{API}/vault/entries/{a['id']}/favorite", headers=vh)
    assert [e["title"] for e in client.get(f"{API}/vault/entries", params={"view": "favorites"}, headers=vh).json()] == ["Wifi"]

    # Permanent delete only from Trash.
    assert client.delete(f"{API}/vault/entries/{a['id']}", headers=vh).status_code == 409
    client.post(f"{API}/vault/entries/{a['id']}/trash", headers=vh)
    assert [e["title"] for e in client.get(f"{API}/vault/entries", params={"view": "trash"}, headers=vh).json()] == ["Wifi"]
    assert client.delete(f"{API}/vault/entries/{a['id']}", headers=vh).status_code == 204


def test_wrong_pins_lock_the_vault(client, auth, clock):
    client.post(f"{API}/vault/setup", json={"pin": "2468"}, headers=auth)
    for attempt in range(4):
        res = client.post(f"{API}/vault/unlock", json={"pin": "0000"}, headers=auth)
        # Not 401: that would make the app refresh its session and resubmit,
        # spending two attempts per wrong PIN.
        assert res.status_code == 403
        assert f"{4 - attempt} attempt" in res.json()["error"]["message"]
    res = client.post(f"{API}/vault/unlock", json={"pin": "0000"}, headers=auth)
    assert res.status_code == 423
    # Even the right PIN is refused during the lockout…
    assert client.post(f"{API}/vault/unlock", json={"pin": "2468"}, headers=auth).status_code == 423
    # …and works once it has passed.
    clock.advance(minutes=6)
    assert client.post(f"{API}/vault/unlock", json={"pin": "2468"}, headers=auth).status_code == 200


def test_vault_token_is_bound_to_its_user(client, auth):
    vh = unlock_headers(client, auth)
    other, _ = register(client, email="other@example.com", name="Other")
    res = client.get(f"{API}/vault/entries", headers={**other, "X-Vault-Token": vh["X-Vault-Token"]})
    assert res.status_code == 403


def test_login_token_cannot_be_used_as_a_vault_token(client, auth):
    login_token = auth["Authorization"].split()[1]
    res = client.get(f"{API}/vault/entries", headers={**auth, "X-Vault-Token": login_token})
    assert res.status_code == 403


def test_vault_never_reaches_the_dashboard(client, auth):
    vh = unlock_headers(client, auth)
    client.post(f"{API}/vault/entries", json={"title": "Top secret", "content": "launch codes"}, headers=vh)
    body = client.get(f"{API}/dashboard/summary", headers=auth).text
    assert "Top secret" not in body and "launch codes" not in body


# ---- Discover / privacy -------------------------------------------------------


def test_profiles_are_private_by_default_and_indistinguishable_from_missing(client, auth):
    _, other_user = register(client, email="sam@example.com", name="Sam")
    private = client.get(f"{API}/users/search", params={"public_id": other_user["public_id"]}, headers=auth)
    missing = client.get(f"{API}/users/search", params={"public_id": "NOBODY_00000"}, headers=auth)
    assert private.status_code == missing.status_code == 404
    assert private.json()["error"]["message"] == missing.json()["error"]["message"]


def test_public_profile_respects_each_visibility_toggle(client, auth):
    sam, sam_user = register(client, email="sam@example.com", name="Sam")
    client.patch(f"{API}/users/me/settings", json={"is_public_profile": True, "show_best_streak": False, "show_achievements": False}, headers=sam)
    res = client.get(f"{API}/users/search", params={"public_id": sam_user["public_id"].lower()}, headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert body["display_name"] == "Sam"
    assert body["current_streak"] == 0 and body["best_streak"] is None and body["achievements"] is None
    for private_field in ("email", "id", "timezone"):
        assert private_field not in body


def test_public_ids_are_generated_and_settings_default_private(client):
    headers, user = register(client, name="Satya Sai")
    assert user["public_id"].startswith("SATYASAI_") and len(user["public_id"]) == len("SATYASAI_") + 5
    assert user["onboarding_completed"] is False
    me = client.get(f"{API}/users/me", headers=headers).json()
    assert me["settings"]["is_public_profile"] is False
    assert me["settings"]["confirmation_mode"] == "QUICK"  # one-tap confirm is the default


def test_onboarding_flag_round_trip(client, auth):
    assert client.post(f"{API}/users/me/onboarding/complete", headers=auth).json()["onboarding_completed"] is True
    assert client.post(f"{API}/users/me/onboarding/reset", headers=auth).json()["onboarding_completed"] is False


# ---- Auth ---------------------------------------------------------------------


def test_password_reset_flow(client, monkeypatch):
    sent = {}
    import app.modules.auth.service as auth_service

    monkeypatch.setattr(auth_service, "send_email", lambda to, subject, body: sent.update(to=to, body=body))
    register(client, email="reset@example.com")
    assert client.post(f"{API}/auth/forgot-password", json={"email": "reset@example.com"}).status_code == 202
    # Unknown emails get the same answer and send nothing.
    sent_before = dict(sent)
    assert client.post(f"{API}/auth/forgot-password", json={"email": "ghost@example.com"}).status_code == 202
    assert sent == sent_before

    code = next(word.rstrip(".") for word in sent["body"].split() if word.rstrip(".").isdigit() and len(word.rstrip(".")) == 6)
    bad = client.post(f"{API}/auth/reset-password", json={"email": "reset@example.com", "code": "000000", "new_password": "newpassword1"})
    assert bad.status_code == 400
    ok = client.post(f"{API}/auth/reset-password", json={"email": "reset@example.com", "code": code, "new_password": "newpassword1"})
    assert ok.status_code == 204
    assert client.post(f"{API}/auth/login", json={"email": "reset@example.com", "password": "newpassword1"}).status_code == 200
    # A code works once.
    again = client.post(f"{API}/auth/reset-password", json={"email": "reset@example.com", "code": code, "new_password": "another123"})
    assert again.status_code == 400


def test_login_is_rate_limited(client):
    register(client, email="rl@example.com")
    codes = [
        client.post(f"{API}/auth/login", json={"email": "rl@example.com", "password": "wrong-password"}).status_code
        for _ in range(9)
    ]
    assert codes[:8] == [401] * 8 and codes[8] == 429


def test_wrong_current_password_is_forbidden_not_unauthenticated(client, auth):
    # A 401 would make the app treat the session as expired and refresh/retry.
    wrong = {"current_password": "not-my-password", "new_password": "brandnew123"}
    assert client.post(f"{API}/auth/change-password", json=wrong, headers=auth).status_code == 403
    right = {"current_password": "password123", "new_password": "brandnew123"}
    assert client.post(f"{API}/auth/change-password", json=right, headers=auth).status_code == 204


# ---- Reminders ----------------------------------------------------------------


def test_reminder_snooze_and_complete(client, auth, clock):
    at = (clock.now + timedelta(hours=1)).isoformat()
    r = client.post(f"{API}/reminders", json={"title": "Call John", "remind_at": at, "whatsapp_number": "+919876543210", "priority": "HIGH"}, headers=auth).json()
    assert r["priority"] == "HIGH" and r["whatsapp_status"] == "PENDING"

    snoozed = client.post(f"{API}/reminders/{r['id']}/snooze", json={"minutes": 15}, headers=auth).json()
    assert snoozed["remind_at"] > r["remind_at"]

    done = client.post(f"{API}/reminders/{r['id']}/complete", headers=auth).json()
    assert done["completed_at"] is not None and done["whatsapp_status"] == "NOT_REQUESTED"
    assert client.post(f"{API}/reminders/{r['id']}/uncomplete", headers=auth).json()["completed_at"] is None


def test_reminder_alarm_option(client, auth, clock):
    at = (clock.now + timedelta(hours=1)).isoformat()
    plain = client.post(f"{API}/reminders", json={"title": "Water plants", "remind_at": at}, headers=auth).json()
    assert plain["alarm_enabled"] is False

    alarm = client.post(f"{API}/reminders", json={"title": "Science project", "remind_at": at, "alarm_enabled": True}, headers=auth).json()
    assert alarm["alarm_enabled"] is True

    # Editing other fields leaves the alarm as it was; it can be switched off.
    renamed = client.patch(f"{API}/reminders/{alarm['id']}", json={"title": "Science fair"}, headers=auth).json()
    assert renamed["alarm_enabled"] is True
    off = client.patch(f"{API}/reminders/{alarm['id']}", json={"alarm_enabled": False}, headers=auth).json()
    assert off["alarm_enabled"] is False


def test_reminder_track_must_belong_to_the_user(client, auth, clock):
    other, _ = register(client, email="other@example.com", name="Other")
    track = client.post(f"{API}/tracks", json={"name": "Mine"}, headers=other).json()
    at = (clock.now + timedelta(hours=1)).isoformat()
    res = client.post(f"{API}/reminders", json={"title": "x", "remind_at": at, "track_id": track["id"]}, headers=auth)
    assert res.status_code == 404


def test_reminders_move_to_done_once_their_time_passes(client, auth, clock, db):
    from datetime import datetime, timezone

    from app.modules.reminders.service import auto_complete_due

    soon = (clock.now + timedelta(hours=1)).isoformat()
    later = (clock.now + timedelta(hours=5)).isoformat()
    r1 = client.post(f"{API}/reminders", json={"title": "Call", "remind_at": soon}, headers=auth).json()
    r2 = client.post(f"{API}/reminders", json={"title": "Pay bill", "remind_at": later}, headers=auth).json()

    marked = auto_complete_due(db, whatsapp_ready=False, now=clock.now + timedelta(hours=2))
    assert marked == 1
    done = client.get(f"{API}/reminders/{r1['id']}", headers=auth).json()
    assert datetime.fromisoformat(done["completed_at"]) == datetime.fromisoformat(r1["remind_at"]).astimezone(timezone.utc)
    assert client.get(f"{API}/reminders/{r2['id']}", headers=auth).json()["completed_at"] is None


def test_cleanup_empties_only_old_bin_notes(client, auth, db, monkeypatch, clock):
    from app.core import config

    monkeypatch.setattr(config, "CRON_SECRET", "s3cret")
    vh = unlock_headers(client, auth)
    old = client.post(f"{API}/vault/entries", json={"title": "Old", "content": "binned long ago"}, headers=vh).json()
    recent = client.post(f"{API}/vault/entries", json={"title": "Recent", "content": "binned today"}, headers=vh).json()
    kept = client.post(f"{API}/vault/entries", json={"title": "Kept", "content": "never binned"}, headers=vh).json()
    client.post(f"{API}/vault/entries/{old['id']}/trash", headers=vh)
    client.post(f"{API}/vault/entries/{recent['id']}/trash", headers=vh)
    long_ago = clock.now - timedelta(days=31)
    db.execute(text("UPDATE vault_entries SET deleted_at = :t WHERE id = :id"), {"t": long_ago, "id": old["id"]})
    db.execute(text("UPDATE vault_entries SET deleted_at = :t WHERE id = :id"), {"t": clock.now, "id": recent["id"]})
    db.execute(text("UPDATE vault_entries SET created_at = :t WHERE id = :id"), {"t": clock.now - timedelta(days=400), "id": kept["id"]})
    db.commit()

    res = client.post(f"{API}/maintenance/cleanup", headers={"X-Cron-Secret": "s3cret"}).json()
    assert res["bin_notes_deleted"] == 1
    assert client.get(f"{API}/vault/entries/{old['id']}", headers=vh).status_code == 404
    assert client.get(f"{API}/vault/entries/{recent['id']}", headers=vh).status_code == 200
    assert client.get(f"{API}/vault/entries/{kept['id']}", headers=vh).status_code == 200


def test_vault_voice_note_is_encrypted_and_private(client, auth, db):
    vh = unlock_headers(client, auth)
    note = client.post(f"{API}/vault/entries", json={"title": "Voice memo"}, headers=vh).json()
    assert note["has_audio"] is False
    audio = b"\x00\x00\x00\x18ftypM4A fake recording bytes" * 10
    res = client.put(
        f"{API}/vault/entries/{note['id']}/audio",
        files={"file": ("voice.m4a", audio, "audio/mp4")},
        data={"seconds": "7"},
        headers=vh,
    )
    assert res.status_code == 200, res.text
    assert res.json()["has_audio"] is True and res.json()["audio_seconds"] == 7

    stored = db.execute(text("SELECT audio FROM vault_entries WHERE id = :id"), {"id": note["id"]}).scalar()
    assert audio not in bytes(stored)  # encrypted at rest

    got = client.get(f"{API}/vault/entries/{note['id']}/audio", headers=vh)
    assert got.status_code == 200 and got.content == audio and got.headers["content-type"] == "audio/mp4"
    listed = client.get(f"{API}/vault/entries", headers=vh).json()
    assert listed[0]["has_audio"] is True

    # Without the Vault session there is no way in.
    assert client.get(f"{API}/vault/entries/{note['id']}/audio", headers=auth).status_code in (401, 403)
    bad = client.put(f"{API}/vault/entries/{note['id']}/audio", files={"file": ("x.txt", b"hi", "text/plain")}, data={"seconds": "1"}, headers=vh)
    assert bad.status_code == 415
    assert client.delete(f"{API}/vault/entries/{note['id']}/audio", headers=vh).json()["has_audio"] is False
