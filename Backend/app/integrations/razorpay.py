"""Razorpay, over its REST API (no SDK needed; httpx is already used here).

Only what the WhatsApp plan needs: create an order, read a payment or an
order's payments (to confirm a payment on the server, never trusting the
app), and check the two signatures Razorpay uses:

  * checkout:  HMAC-SHA256("<order_id>|<payment_id>", RAZORPAY_KEY_SECRET)
  * webhook:   HMAC-SHA256(<raw request body>, RAZORPAY_WEBHOOK_SECRET)

Amounts are integer paise. Nothing here logs a secret, a full signature or
card data (Razorpay's hosted checkout never gives card data to Memo anyway).
"""

import hashlib
import hmac
import logging

import httpx

from app.core import config

API = "https://api.razorpay.com/v1"
logger = logging.getLogger("razorpay")


class RazorpayError(Exception):
    """Razorpay couldn't be reached or refused the request."""


def mode() -> str:
    return config.RAZORPAY_MODE if config.RAZORPAY_MODE in ("test", "live") else "test"


def is_configured() -> bool:
    """Keys present and matching the mode (rzp_test_ keys only in test, rzp_live_ only in live)."""
    key, secret = config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET
    if not key or not secret or config.RAZORPAY_MODE not in ("test", "live"):
        return False
    return key.startswith(f"rzp_{config.RAZORPAY_MODE}_")


def why_off() -> str | None:
    """Why payments are off, for logs and admins (never includes a key)."""
    if not config.RAZORPAY_KEY_ID or not config.RAZORPAY_KEY_SECRET:
        return "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set"
    if config.RAZORPAY_MODE not in ("test", "live"):
        return "RAZORPAY_MODE must be test or live"
    if not config.RAZORPAY_KEY_ID.startswith(f"rzp_{config.RAZORPAY_MODE}_"):
        return f"RAZORPAY_KEY_ID doesn't match RAZORPAY_MODE={config.RAZORPAY_MODE}"
    return None


def _request(method: str, path: str, **kwargs) -> dict:
    if not is_configured():
        raise RazorpayError("Payments aren't set up.")
    try:
        response = httpx.request(
            method, f"{API}{path}", auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET), timeout=15.0, **kwargs
        )
    except httpx.HTTPError as exc:
        logger.warning("Razorpay %s %s failed: %s", method, path.split("?")[0], type(exc).__name__)
        raise RazorpayError("Couldn't reach Razorpay.") from exc
    if not response.is_success:
        # Razorpay's error body has a code and a description, never secrets.
        try:
            error = response.json().get("error", {})
        except ValueError:
            error = {}
        logger.warning("Razorpay %s %s: HTTP %s %s", method, path.split("?")[0], response.status_code, error.get("code"))
        raise RazorpayError(error.get("description") or f"Razorpay answered HTTP {response.status_code}.")
    return response.json()


def create_order(amount_paise: int, receipt: str, notes: dict[str, str]) -> dict:
    """A new order; payment_capture=1 so a successful payment is captured at once."""
    return _request(
        "POST",
        "/orders",
        json={"amount": amount_paise, "currency": "INR", "receipt": receipt, "notes": notes, "payment_capture": 1},
    )


def fetch_payment(payment_id: str) -> dict:
    return _request("GET", f"/payments/{payment_id}")


def fetch_order_payments(order_id: str) -> list[dict]:
    return _request("GET", f"/orders/{order_id}/payments").get("items", [])


def _hmac(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def checkout_signature_ok(order_id: str, payment_id: str, signature: str) -> bool:
    if not config.RAZORPAY_KEY_SECRET or not signature:
        return False
    expected = _hmac(config.RAZORPAY_KEY_SECRET, f"{order_id}|{payment_id}".encode())
    return hmac.compare_digest(expected, signature)


def webhook_signature_ok(raw_body: bytes, signature: str) -> bool:
    if not config.RAZORPAY_WEBHOOK_SECRET or not signature:
        return False
    return hmac.compare_digest(_hmac(config.RAZORPAY_WEBHOOK_SECRET, raw_body), signature)
