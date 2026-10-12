# Memo

Memo is a mobile app that helps people **remember what matters and keep
going with their goals**. It combines four things that usually live in
separate apps:

- **Reminders** that arrive right on the day, even months ahead, as a
  notification, a loud alarm, or a WhatsApp message to any number.
- **Plans** (goals with an end date) made of small daily **tasks**.
- **Streaks and badges** that reward keeping at it, with real-money rewards
  at the top.
- A **private Vault** for notes, voice notes and photos, behind its own PIN.

Melo, a friendly puppet, is the in-app guide.

This document explains what the app does, how it is built, and how to run,
test, deploy and look after it.

---

## Contents

1. [Repository layout](#1-repository-layout)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Key rules and how they work](#4-key-rules-and-how-they-work)
5. [Data model](#5-data-model)
6. [API reference](#6-api-reference)
7. [Configuration](#7-configuration)
8. [Running locally](#8-running-locally)
9. [Tests and checks](#9-tests-and-checks)
10. [Deployment](#10-deployment)
11. [Operations and security](#11-operations-and-security)
12. [Troubleshooting](#12-troubleshooting)
13. [Before publishing to the stores](#13-before-publishing-to-the-stores)
14. [Glossary](#14-glossary)

---

## 1. Repository layout

```
Tasks/
├── Backend/                 FastAPI + PostgreSQL API
│   ├── app/
│   │   ├── main.py          App entry point (lifespan, middleware, health)
│   │   ├── api/router.py    Mounts every module under /api/v1
│   │   ├── core/            Config, security (JWT, Argon2), deps, rate limits
│   │   ├── db/              Engine, sessions, model registry
│   │   ├── integrations/    Email (Resend/SMTP), WhatsApp (MSG91), messages
│   │   ├── modules/         One folder per feature (models, schemas, service, router)
│   │   └── workers/         In-process scheduler (reminders, streaks, cleanup)
│   ├── alembic/             Database migrations
│   ├── tests/               pytest suite (needs a throwaway PostgreSQL)
│   ├── Dockerfile
│   └── requirements*.txt
├── MyApp/                   React Native app (Android and iOS)
│   ├── src/
│   │   ├── api/             RTK Query base API and on-device cache
│   │   ├── app/             Redux store, hooks, preferences
│   │   ├── components/      Shared UI (buttons, cards, sheets, icons, …)
│   │   ├── modules/         One folder per feature (screens + API slices)
│   │   ├── navigation/      Root stack and tabs
│   │   ├── notifications/   Local notifications and alarms
│   │   ├── theme/           "Midnight & Champagne" design system
│   │   ├── widget/          Android home-screen widget bridge
│   │   └── config/env.ts    Backend URL
│   ├── web/story/           Source of the 3D welcome story (three.js)
│   ├── assets/              Fonts, images, Melo's model, built web pages
│   ├── android/  ios/       Native projects
│   └── __tests__/           Jest tests
├── deploy/                  Optional Nginx + Docker Compose for a VPS
├── .github/workflows/       Daily cleanup and keep-awake jobs
└── PROJECT.md               This document
```

---

## 2. Features

### 2.1 Home

Home is the first tab. It shows:

- **The streak card:** today's points (`+n`), the streak number under an
  animated flame, the best streak, the six streak badges in a row, and a
  link to the Wallet.
- **My plans:** active and upcoming plans (`n / 10`); tap one to open it.
- **Next reminder:** its title, date and time.

Home is also where new **badges are revealed** and where congratulations
for achievements and finished plans appear (see [4.2](#42-badges-and-the-home-reveal)).

### 2.2 Plans and tasks

- A **plan** has a name and a start and end date (7, 21, 30 or 90-day
  presets, or custom dates). It groups the daily tasks for one goal.
- A plan is made in two steps: name and length first, then the new plan
  opens ready for its tasks.
- **Tasks** repeat daily inside the plan's period. A task may end earlier
  than its plan.
- A plan's screen shows today's progress ring, "Day X of Y", then a grid of
  its tasks by date (today's column in gold to tick), and the add-task box.
- **Ticking a task:** in *Quick* mode (the default) one tap ticks it; in
  *Standard* mode the app asks "Did you do it today?" first. Only today can
  be ticked; past days are locked, which keeps streaks honest.
- **Limits:** 10 running plans per account, 15 tasks per plan.
- Changing a plan's dates keeps the days already finished.

### 2.3 Streaks, badges and achievements

- **Streak points:** at the end of each day, every plan whose tasks for that
  day were all done adds **1 point**; every plan that had something due but
  wasn't finished takes **1 point** away. The score never goes below 0.
  Plans finished *today* count straight away; missed ones only when the day
  ends. Days are judged in the user's own timezone.
- **Best streak** is the highest score ever reached. Badges and the Wallet
  use it, so a bad day never takes a badge or money away.
- **Celebrations:** finishing one plan for the day shows "Congrats! You
  earned 1 streak"; finishing every plan for the day shows "Day complete".
- **Streak badges** (by best streak): Bronze 7, Silver 30, Gold 100,
  Platinum 250, Diamond 500, Master 1000. Tap a badge to see its steps and
  progress. Home and Profile show them.
- **Achievements** (for example a first finished plan) are awarded by the
  server and congratulated on Home.
- **Streak history:** a six-month calendar (the weekday labels stay fixed
  while the weeks scroll sideways), finished plans, and an optional 8 PM
  warning when today's tasks are still open.
- **Plan bonus:** when a plan reaches its end date, a bonus may be added to
  the consistency score depending on its length and how much was done
  (`TRACK_BONUS_*` settings).

### 2.4 Wallet

- Streak milestones pay once each: **₹10 at a best streak of 500** and
  **₹20 at 1000**. Milestones count once the day has finished.
- "To go" uses the same number as the dashboard (today's finished plans
  included) and refreshes after every tick.
- The user redeems by entering a mobile number. Each redemption is saved as
  *PENDING* and taken off the balance at once; **payouts are made by hand**.

### 2.5 Reminders, alarms and WhatsApp

- A reminder has a title, an optional note, a date and time, a priority and
  an optional link to a plan.
- The Reminders tab shows one day at a time: pick it on the day strip (the
  selected day always scrolls into view) or from the calendar. Tabs:
  **Upcoming** (default), **Done**, **Failed**, **All**.
- A reminder **moves to Done by itself** once its time has passed. It can be
  snoozed (1 hour, tomorrow), edited or deleted.
- **Three ways to be reminded:**

  | | Where | Example |
  |---|---|---|
  | Notification (free) | This phone, quietly | 🔔 **Call the electrician** · 6:30 PM · Bring the warranty card |
  | Alarm (free) | This phone, loud, until Stop | ⏰ **Call the electrician** · It's 6:30 PM… Press Stop when you're on it. |
  | WhatsApp (premium) | Any number, even with the phone off | A personal message with the name, reminder, date and time |

- **"Ring like an alarm"** shows a full-screen, looping alarm with a Stop
  button that stops by itself after 10, 30 or 60 seconds. The sound
  (Classic, Chime, Digital, Gentle) and length are set per phone in
  Settings, which also has *Test alarm*.
- Task notifications read ✅ **Walk 20 minutes** · Time for this task in
  "Fitness". The 8 PM streak warning reads 🔥 **2 tasks left today**.

### 2.6 Private Vault

- Notes with a title, text, an optional **voice note** (up to about 4
  minutes) and up to **6 photos** (camera or gallery, up to 10 MB each, for
  ID cards, documents and so on).
- Everything is **encrypted on the server**; photos are loaded into memory
  only and never written to the phone's image cache.
- The Vault has its **own 4-digit PIN**. Five wrong PINs lock it for five
  minutes.
- **Forgot PIN?** on the lock screen: enter the Memo account password and
  choose a new PIN. Notes are kept (they are encrypted with the server's
  key, not the PIN), and the owner gets an email that the PIN was reset.
- **Auto-lock:** after the chosen time of inactivity (1, 5, 15, 30 minutes
  or never), and whenever the app goes to the background. Opening the
  camera, the gallery or the microphone permission does not lock it.
- **Views:** all notes grouped by day, or by date with a day strip and
  calendar; search; the **bin** (deleted notes can be restored for 30 days,
  then are deleted for good).

### 2.7 Profile, friends and photos

- Every user has a public **User ID** (for example `SATYASAI_4F2K9`).
- **Profile photo:** tap the picture at the top right of any tab for the
  menu: add, change or remove the photo (up to 10 MB), then **Find a
  friend**, **Wallet** and **Settings**.
- **Find a friend:** search by User ID to see their streak, best streak,
  badges and photo, only if they have made their profile public. Each part
  (current streak, best streak, achievements, photo) can be hidden in
  Settings → Privacy.
- Profile shows the user's own stats and badges.

### 2.8 Settings

| Section | What's there |
|---|---|
| Why Memo? (card at the top) | How Memo compares with a phone alarm and to-do apps |
| Account | Display name, profile photo, User ID, email, change password |
| Appearance | Light or dark theme, accent colour, animations, reduced motion, **tap sound** (off by default) |
| Notifications | Reminders, streak warnings, achievements, exact-alarm permission |
| Alarm | Alarm sound and length, test alarm |
| Streak | Completion confirmation (Quick or Standard), the streak rules |
| Privacy | Public profile and what it shows (streaks, achievements, photo) |
| Vault | Change PIN, auto-lock time |
| Melo | Melo's tips on Home, replay the tour, watch the story |

Changing the theme or accent restarts the app's JavaScript in place (about
half a second, with a snapshot laid over the screen so nothing flickers),
because screen styles are built when the app starts. New installs start in
the **light** theme.

### 2.9 Welcome story, tour and Melo

- **Welcome story** (shown once after the first sign-in, replayable from
  Settings). It plays in 3D with captions and speech bubbles; phones that
  can't run 3D get the same story as illustrated scenes.
  - **Part 1 (plays by default):** Aarav asks Mom to remind him of Grandma's
    birthday in 2 days; two busy days pass and she forgets. Melo arrives:
    tell Memo once, days or months ahead. This time Mom saves it; on the
    day Memo reminds her (and sends Papa a WhatsApp), and Aarav video-calls
    Grandma. It ends on the feature list.
  - **Part 2 (optional, "▶ Part 2" at the top right of the last slide):** a
    new cast, Satya and his friend Riya. Satya turns getting fit into a
    plan; he jogs as his tasks tick, his streak climbs to 7, he earns the
    Bronze badge, and coins rain for real-money rewards. Then he shows his
    private Vault, whose padlock springs open with his PIN.
  - Slides move on by themselves; tap right for next, left for back, or Skip.
- **Melo on Home** (`MeloCorner.tsx`, `web/satya/melo.js`, built with
  `npm run build:melo`): he arrives as a ball in his own robe red that rolls
  in from one side and flips open in a burst of gold, red and white stars
  with a ripple across the floor; he pops out and strolls off, turns his
  face to you mid-walk, blushes (soft pink, steam puffs) and dashes off the
  screen in a kick of dust; then, Chopper-style, he leans back in from the
  edge with half of him showing and a sweat drop to check whether you're
  still watching (twice; a tap finds him) and comes back to give his tip in
  a speech bubble. A tap at any time makes him blush with red hearts.
  Particles have darker edges so they show on the light and dark themes. He also reacts to the user's
  day (proud, worried, sleepy). Check it in a browser: serve `MyApp/assets`
  and open `web/satya/index.html?mode=stroll&at=40&hold=peek&f=0.5`
  (`at` fast-forwards; `hold` freezes a phase).
- **Melo's tour:** nine short steps (making a plan, adding tasks, ticking,
  streak points, rewards, reminders, the Vault) with typed-out text and a
  gesture each, plus Back and Skip.

### 2.10 Why Memo?

Settings → **Why Memo?** compares Memo with a phone's Clock app and typical
to-do apps (Google Tasks, Microsoft To Do, Todoist, TickTick) in a small
diagram and a yes / some / no table. It was checked in October 2026; keep it
honest and update it if those apps change.

### 2.11 Android home-screen widget

Shows the streak, today's tasks and the next reminder; tap to open Memo.
Nothing from the Vault is shown. Add it with a long press on the home
screen → Widgets → Memo.

### 2.12 Admin

Admin accounts see app statistics and can disable, enable or change the role
of users. Admin screens never give access to anyone's Vault.

---

## 3. Architecture

### 3.1 Overview

```
 ┌─────────────────────────── Phone ───────────────────────────┐
 │  React Native app (TypeScript, Redux Toolkit + RTK Query)    │
 │   • screens and components     • on-device cache (no Vault)  │
 │   • local notifications/alarms • Android widget + natives    │
 │   • WebViews: Melo (3D) and the welcome story (three.js)     │
 └───────────────▲─────────────────────────────────────────────┘
                 │ HTTPS, JSON (+ multipart for photos/voice)
                 │ Authorization: Bearer <access token>
                 │ X-Vault-Token: <vault session>   (Vault only)
 ┌───────────────┴──────── Render (Singapore) ─────────────────┐
 │  FastAPI app (uvicorn), /api/v1                             │
 │   • modules: auth, users, tracks, actions, streaks,          │
 │     achievements, reminders, vault, wallet, dashboard,       │
 │     admin, maintenance                                       │
 │   • in-process worker: WhatsApp sends, reminders → Done,     │
 │     streak finalising, daily cleanup                         │
 └──────┬───────────────────────────┬──────────────────────────┘
        │ SQLAlchemy                │ HTTPS
 ┌──────▼──────────────┐   ┌────────▼───────────────────────────┐
 │ PostgreSQL          │   │ MSG91 (WhatsApp)  Resend/SMTP (mail)│
 │ (Supabase, Mumbai)  │   └────────────────────────────────────┘
 └─────────────────────┘
 GitHub Actions: daily cleanup call (02:00 IST), keep-awake ping (every 10 min)
```

### 3.2 Backend

| Part | Details |
|---|---|
| Stack | Python, FastAPI 0.141, SQLAlchemy 2.0, Alembic 1.20, Pydantic 2, uvicorn |
| Entry point | `Backend/app/main.py`; every feature router is mounted under `/api/v1` by `app/api/router.py` |
| Health | `/health` and `/health/live` (process is up, no database), `/health/ready` (also checks the database) |
| Modules | `app/modules/<feature>/` each with `models.py`, `schemas.py`, `service.py` (the logic) and `router.py` (the HTTP layer) |
| Database | PostgreSQL. Schema changes only through Alembic migrations; the app never creates tables itself |
| Passwords | Argon2 hashing |
| Sessions | Short-lived JWT access token + rotating refresh tokens (`refresh_sessions` table), logout and logout-everywhere |
| Vault | A second, short-lived token (`X-Vault-Token`) issued after the PIN; renewed while the Vault is in use |
| Encryption | Vault text, voice notes and photos are encrypted with Fernet (AES + HMAC) using `VAULT_ENCRYPTION_KEYS`, which live in the environment, never in the database |
| Rate limits | Login, password reset, user search, Vault unlock and PIN reset |
| Email | `app/integrations/email.py`: Resend or SMTP (password-reset codes, Vault PIN reset notice) |
| WhatsApp | `app/integrations/` MSG91 with an approved template (see [7.3](#73-whatsapp-template)) |
| Worker | `app/workers/reminder_worker.py` runs inside the API process: sends due WhatsApp reminders, moves passed reminders to Done, finalises ended days for streaks and awards achievements and plan bonuses, and runs the daily cleanup at 02:00 IST |

**Backend modules**

| Module | Responsibility |
|---|---|
| `auth` | Users, registration, login, tokens, password change and reset |
| `users` | Profile, settings, public profiles and search, profile photos, onboarding flags |
| `tracks` | Plans: create, edit, archive, the date grid |
| `actions` | Tasks, the daily agenda, ticking and unticking |
| `streaks` | The streak engine (`engine.py`): points, finalising days, history, plan completions |
| `achievements` | Achievement catalogue and awarding |
| `reminders` | Reminders, snooze, complete, WhatsApp scheduling |
| `vault` | PIN, sessions, encrypted notes, voice notes, photos, bin |
| `wallet` | Milestones, balance, redemptions |
| `dashboard` | One call with everything Home needs |
| `admin` | Statistics and user management |
| `maintenance` | The daily cleanup endpoint |

### 3.3 Mobile app

| Part | Details |
|---|---|
| Stack | React Native 0.87 (New Architecture, Hermes), React 19, TypeScript, Node ≥ 22.11 |
| State and data | Redux Toolkit + RTK Query. `src/api/baseApi.ts` adds the tokens, refreshes an expired session once, and locks the Vault if the server says so. Data is kept 5 minutes after a screen closes |
| On-device cache | `src/api/persistCache.ts` keeps the last data per user (never the Vault or admin data) so screens open instantly and refresh in the background; cleared on logout |
| Backend URL | `src/config/env.ts`: release builds use `https://tasks-singapore.onrender.com`; debug builds use the local address when `USE_LOCAL_API` is true |
| Navigation | `src/navigation/RootNavigator.tsx`: five tabs (Home, Plans, Reminders, Vault, Profile) inside a root stack with the pushed screens (plan detail and editor, reminder editor, Vault note, streak history, find a friend, settings, Why Memo?, wallet, change password, admin) |
| Layout | Phones: floating tab bar. Tablets: centred tab bar and two columns. Wide windows: a navigation rail |
| Design system | `src/theme/` "Midnight & Champagne": `palette.ts` (colours, light and dark themes, accents), `typography.ts` (Cormorant Garamond for display, Manrope for UI), `tokens.ts` (spacing, radius, motion), `index.ts` (applied once at start-up, before any screen is created) |
| Bottom sheets | Drawn in the main window by `components/SheetHost.tsx` (not a Modal). A sheet with a focused text field moves to the top, clear of the keyboard |
| Notifications | `react-native-notify-kit`: reminders, task reminders, the streak warning and alarms, scheduled on the phone. `BackgroundSync` keeps them up to date while signed in |
| Native modules (Android) | `AppReloadModule` (in-place restart for theme changes), `MemoWidgetModule` + `MemoWidgetProvider` (widget), `TapSoundModule` (tap click) |
| Media | `react-native-nitro-sound` (voice notes), `react-native-image-picker` (photos) |
| 3D | Melo is a GLB model in a WebView (`assets/web/satya/`). The welcome story is `web/story/story.js` (three.js), bundled into `assets/web/story/` with `npm run build:story` |

**App feature modules (`src/modules/`)**

| Folder | Contents |
|---|---|
| `home` | Dashboard, background sync |
| `routines` | Plans and tasks screens, the completion flow and its celebrations |
| `streaks` | Streak history, badges (`Tiers.tsx`), the Home queue for achievement cards |
| `reminders` | Reminders list and editor |
| `vault` | Lock screen, forgot PIN, notes, voice notes, photos, auto-lock |
| `profile`, `discover`, `users` | Profile, find a friend, account and photo menu |
| `wallet` | Wallet screen |
| `settings` | Settings, Why Memo?, change password |
| `onboarding` | Welcome story, Melo's tour, character drawings |
| `satya` | Melo's 3D model view (the folder keeps Melo's old name) |
| `admin` | Admin screens |
| `auth` | Sign-in, sign-up, forgot and reset password |

### 3.4 How a typical action flows

**Ticking a task:**
1. The app sends `POST /actions/{id}/complete`.
2. The server records the tick, recomputes today's streak, and replies with
   the new streak, whether a plan or the whole day was just finished, and any
   new achievements.
3. The app shows "+1 streak" or "Day complete" right away. Achievements and
   new badges wait for Home.
4. RTK Query refreshes the screens that depend on it (agenda, plans, streak,
   dashboard, profile, wallet).

**Opening a Vault note:**
1. The PIN is sent to `POST /vault/unlock`, which returns a Vault session
   token kept in memory only.
2. Every Vault request carries `X-Vault-Token`; the server decrypts on the
   fly and replies with `Cache-Control: no-store`.
3. While the Vault is in use, the app renews the session (`POST
   /vault/refresh`); after the inactivity time, or when the app goes to the
   background, it drops the token.

---

## 4. Key rules and how they work

### 4.1 Streak engine

`Backend/app/modules/streaks/engine.py`

- Finished days are *finalised* by the worker (and before any streak
  read): for each plan with required tasks due that day, +1 if all were
  done, −1 if not, never below 0.
- Today's finished plans are added straight away (provisional); today's
  misses are only counted when the day is over.
- `best_streak` only grows. Wallet payouts use the finalised best streak, so
  ticking and unticking today can't mint money.

### 4.2 Badges and the Home reveal

`MyApp/src/modules/streaks/Tiers.tsx`, `DashboardScreen.tsx`

- A newly reached badge **stays locked everywhere** (Home, Profile) until
  the first time Home is on screen afterwards.
- On that visit, once no other card is open, Home scrolls the streak card
  into view and the locked badge comes to life: two heartbeats, a growing
  tremble and glow, then it breaks open with a flash, sparks and a short
  vibration, becomes the gold medal and settles. Then the "Congrats! You've
  upgraded to Bronze" card opens.
- What counts as revealed is what **this phone** has shown (saved on the
  phone as `@memo/badge_revealed_v3_<user>`). The server's
  `user_settings.badge_seen` is also written, for the record.
- If the best streak goes down (only when test data is reset), the record
  follows, so reaching the badge again reveals it again.
- Achievement cards earned on other screens are queued for Home
  (`homeQueue.ts`); the "Plan finished" card waits for any reveal.
- The rule is the pure function `badgeState()`, tested in
  `MyApp/__tests__/badges.test.ts`.

### 4.3 Vault session

`MyApp/src/modules/vault/VaultAutoLock.tsx`

- Taps, typing, recording and uploads count as activity.
- With under 2 minutes left on the server session and activity in the last
  minute, the app swaps the session for a fresh one.
- `keepVaultOpenWhile()` wraps the camera, gallery and microphone
  permission, which briefly leave the app, so they don't lock it.

### 4.4 Privacy

- Profiles are private by default; a private profile and a missing one
  return the same 404, so User IDs can't be probed.
- Profile photos are served only to signed-in users, and to others only if
  the profile is public and "Show profile photo" is on.
- Vault content never appears in lists, notifications, the widget, admin
  screens or the on-device cache.

---

## 5. Data model

Main tables (PostgreSQL):

| Table | Holds |
|---|---|
| `users` | Account, display name, public ID, timezone, profile photo (`photo`, `photo_mime`, `photo_version`), role |
| `user_settings` | Theme-independent preferences: confirmation mode, notifications, privacy switches, Vault auto-lock, Melo, `tap_sound`, `badge_seen` |
| `refresh_sessions`, `password_reset_codes` | Sign-in sessions and reset codes |
| `tracks` | Plans |
| `actions` | Tasks |
| `action_completions` | Ticks (un-ticks are kept for the audit trail) |
| `action_steps` | Optional steps inside a task |
| `daily_records` | Each finished day's result per user |
| `streak_states`, `track_completions` | Streak score and best, finished plans and their bonus |
| `user_achievements` | Earned achievements |
| `reminders` | Reminders, WhatsApp delivery state |
| `vault_credentials` | PIN hash and lockout state |
| `vault_entries` | Encrypted notes (+ encrypted voice note) |
| `vault_images` | Encrypted photos of Vault notes |
| `wallet_redemptions` | Redemption requests |

**Migrations** (`Backend/alembic/versions/`, oldest first):

| Revision | Adds |
|---|---|
| `b33bd85d0492` | Baseline of the existing schema |
| `d757e039bb51` | Plans, tasks, streaks, Vault |
| `a41c7e2f9b10` | Wallet redemptions |
| `c5e2a9d41f07` | "Ring like an alarm" on reminders |
| `d8f3b1c27a64` | Quick confirmation as the default |
| `e2a7c4b19d35` | Vault voice notes |
| `f4b9d2e61c08` | Profile photos, "Show profile photo" |
| `a7c3e9f15b20` | Vault photos, tap sound |
| `c1d8f4a2e6b3` | `badge_seen` |
| `d4e7a1c9b5f2` | One-time reset of `badge_seen` |

Apply them with `alembic upgrade head` (Render does this on every deploy;
see [10.1](#101-backend-on-render)).

---

## 6. API reference

All paths are under `/api/v1`. Everything except registration, login,
refresh, forgot/reset password and the health checks needs
`Authorization: Bearer <token>`. Vault note routes also need `X-Vault-Token`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` (emails a 6-digit code, no tokens), `/auth/verify-email` (code → tokens), `/auth/resend-code`, `/auth/login` (403 `EMAILNOTVERIFIED` until verified), `/auth/google` (Google ID token → tokens; needs `GOOGLE_CLIENT_IDS`), `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`; `GET /auth/me` |
| Me and settings | `GET/PATCH /users/me`, `GET /users/me/profile`, `GET/PATCH /users/me/settings`, `POST /users/me/onboarding/complete`, `POST /users/me/onboarding/reset` |
| Photos | `PUT/DELETE /users/me/photo` (multipart, ≤ 10 MB), `GET /users/{public_id}/photo` |
| Friends | `GET /users/search?public_id=…` |
| Dashboard | `GET /dashboard/summary` |
| Plans | `GET/POST /tracks`, `GET/PATCH/DELETE /tracks/{id}`, `POST /tracks/{id}/archive`, `POST /tracks/{id}/restore`, `GET /tracks/{id}/days`, `GET /tracks/{id}/grid` |
| Tasks | `GET/POST /tracks/{id}/actions`, `GET/PATCH/DELETE /actions/{id}`, `GET /actions/agenda`, `POST /actions/{id}/complete`, `POST /actions/{id}/uncomplete` |
| Streaks | `GET /streaks/me`, `GET /streaks/history`, `GET /streaks/track-completions` |
| Achievements | `GET /achievements` |
| Reminders | `GET/POST /reminders`, `GET/PATCH/DELETE /reminders/{id}`, `POST /reminders/{id}/complete`, `/uncomplete`, `/snooze`, `/cancel` |
| Vault access | `GET /vault/status`, `POST /vault/setup`, `/vault/unlock`, `/vault/change-pin`, `/vault/refresh`, `/vault/reset-pin` |
| Vault notes | `GET/POST /vault/entries`, `GET/PATCH/DELETE /vault/entries/{id}`, `POST /vault/entries/{id}/{pin,unpin,favorite,unfavorite,archive,unarchive,trash,restore}`, `GET /vault/folders`, `POST /vault/trash/empty` |
| Vault media | `PUT/GET/DELETE /vault/entries/{id}/audio`, `POST /vault/entries/{id}/images`, `GET/DELETE /vault/entries/{id}/images/{image_id}` |
| Wallet | `GET /wallet`, `POST /wallet/redeem` |
| Admin | `GET /admin/dashboard`, `GET /admin/users`, `POST /admin/users/{id}/disable`, `/enable`, `PATCH /admin/users/{id}/role` |
| Maintenance | `POST /maintenance/cleanup` (header `X-Cron-Secret`) |

Interactive docs are at `/docs` on a running server.

---

## 7. Configuration

### 7.1 Backend environment (`Backend/.env`, or Render environment variables)

| Variable | Purpose |
|---|---|
| `HOST`, `DB_PORT`, `DATABASE`, `USER`, `PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | **Required.** A long random secret, unique per environment |
| `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | Token settings |
| `VAULT_ENCRYPTION_KEYS` | **Required for the Vault.** Comma-separated Fernet keys; the first encrypts, all decrypt (key rotation) |
| `VAULT_SESSION_MAX_MINUTES`, `VAULT_MAX_FAILED_ATTEMPTS`, `VAULT_LOCKOUT_MINUTES` | Vault session and lockout |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_FROM` | Email through Resend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_DEBUG` | Email through SMTP (Gmail needs an App Password; ports 587 and 465 both work). `SMTP_SERVER`/`SMTP_EMAIL` are accepted aliases |
| `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_INTEGRATED_NUMBER`, `MSG91_WHATSAPP_TEMPLATE_NAME`, `MSG91_WHATSAPP_NAMESPACE`, `MSG91_WHATSAPP_TEMPLATE_STYLE` | WhatsApp reminders (optional) |
| `REMINDER_POLL_SECONDS`, `STREAK_FINALIZE_MINUTES` | Worker timing |
| `TRACK_BONUS_*` | Plan completion bonus rules |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin account created at start-up. Never use the example values |
| `CRON_SECRET` | Enables `POST /maintenance/cleanup` |
| `FRONTEND_ORIGIN` | Allowed web origin (CORS) |

Generate a Vault key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Check email delivery (prints the provider's real error):

```bash
cd Backend && python -m app.integrations.email you@example.com
```

### 7.2 App configuration

- Backend URL: `MyApp/src/config/env.ts` (`PRODUCTION_API_ORIGIN`,
  `LOCAL_API_ORIGIN`, `USE_LOCAL_API`). Only public URLs belong there:
  anything in the app can be read by users.
- Theme, accent and alarm sound are stored on the phone; everything else is
  in the user's server-side settings.

### 7.3 WhatsApp template

`MSG91_WHATSAPP_TEMPLATE_STYLE` picks the template shape
(`Backend/app/integrations/messages.py`):

- `single` (default): one variable, for example
  `⏰ Call the electrician · Sat, 10 Oct at 6:30 PM · 📝 Bring the warranty card`.
- `detailed`: three variables (name, reminder, when), category *Utility*.
  Header `Memo reminder`; body:

  ```
  Hi {{1}}, this is your reminder from Memo.

  It's time for: *{{2}}*

  🗓 When: {{3}}

  You set this reminder in the Memo app. Open the app to snooze or change it.
  ```

  Footer `Sent by Memo.`. Get it approved in MSG91, then set
  `MSG91_WHATSAPP_TEMPLATE_NAME` and `MSG91_WHATSAPP_TEMPLATE_STYLE=detailed`.

---

## 8. Running locally

### 8.1 Backend

Needs Python 3.12+ and a PostgreSQL database.

```bash
cd Backend
cp -n .env.example .env          # then fill in the database and secrets
python -m venv myenv && source myenv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003
```

### 8.2 Mobile app

Needs Node 22.11+, Android Studio (Android SDK, JDK 17) and, for iOS, Xcode
with CocoaPods.

```bash
cd MyApp
npm install
npx react-native start            # Metro, in one terminal
npx react-native run-android      # in a second terminal
```

To point a debug build at your local backend, set `USE_LOCAL_API = true` in
`src/config/env.ts` and choose `LOCAL_API_ORIGIN`:

| Device | `LOCAL_API_ORIGIN` |
|---|---|
| Android emulator | `http://10.0.2.2:8003` |
| Phone over USB | `http://127.0.0.1:8003` after `adb reverse tcp:8003 tcp:8003` |
| Phone over Wi-Fi | `http://<your computer's LAN IP>:8003` |
| iOS simulator | `http://localhost:8003` |

iOS: run `bundle install`, then `cd ios && bundle exec pod install` after
installing or changing native packages, then `npx react-native run-ios`.

**After pulling changes:** run `npm install`. If native code or packages
changed, rebuild with `cd android && ./gradlew clean && cd .. && npx
react-native run-android`. If Metro shows stale errors, run `npx
react-native start --reset-cache`.

**After editing the welcome story** (`web/story/story.js`), rebuild it with
`npm run build:story`. To check a moment in a browser, serve `MyApp/assets`
and open `web/story/index.html?scene=3&at=6` (scene number, seconds).

---

## 9. Tests and checks

| Where | Command | Notes |
|---|---|---|
| Backend | `TEST_DATABASE_URL=postgresql+psycopg2://… python -m pytest` | Use a **throwaway** database: the tests empty its tables. Migrate it first with `ALEMBIC_DATABASE_URL=… alembic upgrade head` |
| Backend | `alembic check` | Confirms the models and migrations match |
| App | `npx tsc --noEmit` | Type check |
| App | `npm run lint` | ESLint |
| App | `npm test` | Jest (app render and badge rules) |
| App | `cd android && ./gradlew assembleDebug` | Android build |

A quick disposable database with Docker:

```bash
docker run -d --name memo-pg-check -e POSTGRES_PASSWORD=p -e POSTGRES_DB=memo_check -p 55499:5432 postgres:16-alpine
export U=postgresql+psycopg2://postgres:p@127.0.0.1:55499/memo_check
ALEMBIC_DATABASE_URL=$U alembic upgrade head
TEST_DATABASE_URL=$U JWT_SECRET=x VAULT_ENCRYPTION_KEYS=<a Fernet key> python -m pytest -q
docker rm -f memo-pg-check
```

---

## 10. Deployment

### 10.1 Backend on Render

- Service **tasks-singapore** (`https://tasks-singapore.onrender.com`),
  region Singapore (close to the database), root directory `Backend`.
- Build command: `pip install -r requirements.txt`.
- **Start command:**
  ```
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
  The first part applies new database migrations on every deploy, before the
  server starts. Without it, a release that adds columns crashes on start
  with "column … does not exist".
- Environment variables: see [7.1](#71-backend-environment-backendenv-or-render-environment-variables).
- Keep **one** instance: the worker runs inside the API process, and several
  instances would send the same WhatsApp reminders more than once.
- Deploys happen when `main` changes on GitHub
  (`https://github.com/SatyaSaiRam4/Tasks`). Work happens on the `man` branch
  and is merged into `main` by pull request.

### 10.2 Database

PostgreSQL on **Supabase** (Mumbai). Migrations run automatically from
Render's start command. To run them by hand, use the Supabase *Session
pooler* connection string:

```bash
cd Backend
ALEMBIC_DATABASE_URL='postgresql+psycopg2://<user>:<password>@<pooler-host>:5432/postgres' alembic upgrade head
```

Back up the database regularly (Supabase backups) and keep the Vault keys
backed up **separately**.

### 10.3 Scheduled jobs

| Job | When | What |
|---|---|---|
| Worker (inside the API) | Continuously | WhatsApp sends, reminders → Done, streak finalising, cleanup at 02:00 IST |
| `.github/workflows/daily-cleanup.yml` | 02:00 IST | Calls `POST /maintenance/cleanup`: settles streaks, deletes plans and tasks 7 days after they end or are deleted, done reminders after 7 days, and Vault bin notes after 30 days (`VAULT_BIN_DAYS`) |
| `.github/workflows/keep-awake.yml` | Every 10 minutes | Pings `/health/ready` so Render's free plan and the database stay awake |

Both workflows need the repository secrets `API_URL` and (cleanup)
`CRON_SECRET`.

### 10.4 Optional: your own server

`deploy/docker-compose.yml` runs the API (from `Backend/Dockerfile`, which
also migrates on start) behind Nginx (`deploy/nginx/nginx.conf`: keep-alive,
gzip, timeouts, 11 MB uploads, no caching of API responses):
`cd deploy && docker compose up -d --build`. Add TLS with the commented 443
block. On Render this isn't needed.

### 10.5 App builds

- Android debug: `npx react-native run-android`.
- Android release: `cd MyApp/android && ./gradlew assembleRelease` (APK) or
  `bundleRelease` (AAB for Google Play). Read
  [section 13](#13-before-publishing-to-the-stores) first.
- iOS: archive from Xcode (`MyApp/ios/MyApp.xcworkspace`).

---

## 11. Operations and security

- **Secrets** live in `Backend/.env` locally and in Render's environment;
  never commit them. Never put passwords or tokens in chats or issues.
- **Vault keys:** if every key in `VAULT_ENCRYPTION_KEYS` is lost, Vault
  content can't be recovered, even from database backups. To rotate, put a
  new key first and keep the old ones after it.
- **Admin account:** set real `ADMIN_*` values; the examples are public.
- **Android 12+:** exact reminder times may need the system *Alarms &
  reminders* permission (Settings → Notifications → Exact alarms).
- **Render free plan:** sleeps when idle; the first request after that can
  take up to a minute (the keep-awake job reduces this). A paid plan avoids it.
- **Wallet payouts** are manual: check pending redemptions in the database
  (`wallet_redemptions`) and pay them, then mark them.

---

## 12. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Render deploy crashes: `column … does not exist` | The database is behind the code. Make sure the start command begins with `alembic upgrade head &&`, or run the migration by hand ([10.2](#102-database)) |
| Red screen: `Unable to resolve module react-native-…` | A new package wasn't installed: `npm install`, rebuild (`./gradlew clean`, `run-android`), then `npx react-native start --reset-cache` |
| Red screen: "set the key `shadowColor` … frozen" | Fixed: the theme is applied once per session and never edits styles in use. Pull the latest code |
| `git pull` refuses: local changes to `package-lock.json` | Not real work (npm rewrote it): `git checkout -- MyApp/package-lock.json`, then pull |
| `git push` 403 "denied to <other user>" | The computer has another GitHub login saved. Push with the owner's account and a personal access token |
| Reminders late on Android | Allow exact alarms; turn off battery optimisation for Memo |
| Password-reset email doesn't arrive | Run the email check in [7.1](#71-backend-environment-backendenv-or-render-environment-variables); Gmail needs an App Password |
| The Vault locked while choosing a photo | Fixed: pickers no longer lock it. Pull the latest code |

---

## 13. Before publishing to the stores

These are needed before a public release:

1. **Android package name:** `applicationId` is still `com.myapp`
   (`MyApp/android/app/build.gradle`). Choose the final one (for example
   `com.memo.app`) before the first upload; it can't change afterwards.
2. **Release signing:** release builds are currently signed with the
   **debug** keystore. Create a private upload keystore, add it as a
   `release` signing config, and keep it safe (losing it blocks updates).
3. **Version:** raise `versionCode` and `versionName` for every release.
4. **iOS:** set the bundle identifier and signing team in Xcode, and add the
   bundled fonts to the Xcode project (iOS currently falls back to the
   system fonts).
5. **Store listing:** app icon, screenshots, privacy policy (the app stores
   accounts, reminders and encrypted Vault content; WhatsApp numbers are
   sent to MSG91) and the data-safety form.

---

## 14. Glossary

| In the app | In the code and API |
|---|---|
| Plan | Track (`tracks`); older UI code also says "category" |
| Task | Action (`actions`) |
| Melo (the guide) | `satya` (module, settings keys and asset folder names) |
| Streak points | `current_streak`; the highest is `best_streak` |
| Badge | Tier (`Tiers.tsx`) |
| Bin (Vault) | Trash (`deleted_at`, `trash` and `restore` actions) |
