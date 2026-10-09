from sqlalchemy import text

API = "/api/v1"


def wallet(client, auth):
    res = client.get(f"{API}/wallet", headers=auth)
    assert res.status_code == 200, res.text
    return res.json()


def set_best_streak(client, auth, db, best):
    wallet(client, auth)  # creates the streak state
    db.execute(text("UPDATE streak_states SET best_streak = :b"), {"b": best})
    db.commit()


def test_new_wallet_is_empty(client, auth):
    w = wallet(client, auth)
    assert w["balance"] == 0
    assert [m["amount"] for m in w["milestones"]] == [10, 20]
    assert client.post(f"{API}/wallet/redeem", json={"phone": "9876543210"}, headers=auth).status_code == 409


def test_milestones_pay_once(client, auth, db):
    set_best_streak(client, auth, db, 500)
    assert wallet(client, auth)["balance"] == 10

    res = client.post(f"{API}/wallet/redeem", json={"phone": "98765 43210"}, headers=auth)
    assert res.status_code == 201, res.text
    assert res.json()["amount"] == 10
    assert res.json()["phone"] == "+919876543210"
    assert wallet(client, auth)["balance"] == 0
    assert client.post(f"{API}/wallet/redeem", json={"phone": "9876543210"}, headers=auth).status_code == 409

    set_best_streak(client, auth, db, 1000)
    w = wallet(client, auth)
    assert (w["earned"], w["redeemed"], w["balance"]) == (30, 10, 20)


def test_redeem_rejects_bad_numbers(client, auth, db):
    set_best_streak(client, auth, db, 500)
    assert client.post(f"{API}/wallet/redeem", json={"phone": "12"}, headers=auth).status_code == 422


def test_redeem_part_of_the_balance(client, auth, db):
    set_best_streak(client, auth, db, 1000)
    res = client.post(f"{API}/wallet/redeem", json={"phone": "9876543210", "amount": 12}, headers=auth)
    assert res.status_code == 201, res.text
    assert res.json()["amount"] == 12
    assert wallet(client, auth)["balance"] == 18
    too_much = client.post(f"{API}/wallet/redeem", json={"phone": "9876543210", "amount": 19}, headers=auth)
    assert too_much.status_code == 409
