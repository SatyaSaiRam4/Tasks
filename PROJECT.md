# Memo

Memo is a personal routines and wellbeing app for organizing goals into
plans, completing scheduled tasks, building streaks, setting reminders,
and keeping private notes in an encrypted Vault. Melo is the in-app guide.

The workspace contains two separately run applications:

- `Backend/`: FastAPI service backed by PostgreSQL.
- `MyApp/`: React Native mobile client with Android and iOS native projects.

The app uses **Plan** and **Task** in its interface. Backend code and API
models call these **Track** and **Action**, respectively (older code and
component names still say "category", e.g. `CategoryCard`).

## Features

### Plans and tasks

- Plans have a name and a start/end date. They group daily tasks around a goal.
- The Plans tab shows today's progress across all plans, then one list of
  plans (active first; each card says Day X of Y, Starts soon or Finished).
  With no plans it shows a three-step "How it works" guide.
- A plan is made in two steps: the editor takes its name (with quick ideas)
  and length (7/21/30/90-day presets or dates), then the new plan opens ready
  to add its daily tasks ("step 2"). Tasks use daily recurrence.
  Backend task records and API schemas also support recurrence rules, optional
  times, priorities, descriptions, steps, and reminder settings.
- A plan's screen shows an overview (today's ring, day X of Y, dates), then
  its tasks date by date (tasks down the side, days across, today's column in
  gold to tick) with a legend, then the add-task box. Edit and delete are
  header icons. Completions are editable for today; past days are retained.
- Completing a task requires confirmation. Settings offers Standard and Quick
  confirmation modes.
- Plans and tasks can be edited or deleted. Plan date changes preserve
  already-finished days.

### Streaks and achievements

- **Streak points (current rule):** each finished day, every plan whose due
  tasks were all done adds 1; every plan with something due but not finished
  takes 1 away; the score never goes below 0. Today's finished plans count
  straight away, missed ones only when the day ends. `best_streak` is the
  highest score reached; the wallet and badges use it, so a deduction never
  takes money back. Implemented in `Backend/app/modules/streaks/engine.py`.
- Limits: 10 running plans per account, 15 tasks per plan (enforced by the
  API). A task may have its own end date inside its plan's period.

- The backend calculates streaks using the user's saved timezone. A day is
  secured when all required tasks due that day are complete; days with no
  required tasks do not extend or break a streak.
- Today's progress is provisional until the day is finalized. A background
  worker finalizes ended days and awards eligible achievements and plan
  completion bonuses.
- The app includes streak history, achievement badges, and an optional local
  evening streak warning.
- Home shows only three things: the streak count under a flame, centered; a
  "My plans" card listing active and upcoming plans (tap one to open it); and
  a "Next reminder" card with its date and time. Each card's arrow opens its
  tab. Badges are on Profile.
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
  to a plan. The Reminders tab supports date selection, completion,
  snoozing, editing, and deletion.
- A reminder can "Ring like an alarm" (`alarm_enabled`): a full-screen,
  looping alarm with a Stop button that stops by itself after 10, 30 or 60
  seconds. The sound (Classic, Chime, Digital, Gentle) and length are chosen
  per device in Settings, which also has "Test alarm". Sounds are WAV files in
  `MyApp/android/app/src/main/res/raw`; each has its own Android channel
  because Android fixes a channel's sound. iOS uses its default sound.
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
  profile visibility, Vault PIN and auto-lock, and Melo preferences/tour.
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
- Navigation and the five main tabs (Home, Plans, Reminders, Vault,
  Profile) are defined in `MyApp/src/navigation/RootNavigator.tsx`.
- Feature modules in `MyApp/src/modules/` include auth, home, routines,
  reminders, streaks, vault, profile, discover, settings, admin, onboarding,
  users, and Melo.
- Redux Toolkit and RTK Query manage client state and API requests. Shared API
  configuration is in `MyApp/src/api/baseApi.ts`; the backend URL is set in
  `MyApp/src/config/env.ts`. Release builds use the production backend
  (https://tasks-singapore.onrender.com); debug builds use the local origin there
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
- Melo's model is rendered in a WebView from the mobile app's bundled assets.
  The GLB is a glove puppet with no skeleton or animations, so
  `assets/web/satya/index.html` animates it as a whole: an idle sway and
  breath, plus gestures (`talk`, `wave`, `hop`, `nod`, `spin`, `lookLeft`,
  `lookRight`, `cheer`) the app triggers through `SatyaModel`'s `gesture`
  prop. Turning orbits the camera, because the model's origin is off-center.
- New users first see a welcome story (`modules/onboarding/WelcomeStory.tsx`):
  two stories of Aarav and his mom play one after the other in two 3D panels
  (three.js, `web/story`). Story 1, days ahead: Mom forgets to sign the
  school-trip form and the bus leaves without him. Story 2, months ahead: she
  forgets the art school admissions. Melo arrives; Mom tells Memo, both
  reminders ring on the day, Aarav boards the bus and gets into art school.
  Flat illustrated panels are the fallback. It plays once per account on a
  device, then Melo's tour runs; both replay from Settings.
- Melo's tour has nine steps with a title, typed-out text and a gesture
  each, plus Back and Skip.
- Loading speed: RTK Query keeps data for 5 minutes after a screen closes
  (`keepUnusedDataFor` in `baseApi.ts`), so revisited screens open from cache
  while refetching. Plan cards prefetch the plan on press-in, and the plan
  screen shows its header from the list cache before its own request lands.

### Nginx

- `deploy/nginx/nginx.conf` puts Nginx in front of uvicorn: keep-alive
  upstream connections, gzip, timeouts and a 2 MB body limit. API responses
  are per-user and are never cached (`Cache-Control: no-store`).
- `deploy/docker-compose.yml` runs `api` (built from `Backend/Dockerfile`,
  reading `Backend/.env`, running `alembic upgrade head` on start) and `nginx`
  on port 80: `cd deploy && docker compose up -d --build`. Add TLS with the
  commented 443 block. Keep a single `api` container (see operational notes).
- On Render, Render's own proxy already sits in front of the app, so this
  setup is for a VPS. The FastAPI app also gzips responses over 1 KB itself.
  Render's free plan sleeps after inactivity and the first request then takes
  up to about a minute; an uptime monitor on `/health` or a paid plan avoids
  that, Nginx cannot.

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

## Daily cleanup and keep-awake

- `POST /api/v1/maintenance/cleanup` (header `X-Cron-Secret`) settles every
  user's streak points, then deletes plans and tasks 7 days after their end
  date (or after deletion) and reminders 7 days after they were marked done.
  The Vault is never touched. Off unless `CRON_SECRET` is set on the server.
- `.github/workflows/daily-cleanup.yml` calls it every day at 02:00 IST;
  `.github/workflows/keep-awake.yml` pings `/health/ready` every 10 minutes so
  Render and the database stay awake. Both need the repository secrets
  `API_URL` and (cleanup only) `CRON_SECRET`.
- The welcome story's 3D stage is built from `MyApp/web/story/story.js` with
  `npm run build:story` (three.js, bundled to `assets/web/story`).

## Appearance and defaults

- New installs start in the light theme. Changing the theme or accent restarts
  the app's JavaScript in place (Android `AppReloadModule`, about half a
  second) and reopens Settings, because screen styles are built at start-up.
  On iOS release builds the change applies the next time the app opens.
