# Memo — Daily Tasks, Streaks, Reminders & a Private Vault

A personal app that helps you **do your daily tasks**, **keep a streak going**,
**never forget time-based things**, and **keep private notes safe**. The
design is premium and dark, and every screen is kept **simple on purpose**:
only what's needed, nothing extra. A small guide character, **Satya**, shows
new users around.

It has two parts that run separately:
- **Backend**: a FastAPI server. It stores everything in a PostgreSQL database,
  decides streaks, and sends WhatsApp reminders.
- **MyApp**: a React Native app for Android. This is the app people use on
  their phone.

> In the code, a Category is called a **Track** and a Task an **Action**
> (`tracks/`, `actions/`). The app only shows the words Category and Task.

---

## 1. The main features

### Categories and tasks
- A **category** is a goal with a period, e.g. "Gym, 4 Oct → 2 Nov".
  Creating one asks for just a **name** and the **dates**.
- Inside it you add **tasks** by name only (e.g. "Workout"). Every task gets a
  box to tick every day.
- Each category shows a **table with borders**: tasks down the side, days
  across the top (scrolls sideways, opens at today). Only **today's** box can
  be ticked; past days show ✓ or ✗ and are locked, future days are empty.
- Ticking asks **"Did you do it today?"** so streaks stay honest. A "quick"
  mode in Settings ticks straight away.
- Tap a task's name to rename or delete it.

### Streaks
- A day counts when **all of that day's tasks** are ticked. A day with no tasks
  neither extends nor breaks the streak.
- The **server** decides streaks, in the user's own timezone, so changing the
  phone's clock doesn't help. Finished days are never rewritten.
- Missing a day resets the streak, with gentle wording, not guilt.
- Extras: a calendar of done/missed days, badges, an evening "streak at risk"
  notification, and bonus points for finishing a whole category perfectly.

### Reminders
- Pick a **day** from a strip of days (or any date from the calendar button)
  and see that day's reminders.
- A reminder is just **what**, **which day** and **what time**, with an
  optional **WhatsApp** message (through MSG91) besides the push notification.
- Tick to complete; ••• to snooze (1 hour / tomorrow) or delete.

### Vault: private notes
- Notes with a title and text, **encrypted** in the database, behind their own
  **4-digit PIN**. After 5 wrong PINs it locks for 5 minutes, and it locks
  itself when you leave the app.
- Search, add, edit, delete. Deleted notes can be restored from
  "Deleted notes" or erased for good.
- Vault notes **never** appear on Home, in notifications or on a profile.

### Everything else
- **Home**: "Good evening, Name" in the header, one short tip from Satya, the
  streak card, then two tabs: **Categories** and **Reminders**.
- **Satya's tour**: shown once after sign-up (replay it from Settings). The
  real app stays visible but dimmed and untouchable, while a small Satya at
  the bottom explains each tab in a speech bubble, like a game tutorial.
- **Profile**: name, User ID, day streak, best streak, days done and badges.
- **Find friends**: search a friend's **User ID** to see their streak. Nobody
  can find you unless you turn on **"Let friends find me"** (off by default).
- **Settings**: account, accent color, motion, notifications, privacy, Vault
  PIN and auto-lock, Satya on/off, replay tour.
- **Auth**: login, register, forgot/reset password, change password.
- **Admin panel** (admin account only): users and app-wide stats. It never
  shows Vault content.

---

## 2. How it's built

### Backend (`Backend/`)
- **FastAPI + SQLAlchemy** on PostgreSQL (hosted on Supabase).
- **One folder per feature** in `app/modules/`: `auth`, `users`, `tracks`,
  `actions`, `streaks`, `achievements`, `reminders`, `vault`, `dashboard`,
  `admin`. Each has the same files: `models.py` (tables), `schemas.py`
  (request/response shapes), `service.py` (logic) and `router.py`
  (endpoints).
- **Streak engine**: `app/modules/streaks/engine.py`. It finalizes past
  days, counts today provisionally, and calculates bonuses.
- **Database changes go through Alembic migrations** (`Backend/alembic/`).
  The app no longer creates tables by itself.
- **Security**:
  - Passwords and the Vault PIN are hashed with Argon2.
  - Login uses short-lived JWT access tokens plus rotating refresh tokens.
  - The Vault uses its own short-lived token, sent in the `X-Vault-Token`
    header.
  - Vault content is encrypted with Fernet. The keys live in `.env`,
    never in the database.
  - Login, password reset and user search are rate-limited.
