"""The WhatsApp plan: 3 free reminders per account, then ₹30 for 100 over 30
days, paid with Razorpay (mocked here: no real payments or messages)."""

import hashlib
import hmac
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.core import config
from app.integrations import msg91, razorpay
from app.modules.subscriptions import service as plans
from app.workers import reminder_worker as worker
from tests.conftest import register

API = "/api/v1"
SECRET = "test_key_secret_for_tests_only"
HOOK = "test_webhook_secret_for_tests_only"
ALEX_PHONE = "+919876543210"
OTHER_PHONE = "+919811112222"


# ------------------------------------------------------------------ helpers


@pytest.fixture
def payments(monkeypatch):
    """Razorpay in test mode, with its API replaced by a fake that remembers orders and payments."""
    monkeypatch.setattr(config, "RAZORPAY_KEY_ID", "rzp_test_FAKEKEY123")
    monkeypatch.setattr(config, "RAZORPAY_KEY_SECRET", SECRET)
    monkeypatch.setattr(config, "RAZORPAY_WEBHOOK_SECRET", HOOK)
    monkeypatch.setattr(config, "RAZORPAY_MODE", "test")
    fake = {"orders": [], "payments": {}}

    def create_order(amount, receipt, notes):
        order = {"id": f"order_T{len(fake['orders']) + 1:05d}", "amount": amount, "currency": "INR", "receipt": receipt}
        fake["orders"].append(order)
        return order

    monkeypatch.setattr(razorpay, "create_order", create_order)
    monkeypatch.setattr(razorpay, "fetch_payment", lambda pid: fake["payments"][pid])
    monkeypatch.setattr(razorpay, "fetch_order_payments", lambda oid: [p for p in fake["payments"].values() if p["order_id"] == oid])
    return fake


def pay(fake, order_id, payment_id="pay_T00001", status="captured", amount=3000):
    fake["payments"][payment_id] = {"id": payment_id, "order_id": order_id, "amount": amount, "currency": "INR", "status": status,
                                    "error_description": "Card declined" if status == "failed" else None}
    return payment_id


def sign(order_id, payment_id, secret=SECRET):
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def buy(client, auth, fake, payment_id="pay_T00001"):
    order = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth)
    assert order.status_code == 200, order.text
    oid = order.json()["order_id"]
    pay(fake, oid, payment_id)
    res = client.post(f"{API}/subscriptions/whatsapp/verify", headers=auth, json={
        "razorpay_order_id": oid, "razorpay_payment_id": payment_id, "razorpay_signature": sign(oid, payment_id)})
    assert res.status_code == 200, res.text
    return oid, res.json()


def status(client, auth):
    res = client.get(f"{API}/subscriptions/whatsapp", headers=auth)
    assert res.status_code == 200, res.text
    return res.json()


def webhook(client, body: dict, event_id="evt_1", secret=HOOK):
    raw = json.dumps(body).encode()
    sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return client.post(f"{API}/payments/razorpay/webhook", content=raw,
                       headers={"x-razorpay-signature": sig, "x-razorpay-event-id": event_id, "content-type": "application/json"})


def allow(db, *phones):
    """These numbers said YES."""
    for phone in phones:
        db.execute(text("INSERT INTO whatsapp_contacts (phone, status, refusals, created_at, updated_at) "
                        "VALUES (:p, 'VERIFIED', 0, now(), now()) ON CONFLICT (phone) DO UPDATE SET status = 'VERIFIED'"), {"p": phone})
    db.commit()


def reminder(client, auth, phone=ALEX_PHONE):
    at = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    return client.post(f"{API}/reminders", json={"title": "Call mom", "remind_at": at, "whatsapp_number": phone}, headers=auth)


def make_due(db, rid):
    db.execute(text("UPDATE reminders SET remind_at = now() - interval '10 seconds' WHERE id = :id"), {"id": rid})
    db.commit()


