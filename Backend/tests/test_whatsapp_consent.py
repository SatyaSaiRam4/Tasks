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
    assert len(sent) == 1 and sent[0][0] == PHONE and "Reply YES" in sent[0][1][0]
    # Saved while waiting, but nothing goes out until they reply YES.
    assert _reminder(client, auth).status_code == 201
    assert client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()["status"] == "PENDING"
    # Asking again within a few minutes doesn't message them again.
    client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth)
    assert len(sent) == 1

    # The webhook needs the secret; other replies change nothing.
    assert client.post(f"{API}/whatsapp/inbound?token=nope", json={}).status_code == 404
    assert _inbound(client, "919876543210", "who is this?") == ["ignored: not YES or STOP"]

    # The owner replies YES: verified.
    assert _inbound(client, "919876543210", "Yes!") == ["verified"]
    assert client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()["status"] == "VERIFIED"
    assert _reminder(client, auth).status_code == 201

    # STOP ends it, and nobody can ask that number again.
    assert _inbound(client, "919876543210", "STOP") == ["stopped"]
    assert _reminder(client, auth).status_code == 409
    again = client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth).json()
    assert again["status"] == "STOPPED" and len(sent) == 1

    # Only the owner can turn it back on, by sending YES themselves.
    assert _inbound(client, "+91 98765 43210", "yes") == ["verified"]
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