- **Background jobs** (`app/workers/reminder_worker.py`):
  - Sends due WhatsApp reminders.
  - Finalizes streaks every 15 minutes.
- **Tests**: `Backend/tests/` (36 tests: streak rules, the category table, anti-cheat, privacy,
  Vault security, password reset, reminders).

### Frontend (`MyApp/`)
- **React Native (not Expo)**, Android, New Architecture.
- **Redux Toolkit + RTK Query**: each feature has an `xApi.ts` file that
  talks to the backend.
- **Navigation lives in one file**: `src/navigation/RootNavigator.tsx`. It
  holds 5 tabs (Home, Routines, Reminders, Vault, Profile) plus the screens
  pushed on top of them.
- **Design system**: colors, spacing, typography and the 5 accent colors are
  defined once in `src/theme/index.ts`. Shared building blocks live in
  `src/components/` (Card, Button, TextField, Sheet, ProgressRing, Heatmap,
  PinPad, DateStrip…), so every screen looks the same.
- **Satya** (`src/modules/satya/`) renders the model in a WebView using
  Google's `model-viewer`, bundled offline. No internet is needed.
- **Notifications**: `react-native-notify-kit` schedules on-device
  notifications for reminders, actions and the evening streak warning.

---

## 3. Running it yourself

### Backend
```bash
cd Backend
cp .env.example .env              # then fill in real values (see below)
source myenv/bin/activate
pip install -r requirements.txt
alembic upgrade head              # create/upgrade the database tables
uvicorn app.main:app --reload
```

**`.env`** is never committed. `.env.example` explains every variable. The
important ones:
- `HOST`, `PORT`, `DATABASE`, `USER`, `PASSWORD`: the database. Required.
- `JWT_SECRET`: signs login tokens. Changing it logs everyone out.
- `VAULT_ENCRYPTION_KEYS`: encrypts the Vault. Generate one with
  `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
  > ⚠️ **Back this key up somewhere outside the database.** If it's lost,
  > every Vault entry is lost with it. To rotate it, put a new key **first**
  > and keep the old one after a comma.
- `MSG91_*`: optional. Without them, reminders still work as push
  notifications, just without WhatsApp.
- `SMTP_*` or `RESEND_*`: optional. Needed to email password-reset codes.
- `TRACK_BONUS_*`: tune the bonus for finishing a whole category.

Run the tests with `./myenv/bin/python -m pytest`. They need a separate test
database (see `tests/conftest.py`).

### Frontend
```bash
cd MyApp
npm install
npx react-native start            # Metro bundler, keep it running
npx react-native run-android      # in a second terminal
```

### Changing Satya's 3D model
Replace `MyApp/assets/models/model.glb` with any `.glb` file, ideally a rigged
character with an animation named "Idle", then **rebuild** the app
(`run-android`). A reload isn't enough, because the model is packaged into
the app. The current file is a placeholder cartoon figure.

---

## 4. What's verified

Tested live on an Android emulator:
- ✅ Home: header greeting, Satya tip, streak card, Categories / Reminders tabs
- ✅ Category table: add a task, tick today → "Did you do it today?" →
  celebration; the table, Home and Profile all update
- ✅ New category form (name + dates)
- ✅ Reminders: day strip with dots, add for another day, list per day
- ✅ Vault lock screen; Find friends search (a private ID isn't found)
- ✅ Profile, streak history calendar
- ✅ Satya's tour over the dimmed app (moves through the tabs; Skip / Done)
- ✅ Earlier: register flow, Vault PIN setup/unlock, encrypted notes,
  WhatsApp reminders through MSG91, migration with all data kept

Not yet tested on the device after the simplification: the unlocked Vault
list and note editor, renaming/deleting a task, Admin screens, password reset
by email.

## 5. Known quirks

- **Satya can take a few seconds to appear on the emulator**, which renders
  3D in software. Real phones are faster. If loading takes over 8 seconds,
  the orb stays.
- **Today counts right away once it's secured** (streak, totals and
  consistency %). It becomes permanent when the day ends. If you undo a
  completion the same day, it's taken back. Achievements are awarded when
  the day is finalized, not the moment it's secured.
- A WhatsApp number linked to the same account as the sending business
  number (`916304909776`) won't receive messages from it. This is a Meta-side
  restriction, not a bug.
- The `main` branch code expects the **old** database layout. After running
  this branch's migration, go back with `alembic downgrade` (or the backup in
  `db_backups/`) before running `main` again.
