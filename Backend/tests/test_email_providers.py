import httpx
import pytest

from app.integrations import email


class FakeResponse:
    def __init__(self, status, body):
        self.status_code = status
        self.is_success = 200 <= status < 300
        self._body = body
        self.text = str(body)
        self.request = httpx.Request("POST", "https://api.brevo.com/v3/smtp/email")

    def json(self):
        return self._body


@pytest.fixture
def brevo(monkeypatch):
    monkeypatch.setattr(email, "BREVO_API_KEY", "test-key")
    monkeypatch.setattr(email, "EMAIL_FROM", "memo.sender@gmail.com")
    monkeypatch.setattr(email, "EMAIL_PROVIDER", "auto")
    class Calls(list):
        reply = FakeResponse(201, {"messageId": "x"})

    calls = Calls()

    def post(url, headers, json, timeout):
        calls.append((url, headers, json))
        return calls.reply

    monkeypatch.setattr(email.httpx, "post", post)
    return calls


def test_brevo_sends_over_https_from_the_verified_sender(brevo):
    email.send_email("user@gmail.com", "Your Memo verification code", "Code 123456")
    url, headers, body = brevo[0]
    assert url == "https://api.brevo.com/v3/smtp/email"
    assert headers["api-key"] == "test-key"
    assert body["sender"]["email"] == "memo.sender@gmail.com"
    assert body["to"] == [{"email": "user@gmail.com"}]
    assert "123456" in body["textContent"]


def test_brevo_refusal_becomes_a_clear_failure(brevo):
    brevo.reply = FakeResponse(400, {"message": "Sender is not valid"})
    with pytest.raises(email.EmailSendFailed, match="Sender is not valid"):
        email.send_email("user@gmail.com", "Subject", "Text")
