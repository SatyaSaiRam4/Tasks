"""Public web pages app stores ask for (APKPure, Google Play): the privacy
policy (/privacy) and a page where anyone can delete their Memo account
without the app (/account/delete). Plain HTML, no sign-in, served by this backend so they're
up whenever the API is. The contact address is SUPPORT_EMAIL."""

from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.core import config

router = APIRouter(include_in_schema=False)

UPDATED = "16 October 2026"

STYLE = """
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; background: #f6f3ec; color: #1b2133; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 30px; margin: 0 0 4px; } h2 { font-size: 20px; margin: 28px 0 8px; }
  .muted { color: #6b6f7d; font-size: 14px; }
  li { margin: 4px 0; } a { color: #8a6a1f; }
  form { background: #fff; border: 1px solid #e3dccb; border-radius: 14px; padding: 20px; margin: 20px 0; }
  label { display: block; font-weight: 600; margin: 12px 0 6px; }
  input { width: 100%; box-sizing: border-box; font-size: 16px; padding: 12px; border: 1px solid #cfc6b1; border-radius: 10px; }
  button { margin-top: 16px; font-size: 16px; font-weight: 600; padding: 12px 18px; border: 0; border-radius: 10px; background: #1b2133; color: #f3dca6; cursor: pointer; }
  button.danger { background: #b3261e; color: #fff; } button:disabled { opacity: .5; }
  .msg { margin-top: 12px; font-weight: 600; } .ok { color: #1e7a3c; } .err { color: #b3261e; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1122; color: #efe9dc; } form { background: #141b30; border-color: #2a3350; }
    input { background: #0b1122; color: #efe9dc; border-color: #2a3350; } a { color: #d4af6a; } .muted { color: #9aa1b4; }
    button { background: #d4af6a; color: #0b1122; }
  }
</style>
"""


def _contact() -> str:
    if config.SUPPORT_EMAIL:
        email = escape(config.SUPPORT_EMAIL)
        return f'<a href="mailto:{email}">{email}</a>'
    return "the developer contact address on the page where you downloaded Memo"


def _page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(
        f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{escape(title)}</title>{STYLE}</head>
<body><main>{body}</main></body></html>"""
    )


@router.get("/privacy", response_class=HTMLResponse)
def privacy() -> HTMLResponse:
    return _page(
        "Memo – Privacy Policy",
        f"""
<h1>Memo Privacy Policy</h1>
<p class="muted">Last updated {UPDATED}</p>
<p>Memo helps you keep plans, daily tasks, reminders, streaks and private notes. This policy explains what
information Memo collects, why, who helps us process it, and the choices you have. Memo does not sell your
data and does not show ads.</p>

<h2>What we collect</h2>
<ul>
  <li><b>Account:</b> your name, email address and password (stored only as a secure hash), or your Google
      account's name and email if you sign in with Google. Your time zone, so reminders and streaks follow your day.</li>
  <li><b>What you create:</b> plans, tasks, reminders, streak history, achievements, settings and an optional
      profile photo.</li>
  <li><b>Private Vault:</b> notes, photos and voice notes you save in the Vault, encrypted on our servers and
      protected by your Vault PIN.</li>
  <li><b>WhatsApp reminders:</b> phone numbers you add for WhatsApp reminders and the reminder text sent to
      them. For each number, whether its owner replied YES or STOP (kept so that a STOP is always respected).
      Replies sent to Memo's WhatsApp number (kept for 7 days, numbers masked, to run and check the service),
      and, for numbers that wrote something other than YES or STOP, when Memo last sent its automatic answer.</li>
  <li><b>Wallet:</b> the mobile number you give to receive a streak reward payout, and the payout records.</li>
  <li><b>Payments:</b> buying a WhatsApp plan is not available yet. When it is, Memo will keep each
      payment's amount, status and reference; card and UPI details are handled by the payment provider and
      never reach Memo.</li>
  <li><b>Microphone:</b> used only when you record a voice note in the Vault.</li>
  <li><b>Approximate location:</b> if you allow it, your phone's rough (city-level) location is used on your
      phone to show the weather on the Home screen. It is sent to the weather service (rounded to about 1 km),
      and your phone's built-in location service (which may use Google) turns it into a city name. It is
      <b>never</b> sent to or stored on Memo's servers.</li>
  <li><b>Server logs:</b> like most online services, our servers record requests (including the IP address
      and time) in short-lived logs, used to keep the service running and secure.</li>
  <li><b>Notifications and alarms:</b> scheduled on your phone; their content stays on your device.</li>
</ul>

<h2>How we use it</h2>
<p>Only to provide Memo's features: keeping your data in sync, sending the reminders you set (on your phone and
on WhatsApp to numbers that agreed), working out streaks and rewards, paying out rewards you redeem, sign-in and
account security (for example emailing sign-up, password-reset and account-deletion codes), and preventing abuse.</p>

