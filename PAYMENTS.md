# Memo: WhatsApp plan, payments and wallet payouts

How Memo charges for WhatsApp reminders (Razorpay) and pays out streak-point
rewards (by hand). Read with [PROJECT.md](PROJECT.md). **Status: built and
tested in Razorpay test mode only. No live payments until the Razorpay account
is activated (Video KYC) and the Google Play billing decision below is made.**

## Contents

1. [Rules](#1-rules)
2. [How a purchase works](#2-how-a-purchase-works)
3. [When a WhatsApp message is used](#3-when-a-whatsapp-message-is-used)
4. [Wallet: points and payouts](#4-wallet-points-and-payouts)
5. [API](#5-api)
6. [Database](#6-database)
7. [Configuration](#7-configuration)
8. [Admin](#8-admin)
9. [Security](#9-security)
10. [Tests](#10-tests)
11. [Deploying to Render (test mode)](#11-deploying-to-render-test-mode)
12. [After Video KYC: going live](#12-after-video-kyc-going-live)
13. [Google Play payment policy](#13-google-play-payment-policy)
14. [Decisions waiting for approval](#14-decisions-waiting-for-approval)

---

## 1. Rules

All prices and allowances live on the server
(`Backend/app/modules/subscriptions/service.py`); a request can never change them.

| Rule | Value |
|---|---|
| Free WhatsApp reminders | **3 per Memo account** (not per phone number; changing or adding numbers gives no more) |
| Plan price | **₹30** (3000 paise) |
| Plan allowance | **100** WhatsApp reminders |
| Plan length | **30 days** from the moment the server confirms the payment |
| Renewal | Only when the user taps *Renew* (no automatic debits). The new plan starts at confirmation; if the previous plan was still running, it ends then and its **unused messages carry over** into the new one. There is only ever **one open plan** per user (database-enforced). |
| What counts | Only WhatsApp **reminders** sent by the worker. Phone notifications, alarms, the YES/STOP permission message and the automatic "only reminders here" reply are never counted. |
| Consent first | A plan never lets Memo message a number that hasn't said YES, or said STOP. |

When the 3 free ones are used and no plan has messages left:

- Saving a reminder with WhatsApp on answers **402** with code
  `SUBSCRIPTIONREQUIRED` and the message "Your 3 free WhatsApp reminders are
  used. The WhatsApp plan is ₹30 for 100 WhatsApp reminders over 30 days."
- A reminder that was saved earlier and comes due is **not sent** (ledger row
  `BLOCKED`, reminder marked *Failed*), so nothing billable goes out.

The app shows this in the reminder editor (allowance line + *See the WhatsApp
plan*) and on Settings → Notifications → **WhatsApp plan**.

## 2. How a purchase works

```
App                         Memo server                         Razorpay
 │ POST /subscriptions/whatsapp/order ──▶ create order (₹30, from config) ──▶ /v1/orders
 │ ◀── order_id, public key_id, amount ───┤ store payment_orders (CREATED)
 │ Razorpay checkout (native SDK) ───────────────────────────────────────────▶ user pays
 │ ◀── razorpay_payment_id, order_id, signature
 │ POST /subscriptions/whatsapp/verify ──▶ 1. check signature HMAC(order|payment, key secret)
 │                                         2. GET /v1/payments/{id}: status, order, amount, currency
 │                                         3. captured → order PAID + plan granted (once)
 │ ◀── PAID / PENDING / FAILED / MISMATCH
 │                                     ◀── webhook payment.captured / order.paid / payment.failed
 │                                         (signature over raw body, each event id once)
 │ GET /subscriptions/whatsapp ─────────▶ also asks Razorpay about a recent unpaid order (≤ every 20 s)
```

- **The app's "success" never activates anything.** A plan is granted only when
  Razorpay itself says the payment is `captured` for that order, for exactly
  ₹30 INR: through the server's own look-up after a valid checkout signature,
  a signed webhook, or the server asking Razorpay about a recent order.
- **Idempotent:** the order row is locked while a payment is applied;
  `whatsapp_plans.payment_order_id` and `payment_orders.provider_payment_id`
  are unique, and webhook event ids are stored, so duplicate callbacks,
  duplicate webhooks and retries can't grant twice.
- **Delayed / missed confirmations:** if the app is closed after paying, or the
  webhook is late or not configured, the next plan status check (Settings →
  WhatsApp plan, the reminder editor) asks Razorpay about the order. The plan
  screen also polls every 4 s for up to 2 minutes while waiting.
- **Failed payments:** an order becomes `FAILED` with Razorpay's reason, but
  the user can retry in the same checkout; a later capture still activates it.
- **Abandoned checkouts:** an unpaid order is reused for 20 minutes (no pile of
  orders), then a new one is made; the daily cleanup marks orders unpaid after
  24 h as `EXPIRED`. Payment records are never deleted.
- **Amount check:** a payment for any other amount or currency is refused
  (`MISMATCH`), never granted.

The checkout is Razorpay's own (`react-native-razorpay` 3.0.0, a TurboModule,
works with the new architecture). Memo never sees card or UPI details. The
module is loaded only when the user pays, so a build without it says
"Payments need the latest version of the app" instead of crashing.

## 3. When a WhatsApp message is used

The reminder worker (`Backend/app/workers/reminder_worker.py`), for each due
WhatsApp reminder:

1. **Consent:** the number must have said YES (unchanged; a not-yet/no-longer
   allowed number waits 5 minutes for a YES, then the reminder is *Failed*).
2. **Reserve:** `subscriptions.reserve()` locks the account and writes one
   ledger row for this reminder occurrence, key
   `reminder:<id>:<remind_at>` (unique). It uses a free message if any are
   left, otherwise one from the open plan (`messages_used + 1`), otherwise the
   row is `BLOCKED` and nothing is sent. This is committed **before** MSG91 is
   called.
3. **Send** through MSG91, then **settle** the row:

| MSG91 outcome | Ledger status | Counted? | Resent? |
|---|---|---|---|
| Accepted (2xx, no error) | `ACCEPTED` | yes | no |
| Refused (HTTP error / error body / couldn't connect) | `REJECTED` | **no** (unit given back) | no (reminder *Failed*, as before) |
| No answer (timeout, dropped connection) | `UNKNOWN` | yes (it may have gone out) | **no** |

4. **Retries:** if the worker meets an occurrence that already has a ledger
   row (e.g. it crashed after reserving), it **does not send again** and
   doesn't count again. Two workers at once get one row (unique key).

Snoozing or moving a reminder creates a new occurrence (new key), which is a
new message. Delivery/read status from MSG91 isn't wired in yet
(`whatsapp_usage.delivery_status` is reserved for it).

## 4. Wallet: points and payouts

Decision (approved): **milestones, once each.**

- Best-streak milestones unlock points once, ever: **500 points at a best
  streak of 500** and **1000 more at 1000** (1500 in all). Best streak never
  goes down, so unlocked points never shrink.
- Redeem **500 points → ₹10** or **1000 points → ₹20** (50 points = ₹1). No
  other amounts.
- Spendable points = unlocked − points in `PENDING` or `PAID` redemptions. A
  `REJECTED` redemption gives its points back.
- Redeeming **never** changes the best streak, current streak, badges or
  milestones (tested).
- The account row is locked while redeeming (two taps at once can't spend the
  same points); the app sends a `request_id`, and a repeat returns the first
  redemption. The app also blocks a double tap.
- Payouts stay **manual**: a redemption is `PENDING` until an admin marks it
  `PAID` (after actually sending the money, with the UPI/bank reference) or
  `REJECTED` (with a reason the user sees). Who and when are recorded; a
  decided redemption can't be changed again.
- `wallet_redemptions` is the ledger; rows are never deleted.
- Older app versions that send `amount` 10 or 20 still work; any other amount
  is refused with "Choose 500 points (₹10) or 1000 points (₹20)".
- Reconciliation: at the time of the change there were **no** redemptions in
  production (checked read-only), so no balances needed adjusting. The
  migration sets `points = amount × 50` for any existing rows.

### Manual payout procedure

1. Admin → **Payouts & payments** → *Payouts* shows PENDING requests
   (user, ₹, points, mobile number).
2. Send the money to that number (UPI / wallet) outside Memo.
3. Tap **Mark paid** and enter the transaction reference. Only then.
4. If it can't be paid (wrong number), tap **Reject** with a reason: the
   user's points come back and they see the reason.

## 5. API

All under `/api/v1`. User endpoints need the signed-in user and only ever
return that user's data.

| Endpoint | What |
|---|---|
| `GET /subscriptions/whatsapp` | Allowance: `free_total/used/remaining`, `plan_status` (`NONE`, `ACTIVE`, `USED_UP`, `EXPIRED`), `paid_remaining`, `plan_messages_total/used`, `plan_starts_at/expires_at`, `purchase_required`, `payments_enabled`, `payments_mode`, price, `pending_order_id` |
| `POST /subscriptions/whatsapp/order` | Starts a purchase; no body (the price is the server's). Returns `order_id`, public `key_id`, `amount_paise`, `currency`, prefill. 503 when payments are off. 10/hour |
| `POST /subscriptions/whatsapp/verify` | `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` → `{state, plan}`; `state` is `PAID`, `PENDING`, `FAILED` or `MISMATCH`. 400 on a bad signature, 404 for someone else's order. 30/hour |
| `POST /payments/razorpay/webhook` | Razorpay only (no sign-in). Needs `X-Razorpay-Signature` (HMAC of the raw body); `X-Razorpay-Event-Id` makes repeats return `duplicate`. 400 bad signature, 503 if `RAZORPAY_WEBHOOK_SECRET` is unset |
| `POST /reminders`, `PATCH /reminders/{id}` | Now **402 `SUBSCRIPTIONREQUIRED`** when WhatsApp is on and nothing is left |
| `GET /wallet` | Adds `points_unlocked`, `points_redeemed`, `points_available`, `choices` ([{points, amount, available}]), milestone `points`; rupee fields kept |
| `POST /wallet/redeem` | `{phone, points: 500 or 1000, request_id?}` (older apps: `amount` 10/20). 201 new, 200 repeat of the same `request_id`, 409 not enough points. 10/hour |
| `GET /wallet/redemptions` | The user's redemptions with `points`, `status`, `payout_reference`, `note`, `decided_at` |
| `GET /admin/redemptions?status=PENDING` | Admin: payouts with user email |
| `POST /admin/redemptions/{id}/paid` | Admin: `{reference}` (3–120 chars); records who and when |
| `POST /admin/redemptions/{id}/reject` | Admin: `{note}`; points go back |
| `GET /admin/payments` | Admin: plan payments (order/payment ids, status, mode, failure reason) |
| `GET /admin/whatsapp-plans` | Admin: plans with allowance, usage, period, free used |

## 6. Database

Migration **`e8b3f1c6a2d7`** (`2026_10_16_1000-…_payments_plans_wallet_points.py`).
It only **adds** tables, columns and constraints; nothing is dropped or
rewritten. Checked locally: upgrade → downgrade → upgrade, and `alembic check`
reports the models and database match.

| Table | What |
|---|---|
| `payment_orders` | One per checkout: user (SET NULL if removed, so the record stays), `amount_paise > 0`, currency, provider, `mode` (test/live), unique `provider_order_id` and `provider_payment_id`, `status` (`CREATED`, `PAID`, `FAILED`, `EXPIRED`), failure reason, `checked_at`, `paid_at` |
| `payment_events` | Every processed webhook by unique `provider_event_id`, with its result |
| `whatsapp_plans` | One per paid order (unique `payment_order_id`): `messages_granted`, `messages_carried`, `messages_used` (checked 0…allowance), `starts_at`, `expires_at`, `ended_at`; partial unique index: one open plan per user |
| `whatsapp_usage` | The message ledger: user, reminder (SET NULL), plan, `source` (`FREE`, `PLAN`, `NONE`), unique `idempotency_key`, `scheduled_for`, `status` (`ATTEMPTED`, `ACCEPTED`, `REJECTED`, `UNKNOWN`, `BLOCKED`), `counted`, `delivery_status` |
| `wallet_redemptions` (extended) | + `points`, `request_id` (unique per user), `payout_reference`, `note`, `decided_by`, `decided_at`; checks on amount, points and status |

All timestamps are `timestamptz` (UTC). No backfill is needed: free usage
starts at 0 for every account on deploy, so **every existing user gets 3 free
WhatsApp reminders from the deploy onward**.

## 7. Configuration

Backend only (`Backend/.env` locally, Render → Environment in production).
**Nothing payment-related goes in the app.** The app gets the public key id
from the server per order.

| Variable | Value |
|---|---|
| `RAZORPAY_KEY_ID` | Test: Razorpay Dashboard (Test mode) → Account & Settings → API Keys → Key Id (`rzp_test_…`) |
| `RAZORPAY_KEY_SECRET` | The matching Key Secret. Never shared, logged or sent to the app |
| `RAZORPAY_WEBHOOK_SECRET` | A long random value you choose when creating the webhook (same value in both places) |
| `RAZORPAY_MODE` | `test` (default). `live` only after activation |

Payments are **off** (the app shows "Payments coming soon") unless both keys
are set **and** match the mode: `rzp_test_` keys only with `test`, `rzp_live_`
only with `live`. A mismatch is refused, so live keys can't run in test mode
or the other way round. The webhook answers 503 until its secret is set.

## 8. Admin

Admin → **Payouts & payments** (`AdminMoneyScreen`), behind the existing
`require_admin` check (ordinary users get 403; tested):

- **Payouts:** pending and decided redemptions; *Mark paid* (reference
  required) and *Reject* (reason required), each recording who and when.
- **Payments:** every plan checkout with status, mode, Razorpay ids, failure reason.
- **Plans:** each plan's allowance, usage, period, free messages used.

No secrets are shown anywhere. Admin roles and credentials are unchanged.

## 9. Security

- Checkout signature: `HMAC-SHA256(order_id|payment_id, KEY_SECRET)`,
  compared in constant time; then the payment is looked up on Razorpay.
- Webhook signature: `HMAC-SHA256(raw body, WEBHOOK_SECRET)` over the exact
  bytes received, constant-time compare, before the body is parsed.
- Amount, currency, plan size, period, user and redemption values come from the
  server; request bodies only carry Razorpay's ids or the 500/1000 choice
  (validated). The verify endpoint only accepts the user's own orders.
- Logs never contain keys, secrets, signatures or card data (only order ids,
  Razorpay error codes, last 4 digits of phone numbers).
- Rate limits on order, verify and redeem (existing in-process limiter).
- Card/UPI details never reach Memo (Razorpay's hosted checkout).

## 10. Tests

Run: `cd Backend && myenv/bin/python -m pytest -q` (needs the test database,
see PROJECT.md) and `cd MyApp && npx jest`. Razorpay and MSG91 are mocked:
no real payments or messages, ever (an autouse fixture also blocks real
WhatsApp sends).

- `Backend/tests/test_whatsapp_plan.py` (19): 3 free then 402; scheduled 4th
  not sent; shared across numbers; consent/STOP with a plan; refused vs
  unanswered sends; worker retry never resends; concurrent reserves; last free
  message race; credentials missing and key/mode mismatch; server-side price
  and order reuse; forged success; valid verify grants 100/30 days once;
  "success" from the app isn't enough (PENDING until captured); wrong amount;
  webhook signature and duplicates; failed then retried payment; countdown and
  expiry; renewal carry-over and one open plan; user isolation; admin views.
- `Backend/tests/test_wallet.py` (11): 500→₹10, 1000→₹20, not enough points,
  fixed choices only (no negative/odd amounts), older apps, repeated request id,
  4 simultaneous requests (one wins), best streak/badges unchanged, isolation
  and admin-only payouts, mark paid once with who/when, reject returns points.
- `MyApp/__tests__/whatsappPlan.test.ts` (5) and `planScreens.test.tsx` (9):
  checkout result mapping (success, cancel, failure), allowance wording; plan
  screen (purchase required, payments off, error, pay → confirmed only after
  the server says so, cancel, waiting on Razorpay, old build); wallet screen
  (points, choices, statuses, request id, double tap sends once).

## 11. Deploying to Render (test mode)

1. **Before deploying:** back up the database (Supabase → Database →
   Backups, or `pg_dump`). The migration is additive, but back up anyway.
2. Merge and deploy as usual. Render runs `alembic upgrade head` on deploy
   (see PROJECT.md 10.1), which applies `e8b3f1c6a2d7`. To review it first:
   `alembic upgrade d4a7e2b9c1f5:e8b3f1c6a2d7 --sql` prints the SQL without
   running it.
3. In Render → **both** services (tasks-singapore and tasks-wvlv) →
   Environment, **add** the same values (don't change existing ones): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys),
   `RAZORPAY_MODE=test`, `RAZORPAY_WEBHOOK_SECRET`.
4. Razorpay Dashboard (Test mode) → **Webhooks → Add New Webhook**:
   URL `https://tasks-singapore.onrender.com/api/v1/payments/razorpay/webhook`
   (and a second webhook with `https://tasks-wvlv.onrender.com/...`, same
   secret and events: each event is processed once whichever server gets it),
   secret = `RAZORPAY_WEBHOOK_SECRET`, events **payment.captured**,
   **payment.failed**, **order.paid**.
5. Build a new app (the Razorpay SDK is native) and pay with Razorpay's test
   cards / test UPI (Razorpay docs → "Test Card Details"; no real money).
   Check: plan becomes active; Admin → Payments shows `PAID · test`;
   `payment_events` has the webhook.
6. Health checks are unchanged (`/health`, `/health/ready`). The webhook is
   unauthenticated by design but signature-checked.

**Rollback:** redeploy the previous commit. The extra tables and columns are
harmless to older code (nothing reads them), so the database can stay as it
is. Only if really needed: `alembic downgrade d4a7e2b9c1f5` (drops the new
tables and wallet columns, **losing payment records**; take a backup first).

## 12. After Video KYC: going live

1. Wait for Razorpay to activate the account (live mode available).
2. Decide the Google Play billing question ([13](#13-google-play-payment-policy)).
   Don't enable live payments in a Play build before that.
3. Razorpay Dashboard (Live mode) → generate live API keys; create the same
   webhook in **Live** mode with a **new** secret.
4. In Render, replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET` with the live values and set `RAZORPAY_MODE=live`
   together (keys and mode must match, or payments stay off).
5. Make one real ₹30 purchase yourself; check Admin → Payments shows `PAID`
   without `· test`, and the webhook arrived. Refund it from the Razorpay
   dashboard if you like (refunds are not automated: the plan stays; remove it
   by hand if needed).
6. Watch the Render log for `Razorpay … HTTP` warnings for a few days.

Checklist: ☐ account activated ☐ Play billing decided ☐ live keys + live
webhook ☐ Render variables + `RAZORPAY_MODE=live` ☐ one real purchase checked
☐ refund/terms/privacy pages mention payments ☐ GST/invoicing handled.

## 13. Google Play payment policy

Checked against Google's [Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)
and the [India billing changes](https://support.google.com/googleplay/android-developer/answer/13306652?hl=en)
(October 2026; Google's India page predates 2026, so re-check before release):

- Selling the WhatsApp plan inside an app distributed on Google Play counts as
  **app functionality / a subscription service**, which normally **must use
  Google Play Billing**. In India, Google lets developers offer an
  **alternative billing system alongside** Play Billing (enrolment, a service
  fee reduced by 4%, transaction reporting). A Razorpay-only checkout in a
  Play build is therefore **not** compliant as it stands.
- The streak-point **payouts** pay users; they aren't purchases, so Play
  Billing doesn't apply. Keep them within Play's policies on real-money rewards.

| Flow | Status |
|---|---|
| WhatsApp plan via Razorpay, **test mode**, internal/test builds | Implemented; fine for testing |
| WhatsApp plan via Razorpay, **live**, Play-distributed build | **Keep disabled** until the billing decision; needs Play Billing (optionally Razorpay alongside, via Google's alternative billing program) |
| WhatsApp plan, builds outside Google Play | Razorpay allowed by Google's policy (other stores have their own rules) |
| Wallet payouts (manual) | Implemented; no billing-policy issue |

The payment provider is isolated (`app/integrations/razorpay.py`,
`payment_orders.provider`, `MyApp/src/modules/subscriptions/checkout.ts`), so
Play Billing can be added as another provider that grants the same plan.

## 14. Decisions waiting for approval

1. **Google Play billing** for the WhatsApp plan (Play Billing only, or Play
   Billing plus Razorpay through Google's India alternative billing program).
2. **Automatic renewal** (Razorpay Subscriptions / mandates): not built; plans
   renew only when the user taps *Renew*, as instructed.
3. **Refunds**: not automated. A refunded payment doesn't remove the plan.
4. **Existing users** get 3 free WhatsApp reminders from the deploy onward
   (earlier sends aren't counted, as there was no ledger).
