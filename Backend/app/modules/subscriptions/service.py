"""The WhatsApp plan: free allowance, paid plans, usage, and payments.

Rules (prices and allowances live here, never in a request):
  * Every Memo account gets FREE_MESSAGES (3) WhatsApp reminders free. They
    belong to the account, not to a phone number: changing the number never
    gives more.
  * After that, a plan is needed: PLAN_PRICE_PAISE (₹30) buys PLAN_MESSAGES
    (100) WhatsApp reminders for PLAN_DAYS (30) days from the moment the
    server confirms the payment.
  * Renewal is always started by the user (no automatic debits). A new plan
    starts when its payment is confirmed; the previous plan, if still running,
    ends then and its unused messages are carried into the new one. So there's
    only ever one open plan, and nothing is lost by renewing early.
  * When a message is used: when the worker is about to send a due WhatsApp
    reminder to a number that said YES, it first takes one unit (free first,
    then the plan) and records it (ATTEMPTED) before calling MSG91. If MSG91
    refuses it (nothing was sent), the unit is given back (REJECTED). If MSG91
    doesn't answer (timeout), it may have gone out: the unit stays used
    (UNKNOWN) and the reminder is not sent again. One reminder occurrence has
    one ledger row (unique key), so a retry never counts twice.
  * Consent always comes first: no plan lets Memo message a number that hasn't
    said YES, or has said STOP (the worker checks that before any of this).
  * A payment counts only once Razorpay confirms it to the server: by the
    checkout signature plus a server-side look-up of the payment, by a signed
    webhook, or by the server asking Razorpay about a recent order. The app's
    "success" alone never activates anything.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import config, timeutil
from app.integrations import msg91, razorpay
from app.modules.auth.models import User

from .models import PaymentEvent, PaymentOrder, WhatsAppPlan, WhatsAppUsage

logger = logging.getLogger("subscriptions")

FREE_MESSAGES = 3
PLAN_PRICE_PAISE = 3000  # ₹30
PLAN_MESSAGES = 100
PLAN_DAYS = 30
PURPOSE = "WHATSAPP_PLAN"
# A checkout left open this long is treated as abandoned (a new one is made).
ORDER_REUSE = timedelta(minutes=20)
ORDER_ABANDONED = timedelta(hours=24)
# How often the server may ask Razorpay about one waiting order.
RECHECK_EVERY = timedelta(seconds=20)


class SubscriptionRequired(HTTPException):
    """402 SUBSCRIPTIONREQUIRED: the free WhatsApp reminders are used and there's no plan with messages left."""

    def __init__(self) -> None:
        super().__init__(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Your {FREE_MESSAGES} free WhatsApp reminders are used. The WhatsApp plan is ₹{PLAN_PRICE_PAISE // 100} "
            f"for {PLAN_MESSAGES} WhatsApp reminders over {PLAN_DAYS} days.",
        )


def _now() -> datetime:
    return timeutil.utc_now()


def _lock_user(db: Session, user_id: uuid.UUID) -> None:
    """Serialises allowance changes for one account (two sends, or a send and a renewal)."""
    db.execute(select(User.id).where(User.id == user_id).with_for_update())


# ---------------------------------------------------------------- allowance


def free_used(db: Session, user_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(WhatsAppUsage).where(
            WhatsAppUsage.user_id == user_id, WhatsAppUsage.source == "FREE", WhatsAppUsage.counted.is_(True)
        )
    ) or 0


def open_plan(db: Session, user_id: uuid.UUID) -> WhatsAppPlan | None:
    return db.scalar(select(WhatsAppPlan).where(WhatsAppPlan.user_id == user_id, WhatsAppPlan.ended_at.is_(None)))


def _left(plan: WhatsAppPlan) -> int:
    return max(plan.messages_granted + plan.messages_carried - plan.messages_used, 0)


def _running(plan: WhatsAppPlan | None, now: datetime) -> bool:
    return bool(plan and plan.starts_at <= now < plan.expires_at)


def usable_plan(db: Session, user_id: uuid.UUID, now: datetime) -> WhatsAppPlan | None:
    plan = open_plan(db, user_id)
    return plan if _running(plan, now) and _left(plan) > 0 else None


def can_send(db: Session, user_id: uuid.UUID) -> bool:
    return free_used(db, user_id) < FREE_MESSAGES or usable_plan(db, user_id, _now()) is not None


def require_allowance(db: Session, user_id: uuid.UUID) -> None:
    """For saving a reminder with WhatsApp on: refuses with 402 when nothing is left."""
    if not can_send(db, user_id):
        raise SubscriptionRequired()


def summary(db: Session, user: User) -> dict:
    now = _now()
    reconcile_recent(db, user)
    used = min(free_used(db, user.id), FREE_MESSAGES)
    plan = open_plan(db, user.id)
    running = _running(plan, now)
    left = _left(plan) if running else 0
    if running and left > 0:
        state = "ACTIVE"
    elif running:
        state = "USED_UP"  # all messages used before the period ended
    elif plan:
        state = "EXPIRED"
    else:
        state = "NONE"
    pending = db.scalar(
        select(PaymentOrder)
        .where(PaymentOrder.user_id == user.id, PaymentOrder.purpose == PURPOSE, PaymentOrder.status == "CREATED",
               PaymentOrder.created_at > now - ORDER_ABANDONED)
        .order_by(PaymentOrder.created_at.desc())
    )
    return {
        "free_total": FREE_MESSAGES,
        "free_used": used,
        "free_remaining": FREE_MESSAGES - used,
        "plan_status": state,
        "paid_remaining": left,
        "plan_messages_total": (plan.messages_granted + plan.messages_carried) if plan else 0,
        "plan_messages_used": plan.messages_used if plan else 0,
        "plan_starts_at": plan.starts_at if plan else None,
        "plan_expires_at": plan.expires_at if plan else None,
        "purchase_required": used >= FREE_MESSAGES and left == 0,
        "payments_enabled": razorpay.is_configured(),
        "payments_mode": razorpay.mode(),
        "price_paise": PLAN_PRICE_PAISE,
        "currency": "INR",
        "plan_messages": PLAN_MESSAGES,
        "plan_days": PLAN_DAYS,
        "pending_order_id": pending.provider_order_id if pending else None,
    }


# --------------------------------------------------------------- the worker


def usage_key(reminder) -> str:
    return f"reminder:{reminder.id}:{reminder.remind_at.isoformat()}"


def reserve(db: Session, reminder) -> tuple[WhatsAppUsage, bool]:
    """Takes one unit for this reminder occurrence before it's sent. Returns
    (ledger row, already_existed). An existing row means an earlier try got
    this far (a retry): the caller must not send again. A BLOCKED row means
    nothing is left: don't send."""
    key = usage_key(reminder)
    existing = db.scalar(select(WhatsAppUsage).where(WhatsAppUsage.idempotency_key == key))
    if existing:
        return existing, True
    _lock_user(db, reminder.user_id)
    now = _now()
    if free_used(db, reminder.user_id) < FREE_MESSAGES:
        source, plan, counted, state = "FREE", None, True, "ATTEMPTED"
    else:
        plan = usable_plan(db, reminder.user_id, now)
        if plan is not None:
            db.execute(select(WhatsAppPlan.id).where(WhatsAppPlan.id == plan.id).with_for_update())
            plan.messages_used += 1
            source, counted, state = "PLAN", True, "ATTEMPTED"
        else:
            source, counted, state = "NONE", False, "BLOCKED"
    row = WhatsAppUsage(
        user_id=reminder.user_id,
        reminder_id=reminder.id,
        plan_id=plan.id if plan else None,
        source=source,
        idempotency_key=key,
        scheduled_for=reminder.remind_at,
        status=state,
        counted=counted,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # Another worker reserved it first.
        db.rollback()
        return db.scalar(select(WhatsAppUsage).where(WhatsAppUsage.idempotency_key == key)), True
    return row, False


def settle(db: Session, usage: WhatsAppUsage, outcome: str) -> None:
    """Records what MSG91 did with a reserved send (see the module notes)."""
    if outcome == msg91.ACCEPTED:
        usage.status = "ACCEPTED"
    elif outcome == msg91.REJECTED:
        usage.status = "REJECTED"
        if usage.counted:
            usage.counted = False
            if usage.plan_id:
                plan = db.scalar(select(WhatsAppPlan).where(WhatsAppPlan.id == usage.plan_id).with_for_update())
                if plan and plan.messages_used > 0:
                    plan.messages_used -= 1
    else:
        usage.status = "UNKNOWN"
    db.commit()


# ----------------------------------------------------------------- payments


def _require_payments() -> None:
    if not razorpay.is_configured():
        logger.info("WhatsApp plan purchase refused: %s", razorpay.why_off())
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments aren't available yet. Please try again later.")


def create_order(db: Session, user: User) -> dict:
    """A Razorpay order for one WhatsApp plan, at the server's price."""
    _require_payments()
    now = _now()
    order = db.scalar(
        select(PaymentOrder)
        .where(PaymentOrder.user_id == user.id, PaymentOrder.purpose == PURPOSE, PaymentOrder.status == "CREATED",
               PaymentOrder.amount_paise == PLAN_PRICE_PAISE, PaymentOrder.mode == razorpay.mode(),
               PaymentOrder.created_at > now - ORDER_REUSE)
        .order_by(PaymentOrder.created_at.desc())
    )
    if order is None:
        local_id = uuid.uuid4()
        try:
            remote = razorpay.create_order(
                PLAN_PRICE_PAISE, receipt=f"wa-{local_id.hex[:20]}", notes={"purpose": PURPOSE, "memo_order": str(local_id)}
            )
        except razorpay.RazorpayError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't start the payment. Please try again.") from exc
        if remote.get("amount") != PLAN_PRICE_PAISE or remote.get("currency") != "INR":
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't start the payment. Please try again.")
        order = PaymentOrder(
            id=local_id, user_id=user.id, purpose=PURPOSE, amount_paise=PLAN_PRICE_PAISE, currency="INR",
            mode=razorpay.mode(), provider_order_id=remote["id"], status="CREATED", created_at=now,
        )
        db.add(order)
        db.commit()
    return {
        "order_id": order.provider_order_id,
        "key_id": config.RAZORPAY_KEY_ID,  # the public key; the secret never leaves the server
        "amount_paise": order.amount_paise,
        "currency": order.currency,
        "name": "Memo",
        "description": f"WhatsApp plan: {PLAN_MESSAGES} reminders, {PLAN_DAYS} days",
        "prefill_email": user.email,
        "prefill_name": user.display_name,
        "mode": order.mode,
    }


def _activate(db: Session, order: PaymentOrder, payment_id: str) -> None:
    """Marks the (locked) order paid and grants its plan, once."""
    if order.status == "PAID":
        return
    now = _now()
    order.status = "PAID"
    order.provider_payment_id = payment_id
    order.paid_at = now
    order.failure_reason = None
    if order.user_id is None:
        return  # the account was removed after paying: kept for the accounts, nothing to grant
    _lock_user(db, order.user_id)
    previous = open_plan(db, order.user_id)
    carried = 0
    if previous is not None:
        if _running(previous, now):
            carried = _left(previous)
        previous.ended_at = now
        db.flush()
    db.add(WhatsAppPlan(
        user_id=order.user_id, payment_order_id=order.id, messages_granted=PLAN_MESSAGES, messages_carried=carried,
        messages_used=0, starts_at=now, expires_at=now + timedelta(days=PLAN_DAYS),
    ))
    logger.info("WhatsApp plan activated for order %s (carried %s)", order.provider_order_id, carried)


def apply_payment(db: Session, provider_order_id: str, payment: dict) -> str:
    """Acts on a payment Razorpay vouched for (a server-side look-up or a
    signed webhook). Returns PAID, PENDING, FAILED, MISMATCH or UNKNOWN_ORDER.
    Safe to call any number of times for the same payment."""
    order = db.scalar(select(PaymentOrder).where(PaymentOrder.provider_order_id == provider_order_id).with_for_update())
    if order is None:
        return "UNKNOWN_ORDER"
    if order.status == "PAID":
        db.commit()
        return "PAID"
    if (
        payment.get("order_id") != order.provider_order_id
        or payment.get("amount") != order.amount_paise
        or payment.get("currency") != order.currency
    ):
        logger.warning("Payment %s doesn't match order %s; ignored", payment.get("id"), order.provider_order_id)
        db.commit()
        return "MISMATCH"
    state = payment.get("status")
    if state == "captured":
        _activate(db, order, payment["id"])
        try:
            db.commit()
        except IntegrityError:
            # The same payment was already used (or a plan exists for this order).
            db.rollback()
            return "PAID" if db.scalar(select(PaymentOrder.status).where(PaymentOrder.provider_order_id == provider_order_id)) == "PAID" else "MISMATCH"
        return "PAID"
    if state == "failed":
        # Not final: the user can try again in the same checkout.
        order.status = "FAILED"
        order.failure_reason = (payment.get("error_description") or "Payment failed")[:255]
        db.commit()
        return "FAILED"
    db.commit()
    return "PENDING"  # created / authorized: Razorpay hasn't captured it yet


def verify_checkout(db: Session, user: User, order_id: str, payment_id: str, signature: str) -> str:
    """What the app sends after checkout. The signature proves it came from
    Razorpay's checkout for this order; the payment is then looked up on
    Razorpay before anything is granted."""
    order = db.scalar(select(PaymentOrder).where(PaymentOrder.provider_order_id == order_id, PaymentOrder.user_id == user.id))
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found.")
    if order.status == "PAID":
        return "PAID"
    if not razorpay.checkout_signature_ok(order_id, payment_id, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This payment couldn't be verified.")
    try:
        payment = razorpay.fetch_payment(payment_id)
    except razorpay.RazorpayError:
        return "PENDING"  # checked again later (status refresh, webhook)
    return apply_payment(db, order_id, payment)


def reconcile_order(db: Session, order: PaymentOrder) -> str:
    """Asks Razorpay about a waiting order (a delayed or missed confirmation)."""
    order.checked_at = _now()
    db.commit()
    try:
        payments = razorpay.fetch_order_payments(order.provider_order_id)
    except razorpay.RazorpayError:
        return "PENDING"
    captured = next((p for p in payments if p.get("status") == "captured"), None)
    if captured:
        return apply_payment(db, order.provider_order_id, captured)
    return order.status


def reconcile_recent(db: Session, user: User) -> None:
    """On a status check: if the user has a recent unpaid order, ask Razorpay
    about it (at most every RECHECK_EVERY), so a payment confirmed while the
    app was closed or the webhook was late still shows up."""
    if not razorpay.is_configured():
        return
    now = _now()
    order = db.scalar(
        select(PaymentOrder)
        .where(PaymentOrder.user_id == user.id, PaymentOrder.purpose == PURPOSE,
               PaymentOrder.status.in_(("CREATED", "FAILED")), PaymentOrder.created_at > now - ORDER_ABANDONED)
        .order_by(PaymentOrder.created_at.desc())
    )
    if order and (order.checked_at is None or now - order.checked_at > RECHECK_EVERY):
        reconcile_order(db, order)


def handle_webhook(db: Session, raw: bytes, signature: str, event_id: str | None) -> str:
    """A Razorpay webhook. The signature over the raw body is checked first;
    each event id is processed once (repeats are answered "duplicate")."""
    if not config.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhook not configured.")
    if not razorpay.webhook_signature_ok(raw, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature.")
    event_id = event_id or "body-" + hashlib.sha256(raw).hexdigest()[:40]
    if db.scalar(select(PaymentEvent.id).where(PaymentEvent.provider_event_id == event_id)):
        return "duplicate"
    try:
        body = json.loads(raw)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid body.") from exc
    event = str(body.get("event", ""))[:60]
    payment = (((body.get("payload") or {}).get("payment") or {}).get("entity")) or {}
    order_entity = (((body.get("payload") or {}).get("order") or {}).get("entity")) or {}
    order_id = payment.get("order_id") or order_entity.get("id")
    if event in ("payment.captured", "payment.failed", "order.paid") and order_id and payment:
        result = apply_payment(db, order_id, payment)
    else:
        result = "ignored"
    db.add(PaymentEvent(provider_event_id=event_id, event=event, provider_order_id=order_id,
                        provider_payment_id=payment.get("id"), result=result))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # the same event arrived twice at once; the first one recorded it
        return "duplicate"
    return result


def expire_abandoned(db: Session) -> int:
    """Daily cleanup: checkouts left unpaid for a day become EXPIRED."""
    rows = db.scalars(select(PaymentOrder).where(PaymentOrder.status == "CREATED", PaymentOrder.created_at < _now() - ORDER_ABANDONED)).all()
    for order in rows:
        order.status = "EXPIRED"
    if rows:
        db.commit()
    return len(rows)