<h2>Who helps us</h2>
<ul>
  <li>Render (servers) and Supabase (database), where Memo's data is stored.</li>
  <li>MSG91, which sends WhatsApp messages for Memo through WhatsApp (Meta) and passes on replies.</li>
  <li>Our email provider, which delivers sign-in and account emails.</li>
  <li>Google, if you choose to sign in with Google.</li>
  <li>Open-Meteo, which returns the weather for an approximate location sent from your phone.</li>
  <li>Razorpay, for WhatsApp plan payments once they are offered (not yet).</li>
</ul>
<p>They process data only to provide their service to Memo. We share information otherwise only if the law requires it.</p>

<h2>How long we keep it</h2>
<p>Your data is kept while you have an account. Finished plans and tasks are removed 7 days after they end, done
reminders after 7 days, and Vault notes in the bin after 30 days. When you delete your account, everything that
belongs to it is deleted at once (copies in our hosting provider's backups expire on their own schedule). Kept
without your name: payment records, where accounting rules require them, and each WhatsApp number's YES or STOP
answer, so that a STOP is still respected.</p>

<h2>Your choices</h2>
<ul>
  <li>You can edit or delete your plans, tasks, reminders and Vault notes at any time in the app.</li>
  <li>You can turn off location, microphone and notifications in your phone's settings; Memo keeps working without them.</li>
  <li>Anyone can reply STOP to Memo's WhatsApp messages to stop receiving them.</li>
  <li><b>Delete your account:</b> in the app (Settings → Account → Delete account) or on the web at
      <a href="/account/delete">/account/delete</a>.</li>
</ul>

<h2>Security</h2>
<p>Data travels over encrypted connections (HTTPS). Passwords are hashed, Vault content is encrypted, and staff
admin screens never show Vault content.</p>

<h2>Children</h2>
<p>Memo is not directed at children under 13 and does not knowingly collect their data.</p>

<h2>Changes and contact</h2>
<p>If this policy changes, the date above changes too. Questions or requests: {_contact()}.</p>
""",
    )


@router.get("/account/delete", response_class=HTMLResponse)
def delete_account_page() -> HTMLResponse:
    return _page(
        "Memo – Delete your account",
        f"""
<h1>Delete your Memo account</h1>
<p>You can do this in the app (Settings → Account → Delete account) or here. We'll email a 6-digit code to the
account's address to make sure it's yours.</p>
<p><b>Deleting is permanent.</b> It removes your account and everything in it: plans, tasks, reminders (including
their WhatsApp numbers), streaks and badges, wallet points and payout requests, Vault notes, photos and voice
notes, and your profile. Kept without your name: payment records, where accounting rules require them, and each
WhatsApp number's YES or STOP answer, so that a STOP is still respected.</p>

<form id="step1">
  <label for="email">Your account's email</label>
  <input id="email" type="email" autocomplete="email" required>
  <button type="submit">Email me a code</button>
  <div class="msg" id="msg1"></div>
</form>

<form id="step2" hidden>
  <label for="code">6-digit code from the email</label>
  <input id="code" inputmode="numeric" pattern="[0-9]{{6}}" maxlength="6" required>
  <button type="submit" class="danger">Delete my account permanently</button>
  <div class="msg" id="msg2"></div>
</form>

<p class="muted">Need help? Contact {_contact()}. <a href="/privacy">Privacy policy</a></p>

<script>
  const api = "/api/v1/auth/delete-account";
  const show = (el, text, ok) => {{ el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); }};
  const error = async res => {{ try {{ return (await res.json()).error.message; }} catch {{ return "Something went wrong. Please try again."; }} }};
  document.getElementById("step1").addEventListener("submit", async e => {{
    e.preventDefault();
    const button = e.target.querySelector("button"), msg = document.getElementById("msg1");
    button.disabled = true;
    try {{
      const res = await fetch(api + "/request", {{ method: "POST", headers: {{ "content-type": "application/json" }},
        body: JSON.stringify({{ email: document.getElementById("email").value.trim() }}) }});
      if (!res.ok) throw new Error(await error(res));
      show(msg, "If that email has a Memo account, a code is on its way. Check your inbox (and spam).", true);
      document.getElementById("step2").hidden = false;
    }} catch (err) {{ show(msg, err.message, false); }}
    button.disabled = false;
  }});
  document.getElementById("step2").addEventListener("submit", async e => {{
    e.preventDefault();
    if (!confirm("Delete your Memo account and all its data? This can't be undone.")) return;
    const button = e.target.querySelector("button"), msg = document.getElementById("msg2");
    button.disabled = true;
    try {{
      const res = await fetch(api + "/confirm", {{ method: "POST", headers: {{ "content-type": "application/json" }},
        body: JSON.stringify({{ email: document.getElementById("email").value.trim(), code: document.getElementById("code").value.trim() }}) }});
      if (!res.ok) throw new Error(await error(res));
      show(msg, "Your account and its data have been deleted.", true);
      document.getElementById("step1").hidden = true;
    }} catch (err) {{ show(msg, err.message, false); button.disabled = false; }}
  }});
</script>
""",
    )
