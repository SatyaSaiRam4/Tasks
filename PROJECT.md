# Memo

Memo is a personal routines and wellbeing app for organizing goals into
categories, completing scheduled tasks, building streaks, setting reminders,
and keeping private notes in an encrypted Vault. Satya is the in-app guide.

The workspace contains two separately run applications:

- `Backend/`: FastAPI service backed by PostgreSQL.
- `MyApp/`: React Native mobile client with Android and iOS native projects.

The app uses **Category** and **Task** in its interface. Backend code and API
models call these **Track** and **Action**, respectively.

## Features

### Categories and tasks

- Categories have a name and a start/end date. They group tasks around a goal.
- A new category's tasks are added on the same screen it is created on; more
  can be added later from the category. Tasks use daily recurrence.
  Backend task records and API schemas also support recurrence rules, optional
  times, priorities, descriptions, steps, and reminder settings.
- A category detail shows a task-by-day completion grid. Completions are
  editable for today; past days are retained as history.
- Completing a task requires confirmation. Settings offers Standard and Quick
  confirmation modes.
- Categories and tasks can be edited or deleted. Category date changes preserve
  already-finished days.

### Streaks and achievements

- The backend calculates streaks using the user's saved timezone. A day is
  secured when all required tasks due that day are complete; days with no
  required tasks do not extend or break a streak.
- Today's progress is provisional until the day is finalized. A background
  worker finalizes ended days and awards eligible achievements and category
  completion bonuses.
- The app includes streak history, achievement badges, and an optional local
  evening streak warning.
- Home shows the current streak beside a flame, the streak badges, and plain
  rows into today's categories and the next reminder.
- Streak badges are premium tiers earned by the best streak: Bronze (7
  days), Silver (30), Gold (100), Platinum (250), Diamond (500) and Master
  (1000). Tapping a badge shows its steps and progress. They are computed in
  the app from `best_streak`; Home and Profile show them.

### Wallet

- Streak milestones earn money once each: a 500-day streak earns ₹10 and a
  1000-day streak ₹20. Milestones use the best finalized streak, so they
  count only once the day has closed.
- The user redeems the whole balance by entering a mobile number. Each
  redemption is stored as PENDING and deducted from the balance at once;
  payouts are made by hand.

### Reminders and notifications

- Reminders have a title, optional note, date/time, priority, and optional link
  to a category. The Reminders tab supports date selection, completion,
  snoozing, editing, and deletion.
- Reminder, task, and streak-warning notifications are scheduled locally on
  the device. Android exact-time delivery may require the system's Alarms &
  reminders permission.
- A reminder can also be sent over WhatsApp through MSG91 when configured.
  WhatsApp delivery is independent of local notifications.

### Private Vault

- Vault entries are encrypted with Fernet before storage. The Vault requires a
  separate PIN and issues a short-lived Vault session token.
- Five failed PIN attempts trigger a five-minute lockout by default. The app
  locks the Vault on leaving the foreground, session expiry, or the selected
  inactivity timeout.
- Users can search, edit, soft-delete, restore, and permanently delete notes.
  Vault content is excluded from public profiles and notification bodies.
- The encryption key is not stored in the database. Losing all configured
  keys makes existing Vault entries unreadable; keep secure backups.

### Accounts, profiles, and settings

- Authentication includes registration, login, refresh-token rotation, logout,
  password changes, and password reset flows. Reset codes are emailed through
  Resend or SMTP (Gmail needs an App Password; ports 587 and 465 both work).
  With neither configured, codes are only printed to the server console. The
  reset screen can resend a code after 60 seconds. `SMTP_SERVER` and
  `SMTP_EMAIL` are accepted as aliases of `SMTP_HOST` and `SMTP_USER`. Check
  delivery with `python -m app.integrations.email you@example.com` (from
  `Backend/`), which prints the provider's real error.
- Profiles show a public User ID, current and best streaks, successful days,
  and achievements. Friends can be searched by User ID only when the account
  has enabled profile discovery; individual streak and achievement visibility
  can also be controlled in Settings.
- Settings include display name, light/dark theme, accent color, animation and
  reduced-motion controls, notification preferences, completion confirmation,
  profile visibility, Vault PIN and auto-lock, and Satya preferences/tour.
- Admin-only screens provide app statistics and user management. Admin routes
  do not provide access to Vault contents.

## Architecture

### Backend

- FastAPI app entry point: `Backend/app/main.py`; API routes are mounted under
  `/api/v1` by `Backend/app/api/router.py`.
- SQLAlchemy models and feature logic live in `Backend/app/modules/`: `auth`,
  `users`, `tracks`, `actions`, `streaks`, `achievements`, `reminders`,
  `vault`, `wallet`, `dashboard`, and `admin`.
- Database schema changes are managed by Alembic in `Backend/alembic/`. Apply
  migrations explicitly; application startup does not create tables.
- Authentication uses Argon2 password hashing, JWT access tokens, and rotating
  refresh tokens. Vault requests use a separate token in `X-Vault-Token`.
- Vault payloads are Fernet-encrypted. Login, password reset, and user search
  are rate-limited.
- `Backend/app/workers/reminder_worker.py` runs an in-process scheduler for
  WhatsApp delivery and streak finalization. Local push notifications are not
  sent by this worker.
- Health endpoints: `/health` and `/health/live` (process is up, no auth,
  no database) and `/health/ready` (also checks the database).

### Mobile app

