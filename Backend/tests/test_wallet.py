"""The wallet: best-streak milestones unlock points once (500 at 500, 1000 at
1000); 500 points redeem for ₹10 and 1000 for ₹20; payouts are made by hand
and marked by an admin."""

from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from tests.conftest import register

API = "/api/v1"


def wallet(client, auth):
    res = client.get(f"{API}/wallet", headers=auth)
    assert res.status_code == 200, res.text
    return res.json()


def set_best_streak(client, auth, db, best, email="alex@example.com"):
    wallet(client, auth)  # creates the streak state
    db.execute(
        text("UPDATE streak_states SET best_streak = :b WHERE user_id = (SELECT id FROM users WHERE email = :e)"),
        {"b": best, "e": email},
    )
    db.commit()


def redeem(client, auth, points, **extra):
    return client.post(f"{API}/wallet/redeem", json={"phone": "9876543210", "points": points, **extra}, headers=auth)


def make_admin(client, db, email="boss@example.com"):
    headers, _ = register(client, email=email, name="Boss")
    db.execute(text("UPDATE users SET role = 'ADMIN' WHERE email = :e"), {"e": email})
    db.commit()
    return headers


def test_new_wallet_is_empty(client, auth):
    w = wallet(client, auth)
    assert (w["balance"], w["points_available"]) == (0, 0)
    assert [(m["days"], m["points"], m["amount"]) for m in w["milestones"]] == [(500, 500, 10), (1000, 1000, 20)]
    assert [(c["points"], c["amount"], c["available"]) for c in w["choices"]] == [(500, 10, False), (1000, 20, False)]
    assert redeem(client, auth, 500).status_code == 409


def test_500_points_for_10_rupees(client, auth, db):
    set_best_streak(client, auth, db, 500)
    w = wallet(client, auth)
    assert (w["points_available"], w["balance"]) == (500, 10)

    res = redeem(client, auth, 500)
    assert res.status_code == 201, res.text
    body = res.json()
    assert (body["points"], body["amount"], body["status"], body["phone"]) == (500, 10, "PENDING", "+919876543210")
    w = wallet(client, auth)
    assert (w["points_available"], w["points_redeemed"], w["balance"]) == (0, 500, 0)
    # The milestone pays once: nothing more until 1000.
    assert redeem(client, auth, 500).status_code == 409


def test_1000_points_for_20_rupees(client, auth, db):
    set_best_streak(client, auth, db, 1000)
    assert wallet(client, auth)["points_available"] == 1500  # both milestones
    res = redeem(client, auth, 1000)
    assert res.status_code == 201 and (res.json()["points"], res.json()["amount"]) == (1000, 20)
    assert redeem(client, auth, 500).status_code == 201
    w = wallet(client, auth)
    assert (w["points_available"], w["earned"], w["redeemed"]) == (0, 30, 30)


def test_not_enough_points_and_no_negative_balance(client, auth, db):
    set_best_streak(client, auth, db, 500)
    too_much = redeem(client, auth, 1000)
    assert too_much.status_code == 409 and "500 points" in too_much.json()["error"]["message"]
    # Only the fixed choices: no other amounts, no negative or odd points.
    for bad in (1, 250, 501, -500, 0):
        assert redeem(client, auth, bad).status_code == 422
    assert client.post(f"{API}/wallet/redeem", json={"phone": "9876543210", "amount": 12}, headers=auth).status_code == 422
    assert wallet(client, auth)["points_available"] == 500


def test_older_apps_choose_by_rupees(client, auth, db):
    set_best_streak(client, auth, db, 500)
    res = client.post(f"{API}/wallet/redeem", json={"phone": "9876543210", "amount": 10}, headers=auth)
    assert res.status_code == 201 and res.json()["points"] == 500


def test_redeem_rejects_bad_numbers(client, auth, db):
    set_best_streak(client, auth, db, 500)
    assert client.post(f"{API}/wallet/redeem", json={"phone": "12", "points": 500}, headers=auth).status_code == 422