@pytest.fixture
def run_worker(monkeypatch, db):
    """Runs the reminder worker against the test database; sends are recorded, not made."""
    sent = []
    outcome = {"next": msg91.ACCEPTED}
    monkeypatch.setattr(worker, "SessionLocal", sessionmaker(bind=db.get_bind()))
    monkeypatch.setattr(worker, "is_configured", lambda: True)

    def send_template(phone, variables):
        sent.append(phone)
        return outcome["next"]

    monkeypatch.setattr(worker, "send_template", send_template)

    def run():
        worker._poll_due_reminders()
        db.expire_all()

    run.sent = sent
    run.outcome = outcome
    return run


def usage_rows(db):
    return db.execute(text("SELECT source, status, counted FROM whatsapp_usage ORDER BY created_at")).all()


def wa_status(db, rid):
    return db.execute(text("SELECT whatsapp_status FROM reminders WHERE id = :id"), {"id": rid}).scalar()


# ----------------------------------------------------------- free allowance


def test_three_free_messages_then_a_plan_is_needed(client, auth, db, run_worker):
    allow(db, ALEX_PHONE)
    assert status(client, auth)["free_remaining"] == 3
    for _ in range(3):
        rid = reminder(client, auth).json()["id"]
        make_due(db, rid)
        run_worker()
        assert wa_status(db, rid) == "SENT"
    assert run_worker.sent == [ALEX_PHONE] * 3
    s = status(client, auth)
    assert (s["free_used"], s["free_remaining"], s["purchase_required"], s["plan_status"]) == (3, 0, True, "NONE")

    # The 4th: saving a WhatsApp reminder is refused with a clear reason.
    fourth = reminder(client, auth)
    assert fourth.status_code == 402
    assert fourth.json()["error"]["code"] == "SUBSCRIPTIONREQUIRED"
    assert "₹30" in fourth.json()["error"]["message"] and "100" in fourth.json()["error"]["message"]
    # Reminders without WhatsApp, alarms and notifications are never affected.
    at = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    assert client.post(f"{API}/reminders", json={"title": "Plain", "remind_at": at, "alarm_enabled": True}, headers=auth).status_code == 201


def test_a_scheduled_fourth_is_not_sent_without_a_plan(client, auth, db, run_worker):
    allow(db, ALEX_PHONE)
    ids = [reminder(client, auth).json()["id"] for _ in range(4)]  # all saved while free ones remained
    for rid in ids:
        make_due(db, rid)
    run_worker()
    assert len(run_worker.sent) == 3
    assert sorted(wa_status(db, rid) for rid in ids) == ["FAILED", "SENT", "SENT", "SENT"]
    assert sorted(r.source for r in usage_rows(db)) == ["FREE", "FREE", "FREE", "NONE"]


def test_the_free_messages_belong_to_the_account_not_the_number(client, auth, db, run_worker):
    allow(db, ALEX_PHONE, OTHER_PHONE)
    for phone in (ALEX_PHONE, OTHER_PHONE, ALEX_PHONE):
        rid = reminder(client, auth, phone).json()["id"]
        make_due(db, rid)
        run_worker()
    assert reminder(client, auth, OTHER_PHONE).status_code == 402  # a new number gives nothing more
    # Another account has its own 3.
    other, _ = register(client, email="sam@example.com", name="Sam")
    assert status(client, other)["free_remaining"] == 3


def test_consent_comes_first_even_with_a_plan(client, auth, db, run_worker, payments):
    buy(client, auth, payments)
    allow(db, ALEX_PHONE)
    rid = reminder(client, auth).json()["id"]
    db.execute(text("UPDATE whatsapp_contacts SET status = 'STOPPED', stopped_at = now()"))
    db.commit()
    db.execute(text("UPDATE reminders SET remind_at = now() - interval '10 minutes' WHERE id = :id"), {"id": rid})
    db.commit()
    run_worker()
    assert run_worker.sent == [] and wa_status(db, rid) == "FAILED"
    assert usage_rows(db) == []  # nothing used
    # And a plan can't be used to add a number that never said YES.
    assert reminder(client, auth, "+919800000001").status_code == 409


# ------------------------------------------------------------ usage ledger


