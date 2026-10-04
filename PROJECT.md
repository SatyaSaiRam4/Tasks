# Rememberly — Consistency, Reminders & a Private Vault

A personal app that helps you **stay consistent with your goals**, **never
forget time-based things**, and **keep private notes safe**. It has a premium
dark design and a guide character called **Satya**.

It has two parts that run separately:
- **Backend**: a FastAPI server. It stores everything in a PostgreSQL database,
  decides streaks, and sends WhatsApp reminders.
- **MyApp**: a React Native app for Android. This is the app people use on
  their phone.

---

## 1. The main features

### Routines: Tracks and Actions
- A **Track** is a goal with a start and end date, e.g. "Gym, Oct 1 → Oct 30".
- Inside a Track you add **Actions**, the things you actually do, e.g.
  "Morning workout at 7:00 AM". An Action can repeat daily, weekly, every few
  days or once. It also has a priority, can be **required** or **optional**,
  and can send a reminder notification at its time.
- A date strip lets you look at any day. Only **today** can be completed:
  past days are locked and future days are preview-only, so nobody can
  back-fill or pre-fill.
- Completing an Action asks **"Did you actually complete this?"** before it
  counts. There's an optional "quick" mode in Settings that skips the question.

### Streaks: the honest part
- A day is **successful** when every *required* Action due that day is
  confirmed. Optional Actions never break a streak. A day with nothing
  required is a rest day: it neither extends nor breaks the streak.
- The **server** decides streaks, in the user's own timezone. The phone only
  displays them, so changing the phone's clock doesn't help.
- Once a day ends it is **finalized** and never rewritten. Editing or deleting
  an Action later doesn't change history.
- Finishing a whole Track perfectly earns **bonus points**. Longer Tracks
  earn more (configurable in `.env`).
- Missing a day resets the streak, with gentle wording ("start again
  tomorrow"), not guilt.
- Extras: a contribution-style **heatmap**, **achievements** (first step,
  3/7/14/30/100-day streaks, comeback, track finisher…), and a
  "streak at risk" warning in the evening.

### Reminders
- Anything with a date and time, later today or months away.
- A real push notification fires on the phone at that time, even if the app
  is closed.
- Optionally the backend also sends a **WhatsApp** message through MSG91.
- The list is grouped by date, with filters (Today / Tomorrow / This week…),
  search, complete, snooze and reschedule. A reminder can be linked to a
  Track.

### Vault: private notes
- Secrets, credentials and personal notes, **encrypted** in the database.
- Has its own **4-digit PIN**, separate from the login password. After
  5 wrong PINs it locks for 5 minutes. It also locks itself automatically
  (the delay is configurable).
- Folders, tags, favorites, pinning, archive and trash.
- Vault data **never** appears on the dashboard, in notifications or on a
  public profile.

### Everything else
- **Dashboard**: greeting, Satya, streak, today's progress ring, pending
  actions, active Tracks, upcoming reminders and the heatmap.
- **Satya**: a 3D character (a `.glb` model) on the onboarding tour and
  dashboard, with short contextual messages. If 3D can't load, a glowing
  "S" orb is shown instead.
- **Onboarding tour**: 9 short steps, shown once after sign-up. It can be
  skipped, and replayed from Settings.
- **Profile & Discover**: every user has a **User ID** (e.g. `ALEX_31372`).
  Others can look you up by it, but **only if you make your profile public**,
  and they only see what you allow (streak, best streak, achievements).
  Profiles are private by default.
- **Settings**: name, password, sign out (or sign out everywhere), accent
  color, animations and reduced motion, notifications, confirmation mode,
  privacy toggles, Vault auto-lock and PIN change, Satya on/off, replay tour.
- **Auth**: login, register, forgot password (a 6-digit code by email),
  reset password, change password.
- **Admin panel** (admin account only): user list and app-wide stats. It
  never shows Vault content.

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
- **Tests**: `Backend/tests/` (35 tests: streak rules, anti-cheat, privacy,
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
- `TRACK_BONUS_*`: tune the Track completion bonus.

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
- ✅ Register → Satya tour → dashboard (also replay tour, and skip tour)
- ✅ Satya's 3D model loads, with the orb fallback while loading
- ✅ Create a Track → add an Action → confirm completion → "streak started"
  celebration → dashboard, profile and history all update
- ✅ Reminders: create, list grouped by day, complete
- ✅ Vault: PIN setup with confirmation, encrypted entry, lock/unlock,
  wrong-PIN message with attempts left
- ✅ Discover: a private profile can't be found
- ✅ Settings, accent colors, consistency heatmap
- ✅ The existing database was migrated with all data kept: old categories
  became Tracks, tasks became Actions, notes moved into the Vault
- ✅ WhatsApp reminders through MSG91 (from before the redesign, unchanged)

Not yet re-tested since the redesign: Admin panel screens, password reset
by email, snooze/reschedule, Vault folders/archive/trash on the device.

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