def test_a_repeated_request_returns_the_first_redemption(client, auth, db):
    set_best_streak(client, auth, db, 1000)
    first = redeem(client, auth, 500, request_id="tap-123456")
    again = redeem(client, auth, 500, request_id="tap-123456")
    assert first.status_code == 201 and again.status_code == 200
    assert first.json()["id"] == again.json()["id"]
    assert wallet(client, auth)["points_available"] == 1000
    assert len(client.get(f"{API}/wallet/redemptions", headers=auth).json()) == 1


def test_two_requests_at_once_cant_spend_the_same_points(client, auth, db):
    set_best_streak(client, auth, db, 500)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda i: TestClient(app).post(
            f"{API}/wallet/redeem", json={"phone": "9876543210", "points": 500, "request_id": f"tap-{i:08d}"}, headers=auth
        ).status_code, range(4)))
    assert sorted(results) == [201, 409, 409, 409]
    assert wallet(client, auth)["points_available"] == 0
    total = db.execute(text("SELECT COALESCE(SUM(points), 0) FROM wallet_redemptions")).scalar()
    assert total == 500


def test_redeeming_keeps_best_streak_badges_and_milestones(client, auth, db):
    set_best_streak(client, auth, db, 1000)
    client.patch(f"{API}/users/me/settings", json={"badge_seen": 2}, headers=auth)
    before = db.execute(text("SELECT best_streak, current_streak FROM streak_states")).one()
    badge_before = db.execute(text("SELECT badge_seen FROM user_settings")).scalar()
    redeem(client, auth, 1000)
    redeem(client, auth, 500)
    db.expire_all()
    assert db.execute(text("SELECT best_streak, current_streak FROM streak_states")).one() == before
    assert db.execute(text("SELECT badge_seen FROM user_settings")).scalar() == badge_before
    w = wallet(client, auth)
    assert w["best_streak"] == 1000 and all(m["reached"] for m in w["milestones"])


def test_users_only_see_their_own_wallet(client, auth, db):
    set_best_streak(client, auth, db, 500)
    redeem(client, auth, 500)
    other, _ = register(client, email="sam@example.com", name="Sam")
    assert client.get(f"{API}/wallet/redemptions", headers=other).json() == []
    assert wallet(client, other)["points_redeemed"] == 0
    # Ordinary users can't reach payouts.
    assert client.get(f"{API}/admin/redemptions", headers=auth).status_code == 403
    rid = client.get(f"{API}/wallet/redemptions", headers=auth).json()[0]["id"]
    assert client.post(f"{API}/admin/redemptions/{rid}/paid", json={"reference": "UPI123"}, headers=auth).status_code == 403


def test_admin_marks_a_payout_paid_once_and_rejecting_gives_points_back(client, auth, db):
    set_best_streak(client, auth, db, 1000)
    a = redeem(client, auth, 500).json()["id"]
    b = redeem(client, auth, 1000).json()["id"]
    admin = make_admin(client, db)

    pending = client.get(f"{API}/admin/redemptions", params={"status": "PENDING"}, headers=admin).json()
    assert {r["id"] for r in pending} == {a, b} and pending[0]["user_email"] == "alex@example.com"
    # A reference is required: it's marked only once the money has really gone.
    assert client.post(f"{API}/admin/redemptions/{a}/paid", json={"reference": ""}, headers=admin).status_code == 422
    paid = client.post(f"{API}/admin/redemptions/{a}/paid", json={"reference": "UPI-4471"}, headers=admin)
    assert paid.status_code == 200, paid.text
    p = paid.json()
    assert (p["status"], p["payout_reference"], p["decided_by_email"]) == ("PAID", "UPI-4471", "boss@example.com")
    assert p["decided_at"]
    # Decided once: can't be paid again or rejected afterwards.
    assert client.post(f"{API}/admin/redemptions/{a}/paid", json={"reference": "UPI-9"}, headers=admin).status_code == 409
    assert client.post(f"{API}/admin/redemptions/{a}/reject", json={"note": "oops"}, headers=admin).status_code == 409

    rejected = client.post(f"{API}/admin/redemptions/{b}/reject", json={"note": "Wrong number"}, headers=admin)
    assert rejected.json()["status"] == "REJECTED"
    w = wallet(client, auth)
    assert w["points_available"] == 1000  # the rejected 1000 came back
    mine = client.get(f"{API}/wallet/redemptions", headers=auth).json()
    assert {r["status"] for r in mine} == {"PAID", "REJECTED"}