def test_a_refused_send_is_given_back_an_unanswered_one_is_not_and_never_resent(client, auth, db, run_worker):
    allow(db, ALEX_PHONE)
    refused = reminder(client, auth).json()["id"]
    make_due(db, refused)
    run_worker.outcome["next"] = msg91.REJECTED
    run_worker()
    assert usage_rows(db)[-1] == ("FREE", "REJECTED", False)
    assert status(client, auth)["free_used"] == 0  # MSG91 refused it: not charged

    unclear = reminder(client, auth).json()["id"]
    make_due(db, unclear)
    run_worker.outcome["next"] = msg91.UNKNOWN
    run_worker()
    assert usage_rows(db)[-1] == ("FREE", "UNKNOWN", True)
    assert status(client, auth)["free_used"] == 1  # may have gone out: counted

    # The worker is retried for the same occurrence (e.g. it crashed before
    # recording the result): it doesn't send again or count again.
    db.execute(text("UPDATE reminders SET whatsapp_status = 'PENDING' WHERE id = :id"), {"id": unclear})
    db.commit()
    sends = len(run_worker.sent)
    run_worker()
    assert len(run_worker.sent) == sends
    assert status(client, auth)["free_used"] == 1
    assert db.execute(text("SELECT count(*) FROM whatsapp_usage")).scalar() == 2


def test_two_workers_at_once_count_one_message(client, auth, db):
    allow(db, ALEX_PHONE)
    rid = reminder(client, auth).json()["id"]
    make_due(db, rid)
    Session = sessionmaker(bind=db.get_bind())

    def take(_):
        s = Session()
        try:
            from app.modules.reminders.models import Reminder

            _row, retried = plans.reserve(s, s.get(Reminder, rid))
            return retried
        finally:
            s.close()

    with ThreadPoolExecutor(max_workers=4) as pool:
        retried = list(pool.map(take, range(4)))
    assert retried.count(False) == 1
    assert db.execute(text("SELECT count(*) FROM whatsapp_usage")).scalar() == 1


def test_the_last_free_message_goes_to_one_reminder_only(client, auth, db):
    allow(db, ALEX_PHONE)
    ids = [reminder(client, auth).json()["id"] for _ in range(3)]
    db.execute(text("INSERT INTO whatsapp_usage (id, user_id, source, idempotency_key, status, counted, created_at, updated_at) "
                    "SELECT gen_random_uuid(), id, 'FREE', 'seed-' || g, 'ACCEPTED', true, now(), now() FROM users, generate_series(1, 2) g"))
    db.commit()
    Session = sessionmaker(bind=db.get_bind())

    def take(rid):
        s = Session()
        try:
            from app.modules.reminders.models import Reminder

            row, _ = plans.reserve(s, s.get(Reminder, rid))
            return row.source
        finally:
            s.close()

    with ThreadPoolExecutor(max_workers=3) as pool:
        sources = list(pool.map(take, ids))
    assert sorted(sources) == ["FREE", "NONE", "NONE"]


# ---------------------------------------------------------------- payments


def test_payments_are_off_without_credentials(client, auth, monkeypatch):
    monkeypatch.setattr(config, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(config, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.setattr(config, "RAZORPAY_WEBHOOK_SECRET", "")
    assert status(client, auth)["payments_enabled"] is False
    assert client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).status_code == 503
    assert client.post(f"{API}/payments/razorpay/webhook", content=b"{}").status_code == 503
    # Live keys while RAZORPAY_MODE=test (or the other way round) are refused too.
    monkeypatch.setattr(config, "RAZORPAY_KEY_ID", "rzp_live_SOMETHING")
    monkeypatch.setattr(config, "RAZORPAY_KEY_SECRET", "x")
    monkeypatch.setattr(config, "RAZORPAY_MODE", "test")
    assert razorpay.is_configured() is False and "doesn't match" in razorpay.why_off()


def test_an_order_uses_the_servers_price_and_is_reused_while_open(client, auth, payments):
    first = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth, json={"amount_paise": 1}).json()
    assert (first["amount_paise"], first["currency"], first["key_id"], first["mode"]) == (3000, "INR", "rzp_test_FAKEKEY123", "test")
    assert SECRET not in json.dumps(first)
    again = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).json()
    assert again["order_id"] == first["order_id"] and len(payments["orders"]) == 1
    assert status(client, auth)["pending_order_id"] == first["order_id"]


