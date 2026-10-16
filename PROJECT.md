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
test, deploy and look after it. Payments (the WhatsApp plan, Razorpay) and
wallet payouts are covered in detail in [PAYMENTS.md](PAYMENTS.md).

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
│   │   └── config/env.ts    Backend URLs (two servers)
│   ├── web/story/           Source of the 3D welcome story (three.js)
│   ├── web/satya/           Source of Melo's 3D page (Home corner, tour, weather layer)
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
- **Melo's corner** at the bottom (see [2.9](#29-welcome-story-tour-and-melo)),
  with the real weather shown lightly behind him.

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

- Best-streak milestones unlock **points** once each: **500 points at a best
  streak of 500** and **1000 more at 1000**. Milestones count once the day
  has finished.
- The user redeems **500 points for ₹10** or **1000 points for ₹20** to a
  mobile number. Each redemption is *PENDING* (shown as *Processing*) and
  its points are taken at once; **payouts are made by hand** and an admin
  marks them *Paid* (with the payment reference) or *Not paid* (the points
  come back).
- Redeeming never changes the best streak, badges or milestones. A repeated
  or double tap never redeems twice. Details: [PAYMENTS.md](PAYMENTS.md#4-wallet-points-and-payouts).
- "To go" uses the same number as the dashboard (today's finished plans
  included) and refreshes after every tick.

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
  | WhatsApp (premium) | Any number whose owner replied **YES**, even with the phone off | A personal message with the name, reminder, date and time |

- **WhatsApp plan:** every account gets **3 WhatsApp reminders free**
  (per account, not per number). After that the **WhatsApp plan** is needed:
  **₹30 for 100 WhatsApp reminders over 30 days**, paid with Razorpay,
  renewed only when the user chooses (unused messages carry over). Without
  one, saving a WhatsApp reminder explains the plan, and nothing more is
  sent. Settings → Notifications → *WhatsApp plan* shows what's left. Test
  mode only for now. Details: [PAYMENTS.md](PAYMENTS.md).

- **"Ring like an alarm"** shows a full-screen, looping alarm with a Stop
  button that stops by itself after 10, 30 or 60 seconds. The sound
  (Classic, Chime, Digital, Gentle) and length are set per phone in
  Settings, which also has *Test alarm*.
- Task notifications read ✅ **Walk 20 minutes** · Time for this task in
  "Fitness". The 8 PM streak warning reads 🔥 **2 tasks left today**.
- **A WhatsApp number must reply YES first** (so nobody can use Memo to
  message someone else's number to tease them). Under the number in the
  reminder editor, *Ask on WhatsApp* sends that number **one** short
  message through the reminder template: "Satya wants to send you Memo
  reminders. Reply *YES* to allow or *STOP* to refuse." No codes, no
  emoji buttons (a 👍 / 👎 reply is still understood). The app shows a
  1-minute countdown and checks every 1.5 seconds, so it turns green
  (*Accepted · they replied YES*) as soon as they reply. It keeps checking
  while the editor is open, so a **STOP, even right after YES**, turns it
  red (*Not accepted · they replied STOP*) within a few seconds; *Send
  again* appears once the minute since the ask is over. No answer in the
  minute: *No answer within 1 minute* and *Send again* (3 times a day at
  most). After **3 refusals within a day** it says *Not accepted 3 times
  today. Try again tomorrow.* (see [7.4](#74-whatsapp-number-permission)).
- **What gets sent:** reminders go out on time (the worker runs at second
  1 of every minute). While a number is stopped (or hasn't said YES yet)
  nothing is sent to it; a reminder that comes due then waits **5
  minutes** for a YES and goes out if one arrives, otherwise it's dropped
  (*Failed*). After YES again, every later reminder is sent as normal.

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
  (with sparkles fanning out in two arcs either side of the ball, never
  bunched at the top) and a ripple across the floor; he pops out and strolls off, turns his
  face to you mid-walk, blushes (soft pink, steam puffs) and dashes off the
  screen in a kick of dust; then, Chopper-style, he leans back in from the
  edge with half of him showing and a sweat drop to check whether you're
  still watching (twice; a tap finds him) and comes back to give his tip in
  a speech bubble. He leaves soft footprints that fade as he walks. A tap at any time makes him blush, with
  red hearts that pop out to his sides (below the speech bubble).
  Particles have darker edges so they show on the light and dark themes. If
  Android closes his page in the background or it fails to load, the corner
  loads it again (3 tries, then again each time Home comes back); it stays
  hidden only on phones without 3D (WebGL).
  His full show plays even with Memo's own *Reduced motion* on (like the
  badge reveal). Only the phone's system *Remove animations* setting makes
  him skip the entrance and walking: then he stands in the middle of his
  corner and gives his tip at once. (Before, he stayed off stage, ready to
  roll in, so the corner looked empty.) He also reacts to the user's
  day (proud, worried, sleepy). Check it in a browser: serve `MyApp/assets`
  and open `web/satya/index.html?mode=stroll&at=40&hold=peek&f=0.5`
  (`at` fast-forwards; `hold` freezes a phase).
- **Weather in Melo's corner** (`src/modules/satya/weather.ts`,
  `web/satya/meloWeather.js`): the real weather where the user is. Melo
  himself doesn't change; the weather is shown, not worn:
  - **Behind him**, kept faint: a soft sun glow (a few twinkles at night),
    slow clouds, thin rain, a flash in a storm, drifting snow or mist.
  - **A caring weather report**: every other time he stops to talk, his
    speech bubble talks about the weather instead of his tip, for example
    "It's raining in Hyderabad ☔ Take an umbrella and stay dry!", "Sunny
    and 33° in Chennai ☀️ Keep a water bottle with you.", "Chilly 12° in
    Shimla 🧣 Wear something warm today." (`weatherCare`).
  - **A small label** in the top-right corner, e.g. `☀️ 31° · Hyderabad`.
  No card, no forecast. The first time Home opens, Android asks for **rough
  location** (city level) once; if the user says no, there's simply no
  weather and Memo never asks again (it can be turned on in Android's app
  settings). The city name comes from the phone's own Geocoder. The
  location goes only to Open-Meteo (free, no key), rounded to about 1 km;
  Memo's server never sees it. The weather is kept for 30 minutes.
  Preview in a browser: `web/satya/index.html?weather=rain` (also `clear`,
  `cloudy`, `fog`, `storm`, `snow`; `&night=1` for night; add
  `&mode=stroll` for Home's corner).
- **Melo's tour:** nine short steps (making a plan, adding tasks, ticking,
  streak points, rewards, reminders, the Vault) with typed-out text and a
  gesture each, plus Back and Skip.
- **Who sees the tour:** only a new user (the server says they haven't
  finished or skipped it) and anyone who taps *Replay tour*. The app
  decides only from what the server said in this session (sign-in, token
  refresh or `/users/me`; `userConfirmed` and `selectIsNewUser` in
  `authSlice.ts`), never from the copy saved on the phone alone, and the
  saved copy is updated whenever the user changes (`saveUser`). Before
  this, the copy saved at sign-in still said "tour not done", so the tour
  could pop up again at launch and vanish a moment later.
- **Quiet Home during a new user's first story and tour:** Melo's corner
  (his animation and the weather, and the location question) is off until
  the guide is finished or skipped, so nothing moves behind it; then he
  arrives in his ball as usual. A tour replayed from Settings (*Replay
  tour*) leaves him playing behind it (`tourReplay` in
  `app/preferencesSlice.ts`).

### 2.10 Why Memo?

Settings → **Why Memo?** compares Memo with a phone's Clock app and typical
to-do apps (Google Tasks, Microsoft To Do, Todoist, TickTick) in a small
diagram and a yes / some / no table. It was checked in October 2026; keep it
honest and update it if those apps change.

### 2.11 Android home-screen widgets

Three widgets to choose from (long press on the home screen → Widgets →
Memo; on Android 12+ the picker shows each one's real layout):

| In the picker | Size | Shows |
|---|---|---|
| **Memo** | 4×2 | The weather, M logo and streak, today's tasks, the next reminder, Melo animated |
| **Memo · Melo** | 2×2 | The weather on top, Melo animated in the middle, M logo and streak below |
| **Memo · Today** | 4×1 | One slim row: M logo, streak, today's tasks, the next reminder, the weather |

All three draw the same saved data (`MemoWidgetProvider.kt`, with
`MemoSmallWidgetProvider` and `MemoWideWidgetProvider`; layouts
`memo_widget.xml`, `memo_widget_small.xml`, `memo_widget_wide.xml`) and
update together. The big one in detail:

Shows Memo's **M** logo with the streak, today's tasks and the next
reminder, the **weather** on a small line centred at the top (the same
`☀️ 31° · Hyderabad` as Home, saved whenever Home loads the weather and hidden once
it's more than 3 hours old or location isn't allowed), with **Melo animated as in the app** on the right: he blinks,
waves, talks, does his shy wiggle with red hearts, hops, then spins with
sparkles, over and over (about 10 seconds). Widgets can't play real
animations, so a `ViewFlipper` steps through 68 frames rendered from his 3D
page (`res/drawable-nodpi/melo_widget_00.png` … `67`, 180 px, 256-colour
PNGs, about 540 KB in all) every 150 ms, switching straight from one to the next (fading between
them made him flicker); it runs
only while the widget is on screen. The logo is `memo_widget_mark.png`
(from `assets/images/memo-mark-dark.png`). Tap to open Memo. Nothing from
the Vault is shown. Add it with a long press on the home screen → Widgets →
Memo.

To re-render the frames after Melo changes: serve `MyApp/assets`, load
`web/satya/index.html?gesture=none` (460 × 500) in headless Chrome with
`requestAnimationFrame` driven by a fixed clock and a transparent
background. Every 150 ms take a screenshot while playing, in turn: 1.2 s
standing, `wave`, `talk`, `shy` with `window.melo.burst('heart', 4, 260)`,
`hop`, `cheer` with `window.melo.burst('sparkle', 5, 180)`, 0.45 s
standing (`window.satya.now(name)` starts a move). Crop every frame to the
same box around Melo (his standing size plus 22 % each side and 14 % above),
scale to 180 px high and save as 256-colour PNGs.

### 2.12 Admin

Admin accounts see app statistics and can disable, enable or change the role
of users. **Payouts & payments** lists streak-point payouts (mark *Paid*
with the payment reference, or *Reject* with a reason; who and when are
recorded), WhatsApp plan payments and plans. Admin screens never give
access to anyone's Vault.

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
| `whatsapp` | WhatsApp number consent: the YES/STOP permission message and the MSG91 inbound webhook |
| `dashboard` | One call with everything Home needs |
| `admin` | Statistics and user management |
| `maintenance` | The daily cleanup endpoint |

### 3.3 Mobile app

| Part | Details |
|---|---|
| Stack | React Native 0.87 (New Architecture, Hermes), React 19, TypeScript, Node ≥ 22.11 |
| State and data | Redux Toolkit + RTK Query. `src/api/baseApi.ts` adds the tokens, refreshes an expired session once, and locks the Vault if the server says so. Data is kept 5 minutes after a screen closes |
| On-device cache | `src/api/persistCache.ts` keeps the last data per user (never the Vault or admin data) so screens open instantly and refresh in the background; cleared on logout |
| Backend URLs | `src/config/env.ts`: release builds use **two** servers, `https://tasks-wvlv.onrender.com` (preferred) and `https://tasks-singapore.onrender.com` (backup) (same code, same database), and `src/api/servers.ts` picks whichever is up (see [10.1](#101-backend-on-render)); debug builds use the local address when `USE_LOCAL_API` is true |
| Navigation | `src/navigation/RootNavigator.tsx`: five tabs (Home, Plans, Reminders, Vault, Profile) inside a root stack with the pushed screens (plan detail and editor, reminder editor, Vault note, streak history, find a friend, settings, Why Memo?, wallet, change password, admin) |
| Layout | Phones: floating tab bar. Tablets: centred tab bar and two columns. Wide windows: a navigation rail |
| Design system | `src/theme/` "Midnight & Champagne": `palette.ts` (colours, light and dark themes, accents), `typography.ts` (Cormorant Garamond for display, Manrope for UI), `tokens.ts` (spacing, radius, motion), `index.ts` (applied once at start-up, before any screen is created) |
| Bottom sheets | Drawn in the main window by `components/SheetHost.tsx` (not a Modal). A sheet with a focused text field moves to the top, clear of the keyboard |
| Notifications | `react-native-notify-kit`: reminders, task reminders, the streak warning and alarms, scheduled on the phone. `BackgroundSync` keeps them up to date while signed in |
| Native modules (Android) | `AppReloadModule` (in-place restart for theme changes), `MemoWidgetModule` + `MemoWidgetProvider` (widget), `TapSoundModule` (tap click), `MemoLocationModule` (rough location for the weather on Home) |
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
  into view and the locked badge **breaks open in its place, like a stone
  statue**: two heartbeats, then it shakes harder and harder (with small
  buzzes) while dark cracks spread over the grey stone; it bursts, stone
  chips flying out and falling away, with a flash, sparks and a stronger
  buzz, becomes the gold medal and settles with a bounce. Then the
  "Congrats! You've upgraded to Bronze" card opens (`RevealBadge` in
  `Tiers.tsx`, about 4 seconds). It's the reward moment, so it plays even
  with Memo's own *Reduced motion* or *Animations* off; only the phone's
  system *Remove animations* setting shortens it to a quick switch.
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
- The weather on Home uses rough location (city level, asked once). It
  goes only to Open-Meteo, rounded to about 1 km, and is never sent to
  Memo's server or stored beyond the 30-minute weather on the phone.

---

## 5. Data model

Main tables (PostgreSQL):

| Table | Holds |
|---|---|
| `users` | Account, display name, public ID, timezone, profile photo (`photo`, `photo_mime`, `photo_version`), role |
| `user_settings` | Theme-independent preferences: confirmation mode, notifications, privacy switches, Vault auto-lock, Melo, `tap_sound`, `badge_seen` |
| `refresh_sessions`, `password_reset_codes`, `email_verification_codes` | Sign-in sessions, password-reset codes and sign-up email codes (`users.email_verified_at`, `users.google_sub` for Google sign-in) |
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
| `wallet_redemptions` | Redemption requests: rupees and points, status (`PENDING`, `PAID`, `REJECTED`), request id, payout reference, who decided and when |
| `payment_orders`, `payment_events` | Razorpay checkouts (amount in paise, provider ids, status) and processed webhook events (see [PAYMENTS.md](PAYMENTS.md#6-database)) |
| `whatsapp_plans`, `whatsapp_usage` | WhatsApp plans (100 messages, 30 days, one open per user) and the ledger of WhatsApp reminder sends (one row per reminder occurrence) |
| `whatsapp_contacts` | WhatsApp numbers and their consent: `PENDING` (asked, waiting for YES; `asked_at`), `VERIFIED` (said YES), `STOPPED` (said STOP) |
| `whatsapp_auto_replies` | One row per number that wrote something other than YES or STOP: when Memo last sent it the automatic answer |

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
| `b9e3f7a2c4d1` | Email verification at sign-up |
| `e6c2d9a4f8b3` | Google sign-in (`users.google_sub`) |
| `e5b2c8d14a71` | WhatsApp number consent (`whatsapp_contacts`) |
| `f7a3d9b2c6e4` | Consent by YES reply: drops the code column, `asked_at` |
| `a8d4e1f6b2c9` | Clears stale "asked" times left from the code version (those numbers looked asked but never got the message) |
| `b3f6c2a9d8e1` | WhatsApp refusals count (3 a day, then try tomorrow) |
| `c9e1a4d7f3b6` | `whatsapp_inbound_log`: every webhook call, numbers masked (kept 7 days) |
| `d4a7e2b9c1f5` | `whatsapp_auto_replies`: when Memo last answered a number's non-YES/STOP message |
| `e8b3f1c6a2d7` | Payments, WhatsApp plans and usage ledger, wallet points and payout record (additive only) |

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
| Wallet | `GET /wallet` (points, choices), `POST /wallet/redeem` (`points` 500/1000, `request_id`), `GET /wallet/redemptions` |
| WhatsApp plan | `GET /subscriptions/whatsapp`, `POST /subscriptions/whatsapp/order`, `POST /subscriptions/whatsapp/verify`; `POST /payments/razorpay/webhook` (Razorpay, signed). Reminders with WhatsApp answer 402 `SUBSCRIPTIONREQUIRED` when nothing is left |
| WhatsApp consent | `POST /whatsapp/verify` (sends the YES / STOP permission message), `GET /whatsapp/status?phone=…`, `GET /whatsapp/inbound/recent` (admins); `POST /whatsapp/inbound?token=…` (MSG91 webhook, no sign-in, always 200) |
| Admin | `GET /admin/dashboard`, `GET /admin/users`, `POST /admin/users/{id}/disable`, `/enable`, `PATCH /admin/users/{id}/role`; `GET /admin/redemptions`, `POST /admin/redemptions/{id}/paid`, `/reject`, `GET /admin/payments`, `GET /admin/whatsapp-plans` |
| Maintenance | `POST /maintenance/cleanup` (header `X-Cron-Secret`) |

Interactive docs are at `/docs` on a running server.

---

## 7. Configuration

### 7.1 Backend environment (`Backend/.env`, or Render environment variables)

| Variable | Purpose |
|---|---|
| `HOST`, `DB_PORT`, `DATABASE`, `USER`, `PASSWORD` | PostgreSQL connection |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW` | Database connections per server: kept open (default 5) and extra under load (default 10). With two servers, keep `2 × (DB_POOL_SIZE + DB_MAX_OVERFLOW)` within the Supabase pooler's limit |
| `JWT_SECRET` | **Required.** A long random secret, unique per environment |
| `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | Token settings |
| `VAULT_ENCRYPTION_KEYS` | **Required for the Vault.** Comma-separated Fernet keys; the first encrypts, all decrypt (key rotation) |
| `VAULT_SESSION_MAX_MINUTES`, `VAULT_MAX_FAILED_ATTEMPTS`, `VAULT_LOCKOUT_MINUTES` | Vault session and lockout |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_FROM` | Email through Resend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_DEBUG` | Email through SMTP (Gmail needs an App Password; ports 587 and 465 both work). `SMTP_SERVER`/`SMTP_EMAIL` are accepted aliases |
| `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_INTEGRATED_NUMBER`, `MSG91_WHATSAPP_TEMPLATE_NAME`, `MSG91_WHATSAPP_NAMESPACE`, `MSG91_WHATSAPP_TEMPLATE_STYLE` | WhatsApp reminders (optional) |
| `MSG91_INBOUND_SECRET` | Secret in the URL MSG91 forwards incoming WhatsApp messages to (YES and STOP replies). Without it the inbound endpoint is off |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_MODE` | WhatsApp plan payments. Blank keys = payments off. Keys must match the mode (`rzp_test_` with `test`, `rzp_live_` with `live`). See [PAYMENTS.md](PAYMENTS.md#7-configuration) |
| `GOOGLE_CLIENT_IDS` | Comma-separated OAuth client IDs accepted for Google sign-in |
| `REMINDER_POLL_SECONDS`, `STREAK_FINALIZE_MINUTES` | Worker timing. Reminders are checked at second 1 of every minute and then every `REMINDER_POLL_SECONDS` (kept between 5 and 30) |
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

- Backend URLs: `MyApp/src/config/env.ts` (`PRODUCTION_API_ORIGINS`, in
  order of preference; `LOCAL_API_ORIGIN`, `USE_LOCAL_API`). Only public
  URLs belong there: anything in the app can be read by users. Requests
  time out after 15 s (`API_TIMEOUT_MS`; uploads 60 s).
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
- `task_time`: two variables, for the **`memo_scheduled_task_update`**
  template (Utility):

  ```
  Hello! Here is your scheduled reminder.

  Task: *{{1}}*
  Scheduled date and time: {{2}}.

  Thank you for using Memo.
  ```

  `{{1}}` is the task (with its note, if any), `{{2}}` the date and time.
  The YES/STOP permission message uses it too (`{{1}}` = the request, `{{2}}`
  = "Now"). Set `MSG91_WHATSAPP_TEMPLATE_NAME=memo_scheduled_task_update`,
  `MSG91_WHATSAPP_TEMPLATE_STYLE=task_time` and the template's namespace.

**The style must match the template's number of variables exactly.**
Otherwise MSG91 accepts the message but WhatsApp refuses it; MSG91 → Logs
shows *Failed* with "number of localizable_params (3) does not match the
expected number of params (2)".

### 7.4 WhatsApp number permission

A number gets reminders only after its owner replies **YES** to one short
permission message, sent through the **existing reminder template** (no
authentication template, no codes: it's a request for consent). Code:
`Backend/app/modules/whatsapp/`, `MyApp/src/modules/reminders/WhatsAppVerify.tsx`.

1. The app calls `POST /whatsapp/verify` with the number. Unless it's
   already allowed or inside an open 1-minute window, the server sends the
   permission message (`consent_variables` in
   `app/integrations/messages.py`): "Satya wants to send you Memo
   reminders. Reply *YES* to allow or *STOP* to refuse." It marks the
   number `PENDING` (`asked_at`).
2. MSG91 forwards the reply to `POST /api/v1/whatsapp/inbound`. YES (also
   Y, OK, ALLOW, START, HAAN, or a 👍) marks it `VERIFIED` (a YES MSG91
   delivers late still counts up to 10 minutes after the ask). STOP (also
   NO, UNSUBSCRIBE, CANCEL, END, QUIT, or a 👎) marks it `STOPPED` at any
   time, even right after YES, and counts a refusal (`refusals`,
   `refusals_since`). A stopped number can be asked again; after 3
   refusals in 24 hours `POST /whatsapp/verify` answers 429 until
   `try_again_at`. A YES the owner sends on their own also turns a
   stopped number back on.
3. `GET /whatsapp/status?phone=…` reports `NONE`, `PENDING` (with
   `expires_at`), `EXPIRED`, `VERIFIED` or `STOPPED`. The app polls it
   every 1.5 seconds while `PENDING` and every 3 seconds otherwise while
   the reminder editor is open, so YES and STOP both show within seconds.
4. Reminders can be saved with a `PENDING` or `VERIFIED` number. The
   worker (`app/workers/reminder_worker.py`) runs at second 1 of every
   minute, so a reminder goes out on time. It sends only to `VERIFIED`
   numbers; a due reminder for a number that isn't (yet, or again) waits
   up to 5 minutes (`UNVERIFIED_WAIT`) for a YES, then is marked *Failed*
   without sending.

**Other messages (no chatting):** WhatsApp has no way to stop people
writing to a business number, and replies only ever reach Memo's number
(never the Memo user or anyone else). **Every** message that isn't YES or
STOP gets an immediate short answer: "Only Memo reminders come from this
number. Reply ***YES*** to allow or ***STOP*** to stop." (`AUTO_REPLY`; WhatsApp
shows `*…*` in bold). It's free text, which WhatsApp allows for 24 hours
after the person writes (no template), sent by `send_whatsapp_text` in
`app/integrations/msg91.py` right after the webhook has answered: a `POST`
to `control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/` with the
fields in the query string as MSG91 documents (then once more as a JSON
body if refused). MSG91 can answer 200 with an error inside, so the body is
checked too. **What MSG91 answered is logged** in `whatsapp_inbound_log` as
`auto-reply to …1234: sent · HTTP 200 …` or `NOT SENT · …`, so a reply that
didn't arrive is easy to explain. `whatsapp_auto_replies` keeps when each
number was last answered.

**MSG91 setup (required; without it no reply reaches the server):**
1. MSG91 → **WhatsApp → Webhook (New) → Create Webhook**.
2. Service **WhatsApp**, event **On Inbound Report Received**.
3. URL `https://tasks-singapore.onrender.com/api/v1/whatsapp/inbound?token=<MSG91_INBOUND_SECRET>`
   (or the URL without `?token=` plus a custom header `x-memo-token:
   <MSG91_INBOUND_SECRET>`). Content type JSON. Create. If MSG91 lets you,
   create a **second** webhook the same way with
   `https://tasks-wvlv.onrender.com/...`, so replies arrive even when one
   server is down. Each WhatsApp message is handled once (by its `wamid`,
   kept 7 days in `whatsapp_inbound_seen`), whichever server gets it first.
4. On Render, set `MSG91_INBOUND_SECRET` to the same long random value.
5. If MSG91 shows the webhook as paused, resume it. The server always
   answers 200 so MSG91 never pauses it again (a wrong token is only logged).

MSG91's inbound body has `customerNumber`, `text`, and for button taps
`button` as a JSON string (`{"payload":"YES","text":"YES"}`); the server also
reads the old webhook's `customer_number`/`content` and Meta's
`entry/changes/messages` shape.

**Checking it works:**
- Database: every webhook call is kept for 7 days in `whatsapp_inbound_log`
  (`received_at`, `token_ok`, `summary` = sender (masked), text and result,
  `payload` with numbers masked). `SELECT received_at, token_ok, summary
  FROM whatsapp_inbound_log ORDER BY received_at DESC LIMIT 20;` shows at
  once whether MSG91 is calling, with the right token, and what it sent. A
  YES delivered late by MSG91 still counts up to 10 minutes after the ask.
- Render log, every webhook call: `WhatsApp inbound: [{'from': '…3323',
  'text': 'YES', 'result': 'verified'}]`. A refused call logs `WhatsApp
  inbound refused: MSG91_INBOUND_SECRET is not set on the server` or `wrong
  token`. **No `POST /api/v1/whatsapp/inbound` line at all** means MSG91 isn't
  calling the webhook (step 1–3 above).
- Admins: `GET /api/v1/whatsapp/inbound/recent` lists the last 50 webhook
  calls (numbers masked) and whether the secret is set.
- In the app, while waiting, the number shows the last reply that reached
  Memo (if it wasn't YES or STOP), or after 40 seconds says nothing has arrived.

**Free alternatives**, if MSG91 inbound isn't available on the account:
Meta's own WhatsApp Cloud API (free messages inside the 24-hour window after
the user writes in; templates outside it), or a Telegram bot (free, no
templates; the user starts the bot, which is itself consent).

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
| App | `npm test` | Jest (app render, badge rules, WhatsApp plan and wallet screens) |
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

The same backend runs as **two** Render services, both connected to the
**same** Supabase database, so the app keeps working when one is asleep,
suspended or down:

| Service | URL |
|---|---|
| **tasks-wvlv** (preferred by the app) | `https://tasks-wvlv.onrender.com` |
| **tasks-singapore** (backup) | `https://tasks-singapore.onrender.com` |

- Region Singapore (close to the database), root directory `Backend`.
- Build command: `pip install -r requirements.txt`.
- **Start command:**
  ```
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
  The first part applies new database migrations on every deploy, before the
  server starts. Without it, a release that adds columns crashes on start
  with "column … does not exist". (When both deploy at once, one applies the
  migration and the other finds it already done.)
- Environment variables: see [7.1](#71-backend-environment-backendenv-or-render-environment-variables).
  **Both services need the same values**, in particular the database
  (`HOST`, `DB_PORT`, `DATABASE`, `USER`, `PASSWORD`), `JWT_SECRET` (else
  switching servers signs people out and locks the Vault),
  `VAULT_ENCRYPTION_KEYS` (else Vault notes can't be read), `CRON_SECRET`,
  `GOOGLE_CLIENT_IDS`, the MSG91 and Razorpay variables.
- **How the app chooses** (`MyApp/src/api/servers.ts`, `src/api/baseApi.ts`):
  at launch it asks both servers' `/health/live` at once and uses the first
  that answers (remembered across restarts). If the current server is
  suspended or failing (502/503/504, a web page instead of the API),
  unreachable, or doesn't answer within 15 s, it moves to the other one.
  Reading is retried there automatically; a change (saving, paying,
  redeeming) is resent only when Render refused it before it reached the
  app (502/503), so nothing is ever done twice. After a timeout the user
  just tries again (it goes to the other server).
- **Both run the worker.** That's safe: each WhatsApp reminder has one
  ledger row (`whatsapp_usage`, unique per reminder occurrence), so only the
  server that takes it sends it; streak finalising locks per user; the
  daily cleanup and expiring checkouts are idempotent. Rate limits and the
  admin "recent inbound" list are per server (in memory).
- **Free plan hours:** Render counts free instance hours per workspace, so
  two services kept awake all month use about twice as many as one (a
  suspended service answers 503 "This service has been suspended"). See the
  keep-awake job in [10.3](#103-scheduled-jobs).
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
| `.github/workflows/keep-awake.yml` | Every 10 minutes | Pings `/health/ready` on each server so Render's free plan and the database stay awake; passes if at least one answers |

Repository secrets: `API_URL` (`https://tasks-singapore.onrender.com`),
`API_URL_BACKUP` (`https://tasks-wvlv.onrender.com`, optional) and (cleanup)
`CRON_SECRET`. The cleanup runs once, on the first server that answers.
Leaving `API_URL_BACKUP` unset lets the backup sleep to save free hours (the
app then waits up to a minute for it to start, only when the main one is
down).

### 10.4 Optional: your own server

`deploy/docker-compose.yml` runs the API (from `Backend/Dockerfile`, which
also migrates on start) behind Nginx (`deploy/nginx/nginx.conf`: keep-alive,
gzip, timeouts, 11 MB uploads, no caching of API responses):
`cd deploy && docker compose up -d --build`. Add TLS with the commented 443
block. On Render this isn't needed.

### 10.5 App builds

- Android debug: `npx react-native run-android`.
- Android release (Google Play): `cd MyApp/android && ./gradlew bundleRelease`
  → `app/build/outputs/bundle/release/app-release.aab` (upload this to Play);
  `assembleRelease` → `app/build/outputs/apk/release/app-release.apk` (APKPure,
  and to try on a phone).
- **App id:** `com.memomelo.app` (`applicationId`; permanent once published).
  The code's package stays `com.myapp` (`namespace`).
- **Version:** `versionCode` must go up by 1 for every Play upload;
  `versionName` is what users see (Settings shows "Version 2.1").
- **Signing:** releases are signed with the **upload key**
  `~/memo-release-keys/memo-upload.jks` (alias `memo-upload`, password in
  `~/memo-release-keys/keystore.properties`). The build reads
  `MyApp/android/keystore.properties` (a copy of that file, git-ignored).
  Without it, release builds are unsigned (Play refuses them), never signed
  with the debug key. **Back up `~/memo-release-keys/` somewhere private**
  (password manager or encrypted drive). With Play App Signing, a lost
  upload key can be reset through Play support, but it takes days.
- Upload key SHA-1 `97:40:E5:F2:E0:33:5E:C2:49:04:24:02:BE:BF:B3:CC:A1:CB:A1:62`.
- **WhatsApp plan purchases are off in this build** (`PLAN_PURCHASE_ENABLED`
  in `src/config/env.ts`), as Play doesn't allow a Razorpay-only purchase
  (see [PAYMENTS.md](PAYMENTS.md#13-google-play-payment-policy)).
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
- **Wallet payouts** are manual: Admin → *Payouts & payments* lists pending
  ones; pay them outside Memo, then *Mark paid* with the reference
  ([PAYMENTS.md](PAYMENTS.md#manual-payout-procedure)).

---

## 12. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Render deploy crashes: `column … does not exist` | The database is behind the code. Make sure the start command begins with `alembic upgrade head &&`, or run the migration by hand ([10.2](#102-database)) |
| Red screen: `Unable to resolve module react-native-…` | A new package wasn't installed: `npm install`, rebuild (`./gradlew clean`, `run-android`), then `npx react-native start --reset-cache` |
| 500 errors right after midnight: `duplicate key … uq_daily_records_user_date` | Fixed: several requests at once each tried to close the same day. Closing days now locks the user's streak row (`_lock_state` in `streaks/engine.py`), so they take turns |
| Red screen: "set the key `shadowColor` … frozen" | Fixed: the theme is applied once per session and never edits styles in use. Pull the latest code |
| `git pull` refuses: local changes to `package-lock.json` | Not real work (npm rewrote it): `git checkout -- MyApp/package-lock.json`, then pull |
| `git push` 403 "denied to <other user>" | The computer has another GitHub login saved. Push with the owner's account and a personal access token |
| Reminders late on Android | Allow exact alarms; turn off battery optimisation for Memo |
| Password-reset email doesn't arrive | Run the email check in [7.1](#71-backend-environment-backendenv-or-render-environment-variables); Gmail needs an App Password |
| The Vault locked while choosing a photo | Fixed: pickers no longer lock it. Pull the latest code |
| A WhatsApp number stays *Waiting for YES or STOP* | MSG91 must forward replies: create the Webhook (New) for *On Inbound Report Received* ([7.4](#74-whatsapp-number-permission)). Then look in the Render log ([7.4](#74-whatsapp-number-permission)): no `WhatsApp inbound` line means MSG91 isn't forwarding replies (set the incoming-message webhook); `refused` means the secret is missing or the token in the URL is wrong; `ignored: not YES or STOP` means the reply wasn't YES |
| WhatsApp reminders show *Failed* | The number hadn't replied YES within 5 minutes of the reminder time, or its owner replied STOP and didn't send YES again in those 5 minutes. Later reminders go out once they reply YES (or after *Send again* and a YES) |
| No weather on Home | Location wasn't allowed (Memo asks only once: turn it on in Android → Apps → Memo → Permissions → Location), the phone is offline, or Melo's corner is off in Settings |
| The widget's Melo doesn't move | Some launchers pause widget animations to save battery, or after the widget is resized; remove and re-add the widget |
| Melo shows the weather but not the city | The phone couldn't name the place (no Geocoder, or offline at that moment); the weather still shows, and the city appears at the next update (every 30 minutes) |
| *Continue with Google* signs straight into an old (or deleted) account without asking | Fixed: the app now forgets Google's last account before each Google sign-in (`getGoogleIdToken` in `src/modules/auth/google.ts`), so the account picker always opens. Before, if the session ended without *Sign out* (e.g. the user was removed from the database), Google silently reused the last account, and the server made a new Memo account for it |
| Android build: `Keystore file … memo-debug.keystore not found` | Debug builds are signed with your own `memo-debug.keystore` (its SHA-1 is registered for Google sign-in). Copy it into `MyApp/android/app/`; it isn't in git |

---

## 13. Before publishing to the stores

Done in the app: app id `com.memomelo.app`, release signing with an upload
key, version 2.1 (code 1), in-app **account deletion** (Settings → Account →
Delete account, confirmed with an emailed code) and the web page
**`/account/delete`**, the **privacy policy** at **`/privacy`** (linked in
Settings → Account), WhatsApp plan purchases off.

Still to do (outside the code):

1. **Backend first:** deploy this version to both Render services (adds
   migration `a1d5c9e3f7b2`, the pages and the deletion endpoints) and set
   `SUPPORT_EMAIL` (the contact shown on `/privacy` and `/account/delete`;
   use the same as the Play listing).
2. **Google sign-in for the new app id:** Google Cloud Console → APIs &
   Services → Credentials → Create credentials → OAuth client ID → Android:
   package `com.memomelo.app`, SHA-1 of the **upload key** (above). After the
   first upload, add another Android client with the **App signing key**
   SHA-1 from Play Console → Setup → App signing (the one users' phones see),
   and one with the debug SHA-1
   (`18:CB:52:CB:05:D0:E3:82:AC:CB:CA:84:2C:A5:53:F6:EB:0B:E9:42`) for debug
   builds. The backend's `GOOGLE_CLIENT_IDS` (the web client) stays as it is.
3. **Play Console:** create the app, upload `app-release.aab` (internal
   testing first), turn on Play App Signing.
4. **App content forms:** privacy policy URL
   (`https://tasks-wvlv.onrender.com/privacy`), account deletion URL
   (`…/account/delete`), Data safety (see below), content rating, target
   audience (not for children), ads: none.
5. **Permission declarations:** `USE_FULL_SCREEN_INTENT` (alarm reminders
   that ring full screen), exact alarms (reminders at the set minute),
   microphone (Vault voice notes), approximate location (weather on Home,
   asked once, used on the phone only).
6. **Data safety (what to declare):** collected: name, email, user IDs,
   photos (profile, Vault), audio (Vault voice notes), approximate location
   (used on device, sent only to the weather service), app content (plans,
   reminders, notes), phone numbers (WhatsApp reminders and payouts),
   purchase history (WhatsApp plan, when enabled). Encrypted in transit;
   users can request deletion; not sold; no ads.
7. **iOS:** set the bundle identifier and signing team in Xcode, and add the
   bundled fonts to the Xcode project.

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