- New accounts use Quick (one-tap) completion confirmation.
- Alarm channels are named `memo-alarm-v2-<sound>`; older `alarm-*` channels
  are deleted at start-up, since Android keeps a channel's first sound forever.
- Reminders: pick a day on the date strip (today by default) or the calendar;
  the All / Sent / Failed / Done tabs filter that day.
- Home's streak card also shows the six badges in one row.
- The guide is called Melo (code and settings keys still say `satya`).

## Speed

- The app keeps a copy of its last-loaded data on the device
  (`MyApp/src/api/persistCache.ts`; never Vault or admin data, tied to the
  user, removed on logout). Screens open with it at once and refresh in the
  background. Wallet and streak data are prefetched after sign-in.
- The API tests a pooled database connection only after it has been idle for
  60 s (`Backend/app/db/session.py`), instead of on every request.
- Theme changes lay a snapshot of the screen over the app while it restarts
  underneath, and fade it out once Settings is drawn, so nothing flickers.
- The biggest remaining cost is distance: the database is in Mumbai, so the
  Render service should run in Singapore.

## Reminders, Vault and feedback

- A reminder moves to Done by itself once its time has passed (the server's
  reminder worker marks it, after any WhatsApp send); there is no tick box.
  Tabs: All, Upcoming, Done, Failed. The server also runs the daily cleanup
  itself at 02:00 IST (done reminders and ended plans 7 days later), in
  addition to the GitHub Actions job.
- Vault: All notes (grouped by day) or By date (date strip and calendar).
  Deleting a note moves it to the bin (icon beside the lock); it can be
  restored or deleted for good from there, and the daily cleanup deletes bin
  notes after 30 days (`VAULT_BIN_DAYS`). Notes outside the bin are never
  touched.
- Ticking a task shows a spinner in its box until the server confirms; the
  tick then appears at once. Reaching a new badge shows a one-time
  congratulations. Bottom sheets are drawn in the main window
  (`components/SheetHost.tsx`), not in a Modal, so they rise above the
  keyboard (a Modal's own Android window never hears keyboard events).

## Messages

Three ways Memo reminds, each worded for what it is:

| | Where | Example |
|---|---|---|
| Notification (free) | This phone, quietly | **🔔 Call the electrician** · 6:30 PM · Bring the warranty card |
| Alarm (free) | This phone, loud, until Stop | **⏰ Call the electrician** · It's 6:30 PM. Bring the warranty card. Press Stop when you're on it. |
| WhatsApp (premium) | Any number, even with the phone off or the app uninstalled | A personal message with the name, the reminder, date and time, and the note |

Task notifications read **✅ Walk 20 minutes** · Time for this task in
"Fitness". Tick it in Memo when it's done. The 8 PM streak warning reads
**🔥 2 tasks left today** · Finish them before midnight to keep your streak
growing. A plan left unfinished costs 1 point.

WhatsApp uses an approved MSG91 template. `MSG91_WHATSAPP_TEMPLATE_STYLE`
picks the shape (`Backend/app/integrations/messages.py`):

- `single` (default, the original template): one variable {{1}}, e.g.
  `⏰ Call the electrician · Sat, 10 Oct at 6:30 PM · 📝 Bring the warranty card`.
- `detailed`: three variables, for this template (category Utility).
  Header (text, no emoji or formatting): `Memo reminder`. Body:

  ```
  Hi {{1}}, this is your reminder from Memo.

  It's time for: *{{2}}*

  🗓 When: {{3}}

  You set this reminder in the Memo app. Open the app to snooze or change it.
  ```

  Footer: `Sent by Memo.`

  Sample values: `Satya`, `Call the electrician`, `Sat, 10 Oct at 6:30 PM`. Create and get it approved in MSG91, set
  `MSG91_WHATSAPP_TEMPLATE_NAME` to its name and
  `MSG91_WHATSAPP_TEMPLATE_STYLE=detailed` on Render.
