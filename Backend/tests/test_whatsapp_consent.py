from datetime import datetime, timedelta, timezone

from app.modules.whatsapp import router as wa_router
from app.modules.whatsapp import service as wa

API = "/api/v1"
PHONE = "+919876543210"


def _reminder(client, auth, phone=PHONE):
    at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    return client.post(f"{API}/reminders", json={"title": "Call mom", "remind_at": at, "whatsapp_number": phone}, headers=auth)


def _inbound(client, sender, text):
    return client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customer_number": sender, "direction": "inbound", "content": {"text": text}}).json()["results"]


def test_whatsapp_needs_a_yes_from_the_owner_and_stop_ends_it(client, auth, monkeypatch):
    sent = []
    monkeypatch.setattr(wa, "is_configured", lambda: True)
    monkeypatch.setattr(wa, "send_whatsapp_reminder", lambda phone, variables: sent.append((phone, variables)) or True)
    monkeypatch.setattr(wa_router, "MSG91_INBOUND_SECRET", "s3cret")

    # A number that hasn't said YES can't get reminders.
    assert _reminder(client, auth).status_code == 409

    # Asking sends one permission message (no code), through the template.
    asked = client.post(f"{API}/whatsapp/verify", json={"phone": "91 98765 43210"}, headers=auth).json()
    assert asked["phone"] == PHONE and asked["status"] == "PENDING"
    assert len(sent) == 1 and sent[0][0] == PHONE and "Reply YES to allow or STOP to refuse" in sent[0][1][0] and "👍" not in sent[0][1][0]
    # Saved while waiting, but nothing goes out until they reply YES.
    assert _reminder(client, auth).status_code == 201
    assert client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()["status"] == "PENDING"
    # Asking again inside the 1-minute window doesn't message them again.
    client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth)
    assert len(sent) == 1

    # The webhook needs the secret (but never answers 4XX: MSG91 would pause it); other replies change nothing.
    refused = client.post(f"{API}/whatsapp/inbound?token=nope", json={})
    assert refused.status_code == 200 and refused.json() == {"ok": False}
    assert _inbound(client, "919876543210", "who is this?") == ["ignored: not YES or STOP"]

    # The owner taps 👍 (MSG91 sends the button as JSON in a string): verified.
    tapped = client.post(f"{API}/whatsapp/inbound", headers={"x-memo-token": "s3cret"}, json={"customerNumber": "919876543210", "text": "", "button": '{"payload":"👍","text":"👍"}', "direction": "0"}).json()
    assert tapped["results"] == ["verified"]
    assert client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()["status"] == "VERIFIED"
    assert _reminder(client, auth).status_code == 201

    # STOP ends it; it can be asked again ("Verify again"), and a 👍 allows it again.
    assert _inbound(client, "919876543210", "STOP") == ["stopped"]
    assert _reminder(client, auth).status_code == 409
    again = client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth).json()
    assert again["status"] == "PENDING" and len(sent) == 2
    assert _inbound(client, "+91 98765 43210", "👍") == ["verified"]
    assert _reminder(client, auth).status_code == 201


def test_inbound_reads_every_msg91_shape():
    """MSG91 doesn't document its inbound body exactly, so all the likely shapes must work."""
    shapes = [
        # Old webhook: direction as a number, content as a JSON string.
        {"customer_number": "919876543210", "direction": "1", "content": '{"text": "Yes"}', "message_type": "text"},
        # Old webhook with an object.
        {"customer_number": "919876543210", "direction": "inbound", "content": {"text": "YES"}},
        # New webhook, camelCase.
        {"customerNumber": "919876543210", "text": "yes please"},
        # Meta's own shape.
        {"entry": [{"changes": [{"value": {"contacts": [{"wa_id": "919876543210"}], "messages": [{"from": "919876543210", "type": "text", "text": {"body": "YES"}}]}}]}]},
        # A quick-reply button, and a thumbs up.
        {"customer_number": "919876543210", "content": {"button": {"text": "Yes", "payload": "Yes"}}},
        {"customer_number": "919876543210", "content": {"text": "👍"}},
        # MSG91 Webhook (New), trimmed payload: a reaction (long-press 👍) and a button tap, empty text.
        {"uuid": "u1", "customerNumber": "919876543210", "contentType": "reaction", "text": "", "button": "", "reaction": '{"emoji":"👍","message_id":"wamid.x"}'},
        {"uuid": "u2", "customerNumber": "919876543210", "contentType": "button", "text": "", "button": '{"payload":"👍","text":"👍"}', "interactive": ""},
    ]
    for shape in shapes:
        messages = wa.messages_from(shape)
        assert len(messages) == 1, shape
        sender, text = messages[0]
        assert wa.normalize(sender) == PHONE, shape
        assert wa.classify(text) == "YES", (shape, text)
    # Our own outgoing delivery reports are skipped.
    assert wa.messages_from({"customer_number": "919876543210", "direction": "outbound", "content": {"text": "Reply YES"}}) == []
    assert wa.classify("STOP") == "STOP" and wa.classify("who is this") is None


