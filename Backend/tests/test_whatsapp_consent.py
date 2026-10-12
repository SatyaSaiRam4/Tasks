from datetime import datetime, timedelta, timezone

from app.modules.whatsapp import router as wa_router
from app.modules.whatsapp import service as wa

API = "/api/v1"
PHONE = "+919876543210"


def _reminder(client, auth, phone=PHONE):
    at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    return client.post(f"{API}/reminders", json={"title": "Call mom", "remind_at": at, "whatsapp_number": phone}, headers=auth)


def test_whatsapp_needs_the_owner_to_verify_and_stop_ends_it(client, auth, monkeypatch):
    monkeypatch.setattr(wa, "business_number", lambda: "919000000000")
    monkeypatch.setattr(wa_router, "MSG91_INBOUND_SECRET", "s3cret")

    # A number nobody has verified can't get reminders.
    assert _reminder(client, auth).status_code == 409

    started = client.post(f"{API}/whatsapp/verify", json={"phone": "91 98765 43210"}, headers=auth).json()
    assert started["phone"] == PHONE and started["status"] == "PENDING"
    assert started["message"] == f"MEMO {started['code']}"
    assert started["link"].startswith("https://wa.me/919000000000?text=MEMO%20")

    # Webhook needs the secret; a wrong code or another sender does nothing.
    assert client.post(f"{API}/whatsapp/inbound?token=nope", json={}).status_code == 404
    other = client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customer_number": "919111111111", "content": {"text": started["message"]}})
    assert other.json()["results"] == ["ignored: no code waiting"]
    wrong_code = "111111" if started["code"] != "111111" else "222222"
    wrong = client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customer_number": "919876543210", "content": {"text": f"MEMO {wrong_code}"}})
    assert wrong.json()["results"] == ["ignored: wrong code"]

    # The owner sends the code from that number: verified.
    ok = client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customer_number": "919876543210", "direction": "inbound", "content": {"text": started["message"]}})
    assert ok.json()["results"] == ["verified"]
    assert client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()["status"] == "VERIFIED"
    assert _reminder(client, auth).status_code == 201

    # STOP ends it; START alone doesn't bring it back.
    client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customer_number": "919876543210", "content": {"text": "stop"}})
    assert client.get(f"{API}/whatsapp/status", params={"phone": PHONE}, headers=auth).json()["status"] == "STOPPED"
    client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"customer_number": "919876543210", "content": {"text": "START"}})
    assert _reminder(client, auth).status_code == 409

    # Verifying again (a new code) brings it back.
    again = client.post(f"{API}/whatsapp/verify", json={"phone": PHONE}, headers=auth).json()
    client.post(f"{API}/whatsapp/inbound?token=s3cret", json={"from": "+919876543210", "text": again["message"]})
    assert _reminder(client, auth).status_code == 201
