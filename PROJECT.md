# Rememberly — Memory & Reminder App

A personal app to keep track of three things: **categories with daily checklists**,
**time-based reminders** (with a push notification and an optional WhatsApp
message), and **simple date-organized notes**.

It has two parts that run separately:
- **Backend** — a FastAPI server that stores everything in a database and sends
  WhatsApp messages.
- **MyApp** — a React Native (Android/iOS) app that people actually use on
  their phone.

---

## 1. The three core features

### Categories (e.g. "Gym", "Work")
- You create a category, then add tasks inside it (e.g. "Pre workout", "Sets").
- Every task has its own checklist (e.g. "Stretch", "Warm up").
- A day-tab strip at the top lets you jump between days — today, or any
  previous day — and see how many tasks you completed that day.

### Reminders
- You add something with a time (e.g. "Go to market at 4pm", or months
  ahead — "Sister's marriage in November").
- At that time, you get a real push notification on your phone, even if the
  app is closed (handled by the phone itself, not the internet).
- Optionally, you can also give a WhatsApp number, and the backend will send
  the same reminder as a WhatsApp message at the same time, through MSG91.

### Notes
- Plain, casual notes — title + content, nothing fancy (no categories, no
  types). Useful for things like passwords or account details.
- Pin important ones; the rest are grouped by date (Today / Yesterday / This
  week / Earlier).

There's also a simple **Admin panel** (for the admin account only) to see
all users, and a standard **Login/Register** flow.

---

## 2. How it's built

### Backend (`Backend/`)
- **Framework:** FastAPI (Python), connects to a PostgreSQL database
  (hosted on Supabase).
- **Structure:** one folder per feature under `app/modules/` — `auth`,
  `categories`, `tasks`, `notes`, `reminders`, `admin` — each with the same
  shape: `models.py` (database tables), `schemas.py` (request/response
  shapes), `service.py` (the actual logic), `router.py` (the API endpoints).
- **Login security:** passwords hashed with Argon2; short-lived JWT access
  tokens plus longer-lived, rotating refresh tokens.
- **Reminders worker:** a background job (`app/workers/reminder_worker.py`)
  checks every 20 seconds for reminders that are due and have a WhatsApp
  number attached, and sends them via `app/integrations/msg91.py`.

### Frontend (`MyApp/`)
- **Framework:** React Native (not Expo), so it builds to a real Android/iOS
  app.
- **State & API calls:** Redux Toolkit + RTK Query — each feature has its own
  `xApi.ts` file (e.g. `remindersApi.ts`) that talks to the backend.
- **UI components:** `@ant-design/react-native`, plus a set of shared,
  reusable building blocks in `src/components/` (buttons, panels, empty
  states, etc.) so every screen looks consistent.
- **Navigation:** everything lives in one file,
  `src/navigation/RootNavigator.tsx`, so it's easy to see the whole app's
  flow in one place.
- **Push notifications:** `react-native-notify-kit` schedules real,
  on-device notifications for reminders — this works even without internet,
  because the phone's own alarm system fires it.
- **Design:** a single consistent look called "Shonen Energy" — bold colors,
  thick black outlines, hard shadows — defined once in `src/theme/index.ts`
  and used everywhere.

---

## 3. Running it yourself

### Backend
```bash
cd Backend
cp .env.example .env        # then fill in real values (see below)
source myenv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
The backend needs a `.env` file (never commit this — it's gitignored).
`.env.example` lists every variable it understands; at minimum you need the
five database variables (`HOST`, `PORT`, `DATABASE`, `USER`, `PASSWORD`) for
it to start at all. The MSG91 variables are optional — without them,
reminders still work as push notifications, just without WhatsApp.

### Frontend
```bash
cd MyApp
npm install
npx react-native start        # Metro bundler, keep running
npx react-native run-android  # in a second terminal
```

---

## 4. What's working right now (tested live on a real emulator)

- ✅ Full login/register flow
- ✅ Categories → tasks → checklists → day-tab completion tracking
- ✅ Notes (create, pin, date grouping)
- ✅ Reminders create/edit/cancel/delete
- ✅ Real local push notifications — confirmed firing on-device
- ✅ Exact-alarm permission handling (prompts to enable "Alarms & reminders"
  on Android when needed)
- ✅ Admin panel (user list, non-admins correctly blocked)

## 5. What's not finished yet

- ⏳ **WhatsApp messages aren't actually being delivered yet.** The backend
  correctly calls MSG91's API and gets a success response every time, but
  every test message gets stuck on the recipient's phone showing "Waiting
  for this message, this may take a while" and never resolves. This points
  to the WhatsApp Business number (`916304909776`) not having completed its
  encryption/registration step properly on MSG91's side — not something
  fixable from our code. **A support ticket is open with MSG91** about this;
  once they confirm it's fixed, the WhatsApp side-channel should work
  immediately with no code changes needed.