def test_a_late_thumbs_up_counts_for_10_minutes_then_not(client, auth, monkeypatch, clock):
    monkeypatch.setattr(wa, "is_configured", lambda: True)
    monkeypatch.setattr(wa, "send_whatsapp_reminder", lambda phone, variables: True)
    monkeypatch.setattr(wa_router, "MSG91_INBOUND_SECRET", "s3cret")
    monkeypatch.setattr(wa, "utc_now", clock)
    client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth)
    clock.advance(seconds=90)
    # The app's 1-minute countdown is over, but a 👍 MSG91 delivers late still counts.
    assert client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()["status"] == "EXPIRED"
    assert _inbound(client, "919876543210", "👍") == ["verified"]
    # Much later (another ask, then 11 minutes): no longer.
    client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customerNumber": "919876543210", "text": "STOP"})
    client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth)
    clock.advance(minutes=11)
    assert _inbound(client, "919876543210", "👍") == ["ignored: answered more than 10 minutes after the ask"]
    # Asking again opens a new window; a 👎 refuses (STOP).
    assert client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth).json()["status"] == "PENDING"
    assert _inbound(client, "919876543210", "👎") == ["stopped"]


def test_three_refusals_in_a_day_block_asking_until_tomorrow(client, auth, monkeypatch, clock):
    monkeypatch.setattr(wa, "is_configured", lambda: True)
    monkeypatch.setattr(wa, "send_whatsapp_reminder", lambda phone, variables: True)
    monkeypatch.setattr(wa_router, "MSG91_INBOUND_SECRET", "s3cret")
    monkeypatch.setattr(wa, "utc_now", clock)
    for n in range(1, 4):
        assert client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth).json()["status"] == "PENDING"
        assert _inbound(client, "919876543210", "👎") == ["stopped"]
        state = client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()
        assert state["status"] == "STOPPED" and state["refusals_today"] == n
    assert state["try_again_at"] is not None
    blocked = client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth)
    assert blocked.status_code == 429 and "tomorrow" in blocked.json()["error"]["message"]
    # The next day it can be asked again.
    clock.advance(hours=25)
    assert client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth).json()["status"] == "PENDING"


def test_every_webhook_call_is_kept_in_the_inbound_log(client, monkeypatch, db):
    from sqlalchemy import text

    monkeypatch.setattr(wa_router, "MSG91_INBOUND_SECRET", "s3cret")
    client.post(f"{API}/whatsapp/inbound?token=wrong", json={"customerNumber": "919876543210", "text": "YES"})
    client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customerNumber": "919876543210", "text": "hello"})
    rows = db.execute(text("SELECT token_ok, summary, payload FROM whatsapp_inbound_log ORDER BY received_at")).all()
    assert [r.token_ok for r in rows] == [False, True]
    assert "wrong token" in rows[0].summary and "not YES or STOP" in rows[1].summary
    assert "9876543210" not in rows[1].payload and "3210" in rows[1].payload  # numbers masked


def test_stop_then_yes_again_still_gets_the_due_reminder(client, auth, monkeypatch, db):
    """YES, then STOP just as a reminder comes due, then YES again: nothing is
    sent while stopped, and the reminder goes out once they're back (within 5
    minutes). One that stays stopped is dropped, never sent."""
    from sqlalchemy import text
    from sqlalchemy.orm import sessionmaker

    from app.workers import reminder_worker as worker

    monkeypatch.setattr(wa, "is_configured", lambda: True)
    monkeypatch.setattr(wa, "send_whatsapp_reminder", lambda phone, variables: True)
    monkeypatch.setattr(wa_router, "MSG91_INBOUND_SECRET", "s3cret")
    sent = []
    monkeypatch.setattr(worker, "is_configured", lambda: True)
    monkeypatch.setattr(worker, "send_whatsapp_reminder", lambda phone, variables: sent.append(phone) or True)
    monkeypatch.setattr(worker, "SessionLocal", sessionmaker(bind=db.get_bind()))

    client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth)
    assert _inbound(client, "919876543210", "YES") == ["verified"]
    rid = _reminder(client, auth).json()["id"]
    db.execute(text("UPDATE reminders SET remind_at = now() - interval '20 seconds' WHERE id = :id"), {"id": rid})
    db.commit()

    assert _inbound(client, "919876543210", "STOP") == ["stopped"]
    worker._poll_due_reminders()
    assert sent == []
    assert db.execute(text("SELECT whatsapp_status FROM reminders WHERE id = :id"), {"id": rid}).scalar() == "PENDING"

    assert _inbound(client, "919876543210", "YES") == ["verified"]
    worker._poll_due_reminders()
    worker._poll_due_reminders()
    assert sent == [PHONE]
    assert db.execute(text("SELECT whatsapp_status FROM reminders WHERE id = :id"), {"id": rid}).scalar() == "SENT"

    # Stopped and still stopped 5 minutes after its time: given up, never sent.
    rid = _reminder(client, auth).json()["id"]
    assert _inbound(client, "919876543210", "STOP") == ["stopped"]
    db.execute(text("UPDATE reminders SET remind_at = now() - interval '6 minutes' WHERE id = :id"), {"id": rid})
    db.commit()
    worker._poll_due_reminders()
    assert sent == [PHONE]
    assert db.execute(text("SELECT whatsapp_status FROM reminders WHERE id = :id"), {"id": rid}).scalar() == "FAILED"
