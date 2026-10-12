from tests.conftest import OUTBOX, last_code

API = "/api/v1/auth"
NEW = {"email": "new@example.com", "password": "password123", "display_name": "New"}


def sign_up(client, **extra):
    res = client.post(f"{API}/register", json={**NEW, **extra})
    assert res.status_code == 201, res.text
    return res.json()


def test_sign_up_sends_a_code_and_no_tokens(client):
    body = sign_up(client)
    assert body == {"verification_required": True, "email": "new@example.com"}
    assert "access_token" not in body
    assert OUTBOX and OUTBOX[-1][0] == "new@example.com"


def test_unverified_login_asks_for_the_code(client):
    sign_up(client)
    res = client.post(f"{API}/login", json={"email": NEW["email"], "password": NEW["password"]})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "EMAILNOTVERIFIED"
    # A wrong password never reveals that the account is unverified.
    res = client.post(f"{API}/login", json={"email": NEW["email"], "password": "wrong-password"})
    assert res.status_code == 401


def test_the_right_code_signs_in_and_then_login_works(client):
    sign_up(client)
    assert client.post(f"{API}/verify-email", json={"email": NEW["email"], "code": "000000"}).status_code == 400
    res = client.post(f"{API}/verify-email", json={"email": NEW["email"], "code": last_code(NEW["email"])})
    assert res.status_code == 200 and res.json()["access_token"]
    res = client.post(f"{API}/login", json={"email": NEW["email"], "password": NEW["password"]})
    assert res.status_code == 200


def test_codes_expire_and_resends_replace_them(client, clock):
    sign_up(client)
    first = last_code(NEW["email"])
    clock.advance(minutes=11)
    assert client.post(f"{API}/verify-email", json={"email": NEW["email"], "code": first}).status_code == 400
    assert client.post(f"{API}/resend-code", json={"email": NEW["email"]}).status_code == 202
    second = last_code(NEW["email"])
    assert client.post(f"{API}/verify-email", json={"email": NEW["email"], "code": second}).status_code == 200


def test_too_many_wrong_codes_lock_the_code(client):
    sign_up(client)
    code = last_code(NEW["email"])
    for _ in range(5):
        client.post(f"{API}/verify-email", json={"email": NEW["email"], "code": "123456" if code != "123456" else "654321"})
    assert client.post(f"{API}/verify-email", json={"email": NEW["email"], "code": code}).status_code == 400


def test_resend_has_a_cooldown(client):
    sign_up(client)
    sent = len(OUTBOX)
    client.post(f"{API}/resend-code", json={"email": NEW["email"]})
    assert len(OUTBOX) == sent  # within a minute of the first code: nothing new


def test_unverified_email_can_be_signed_up_again(client):
    sign_up(client)
    sign_up(client, display_name="Fixed Name", password="another-pass1")
    res = client.post(f"{API}/verify-email", json={"email": NEW["email"], "code": last_code(NEW["email"])})
    assert res.json()["user"]["display_name"] == "Fixed Name"


def test_verified_email_cannot_be_taken(client, auth):
    res = client.post(f"{API}/register", json={**NEW, "email": "alex@example.com"})
    assert res.status_code == 409