def test_a_forged_success_grants_nothing(client, auth, payments, clock):
    """No payment on Razorpay: a made-up payment id with a forged signature is refused, and
    the server's own check with Razorpay finds nothing to grant."""
    oid = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).json()["order_id"]
    res = client.post(f"{API}/subscriptions/whatsapp/verify", headers=auth, json={
        "razorpay_order_id": oid, "razorpay_payment_id": "pay_FAKE01", "razorpay_signature": sign(oid, "pay_FAKE01", "wrong")})
    assert res.status_code == 400
    clock.advance(seconds=30)
    assert status(client, auth)["plan_status"] == "NONE"


def test_a_verified_payment_grants_100_messages_for_30_days_once(client, auth, payments, clock):
    oid, res = buy(client, auth, payments)
    assert res["state"] == "PAID"
    plan = res["plan"]
    assert (plan["plan_status"], plan["paid_remaining"], plan["purchase_required"]) == ("ACTIVE", 100, False)
    starts = datetime.fromisoformat(plan["plan_starts_at"])
    assert datetime.fromisoformat(plan["plan_expires_at"]) - starts == timedelta(days=30)
    assert starts == clock.now  # from the server's confirmation, not anything the app sent
    # The same verification again: same answer, still one plan.
    again = client.post(f"{API}/subscriptions/whatsapp/verify", headers=auth, json={
        "razorpay_order_id": oid, "razorpay_payment_id": "pay_T00001", "razorpay_signature": sign(oid, "pay_T00001")})
    assert again.json()["state"] == "PAID" and again.json()["plan"]["paid_remaining"] == 100


def test_the_app_saying_success_isnt_enough(client, auth, payments, clock):
    """A correctly signed callback for a payment Razorpay hasn't captured grants nothing yet."""
    oid = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).json()["order_id"]
    pay(payments, oid, status="authorized")
    res = client.post(f"{API}/subscriptions/whatsapp/verify", headers=auth, json={
        "razorpay_order_id": oid, "razorpay_payment_id": "pay_T00001", "razorpay_signature": sign(oid, "pay_T00001")})
    assert res.json()["state"] == "PENDING" and res.json()["plan"]["plan_status"] == "NONE"
    # Razorpay captures it later; the next status check confirms it on the server.
    payments["payments"]["pay_T00001"]["status"] = "captured"
    clock.advance(seconds=30)  # the server asks Razorpay again at most every 20 s
    assert status(client, auth)["plan_status"] == "ACTIVE"


def test_a_wrong_amount_is_never_accepted(client, auth, payments):
    oid = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).json()["order_id"]
    pay(payments, oid, amount=100)
    res = client.post(f"{API}/subscriptions/whatsapp/verify", headers=auth, json={
        "razorpay_order_id": oid, "razorpay_payment_id": "pay_T00001", "razorpay_signature": sign(oid, "pay_T00001")})
    assert res.json()["state"] == "MISMATCH" and res.json()["plan"]["plan_status"] == "NONE"


def test_webhooks_are_signed_and_processed_once(client, auth, payments, db):
    oid = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).json()["order_id"]
    payment = {"id": "pay_W1", "order_id": oid, "amount": 3000, "currency": "INR", "status": "captured"}
    body = {"event": "payment.captured", "payload": {"payment": {"entity": payment}}}
    assert webhook(client, body, secret="not-the-secret").status_code == 400
    assert status(client, auth)["plan_status"] == "NONE"
    assert webhook(client, body, "evt_A").json()["result"] == "PAID"
    assert webhook(client, body, "evt_A").json()["result"] == "duplicate"
    # The same payment in another event (order.paid) changes nothing either.
    assert webhook(client, {"event": "order.paid", "payload": {"payment": {"entity": payment}, "order": {"entity": {"id": oid}}}}, "evt_B").json()["result"] == "PAID"
    assert db.execute(text("SELECT count(*) FROM whatsapp_plans")).scalar() == 1
    assert status(client, auth)["paid_remaining"] == 100