- React Native 0.87, React 19, TypeScript, and the React Native New
  Architecture. Android and iOS native project files are present. Node.js
  22.11 or newer is required by `package.json`.
- Navigation and the five main tabs (Home, Categories, Reminders, Vault,
  Profile) are defined in `MyApp/src/navigation/RootNavigator.tsx`.
- Feature modules in `MyApp/src/modules/` include auth, home, routines,
  reminders, streaks, vault, profile, discover, settings, admin, onboarding,
  users, and Satya.
- Redux Toolkit and RTK Query manage client state and API requests. Shared API
  configuration is in `MyApp/src/api/baseApi.ts`; the backend URL is set in
  `MyApp/src/config/env.ts`. Release builds use the production backend
  (https://tasks-xxbg.onrender.com); debug builds use the local origin there
  while `USE_LOCAL_API` is true.
- The "Midnight & Champagne" design system lives in `MyApp/src/theme/`:
  `palette.ts` (brand colors, dark and light themes, accents),
  `typography.ts` (Cormorant Garamond display and Manrope UI type),
  `tokens.ts` (spacing, radius, motion, layout) and `index.ts` (the
  semantic `colors`, `gradients`, `type` and `shadow` tokens applied at
  startup). Reusable UI components are in `MyApp/src/components/`, the
  ambient backdrop in `MyApp/src/layouts/`, and shared motion in
  `MyApp/src/animations/`. Dark is the default theme.
- The bundled fonts are in `MyApp/assets/fonts` (SIL Open Font License),
  which Android packages as assets. iOS currently falls back to the system
  serif and sans until the fonts are added to the Xcode project.
- Phones use a floating tab bar, tablets a centered tab bar with two-column
  layouts, and desktop-width windows a navigation rail on the left. The tab
  bar or rail shows on every signed-in screen, including pushed screens; the
  phone bar hides while the keyboard is open.
- Every tab's top bar has the same actions: Search (find another user by
  User ID and see their shared streak), Wallet and Settings.
- The Memo logo lives in `MyApp/assets/images` as transparent PNGs cut from
  `Memo.png` (`memo-logo.png` full, `memo-mark.png` the "M" only), so it sits
  on either theme. Colourful "real" icons (`MyApp/src/components/RealIcon.tsx`)
  are used for the tab bar, streak, badges, wallet, reminders and Vault.
- Local notifications use `react-native-notify-kit`. `BackgroundSync` refreshes
  reminder/task alarms and the streak warning while signed in.
- Satya's model is rendered in a WebView from the mobile app's bundled assets.

## Setup

### Backend

Use Python 3.12 or another version supported by the pinned dependencies, and
provide a PostgreSQL database. From the repository root:

```bash
cd Backend
cp -n .env.example .env
# Edit .env with your database credentials and secrets.
source myenv/bin/activate   # or create and activate your own virtualenv
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The required database variables are `HOST`, `PORT`, `DATABASE`, `USER`, and
`PASSWORD`. Set a unique random `JWT_SECRET` in production. Configure
`VAULT_ENCRYPTION_KEYS` before using the Vault; generate a Fernet key with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The first comma-separated Vault key encrypts new data; all configured keys can
decrypt existing data, which supports key rotation. Back up keys securely
outside the database. `MSG91_*` enables optional WhatsApp sending. SMTP/Resend
variables configure email delivery; consult `.env.example` for all supported
settings. Set explicit production admin credentials with `ADMIN_NAME`,
`ADMIN_EMAIL`, and `ADMIN_PASSWORD`; do not use the example defaults.

Run backend tests only against a dedicated, disposable database. The test
harness truncates its tables between tests. Set `TEST_DATABASE_URL` to that
database before running:

```bash
TEST_DATABASE_URL="postgresql+psycopg2://user:password@localhost:5432/memo_test" \
  python -m pytest
```

The test database schema must be migrated before the run. The harness default
is a local database at `127.0.0.1:55432/rememberly_test`; never point it at a
production or personal data database.

### Mobile app

Set `API_BASE_URL` in `MyApp/src/config/env.ts` to reach the backend:

- Android emulator: default `http://10.0.2.2:8000/api/v1`.
- iOS simulator: `http://localhost:8000/api/v1`.
- Physical device: use the development machine's LAN address and start the
  backend with `--host 0.0.0.0`.

From `MyApp/`, install dependencies and start Metro:

```bash
npm install
npm start
```

In a second terminal, run a native target:

```bash
npm run android
# or
npm run ios
```

iOS builds require Xcode and CocoaPods dependencies. From `MyApp/`, run
`bundle install`; then install pods from `MyApp/ios/` with
`bundle exec pod install` when setting up or changing native dependencies.

## Tests and checks

From `Backend/`, run `python -m pytest` with a dedicated `TEST_DATABASE_URL`.
From `MyApp/`, run `npm test` for Jest tests and `npm run lint` for ESLint.

## Important operational notes

- Keep real credentials in `Backend/.env`; do not commit them. The example
  admin password and default JWT secret are not suitable for production.
- Back up `VAULT_ENCRYPTION_KEYS` separately from the database. Database
  backups alone cannot recover Vault content if every key is lost.
- The backend worker runs inside each API process. Deploy a single worker
  instance, or otherwise ensure multiple API processes do not duplicate
  scheduled WhatsApp sends.
- On Android 12 and later, exact local reminder delivery may require granting
  the app the system-level Alarms & reminders permission.