def test_a_failed_payment_then_a_retry_in_the_same_checkout(client, auth, payments):
    oid = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).json()["order_id"]
    failed = {"id": "pay_F1", "order_id": oid, "amount": 3000, "currency": "INR", "status": "failed", "error_description": "Card declined"}
    assert webhook(client, {"event": "payment.failed", "payload": {"payment": {"entity": failed}}}, "evt_F").json()["result"] == "FAILED"
    assert status(client, auth)["plan_status"] == "NONE"
    ok = {"id": "pay_F2", "order_id": oid, "amount": 3000, "currency": "INR", "status": "captured"}
    assert webhook(client, {"event": "payment.captured", "payload": {"payment": {"entity": ok}}}, "evt_G").json()["result"] == "PAID"
    assert status(client, auth)["plan_status"] == "ACTIVE"


def test_plan_messages_count_down_and_the_plan_expires(client, auth, db, payments, run_worker, clock):
    buy(client, auth, payments)
    allow(db, ALEX_PHONE)
    for _ in range(5):  # 3 free first, then 2 from the plan
        rid = reminder(client, auth).json()["id"]
        make_due(db, rid)
        run_worker()
    s = status(client, auth)
    assert (s["free_remaining"], s["paid_remaining"], s["plan_messages_used"]) == (0, 98, 2)
    clock.advance(days=31)
    s = status(client, auth)
    assert (s["plan_status"], s["paid_remaining"], s["purchase_required"]) == ("EXPIRED", 0, True)
    assert reminder(client, auth).status_code == 402


def test_renewing_carries_unused_messages_into_one_new_period(client, auth, db, payments, run_worker, clock):
    buy(client, auth, payments, "pay_R1")
    db.execute(text("UPDATE whatsapp_plans SET messages_used = 10"))
    db.commit()
    clock.advance(days=10)
    _, res = buy(client, auth, payments, "pay_R2")
    plan = res["plan"]
    assert (plan["paid_remaining"], plan["plan_messages_total"], plan["plan_messages_used"]) == (190, 190, 0)
    assert datetime.fromisoformat(plan["plan_starts_at"]) == clock.now
    assert datetime.fromisoformat(plan["plan_expires_at"]) == clock.now + timedelta(days=30)
    assert db.execute(text("SELECT count(*) FROM whatsapp_plans WHERE ended_at IS NULL")).scalar() == 1
    # Renewing after expiry carries nothing.
    clock.advance(days=40)
    _, res = buy(client, auth, payments, "pay_R3")
    assert res["plan"]["paid_remaining"] == 100


def test_users_cant_touch_each_others_payments(client, auth, payments):
    oid = client.post(f"{API}/subscriptions/whatsapp/order", headers=auth).json()["order_id"]
    pay(payments, oid)
    other, _ = register(client, email="sam@example.com", name="Sam")
    res = client.post(f"{API}/subscriptions/whatsapp/verify", headers=other, json={
        "razorpay_order_id": oid, "razorpay_payment_id": "pay_T00001", "razorpay_signature": sign(oid, "pay_T00001")})
    assert res.status_code == 404
    assert status(client, other)["plan_status"] == "NONE"
    assert client.get(f"{API}/admin/payments", headers=other).status_code == 403
    assert client.get(f"{API}/subscriptions/whatsapp").status_code == 401


def test_admins_see_payments_and_plans(client, auth, payments, db):
    buy(client, auth, payments)
    boss, _ = register(client, email="boss@example.com", name="Boss")
    db.execute(text("UPDATE users SET role = 'ADMIN' WHERE email = 'boss@example.com'"))
    db.commit()
    paid = client.get(f"{API}/admin/payments", headers=boss).json()
    assert paid[0]["status"] == "PAID" and paid[0]["amount_paise"] == 3000 and paid[0]["user_email"] == "alex@example.com"
    assert paid[0]["provider_payment_id"] == "pay_T00001"
    plan = client.get(f"{API}/admin/whatsapp-plans", headers=boss).json()[0]
    assert (plan["messages_total"], plan["messages_used"], plan["active"]) == (100, 0, True)
