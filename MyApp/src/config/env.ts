/**
 * Backend API configuration: the single place the app's backend URLs are set.
 * Every request goes through src/api/baseApi.ts, which picks one of these
 * (src/api/servers.ts) and moves to the next when it's down.
 *
 * React Native has no build-time environment variables (no Vite/CRA/Next
 * style VITE_* or REACT_APP_*), so the URLs are chosen here:
 *  - Release builds talk to the production backend, which runs as two Render
 *    services with the same code and the same database. Whichever is up is
 *    used; the app switches by itself if one is asleep, suspended or down.
 *  - Debug builds (`npx react-native run-android`) use LOCAL_API_ORIGIN only
 *    when USE_LOCAL_API is true, so local development keeps working. Set it
 *    to false to point a debug build at production.
 *
 * Local origin, by setup:
 *  - Android emulator: "http://10.0.2.2:8000" (the host machine's localhost).
 *  - Physical device over USB: run `adb reverse tcp:8003 tcp:8003`, then
 *    "http://127.0.0.1:8003" reaches the backend on your machine.
 *  - Physical device over Wi-Fi: your machine's LAN IP, e.g.
 *    "http://192.168.1.23:8000", with the backend started with --host 0.0.0.0.
 *
 * Only public URLs belong here: anything in the app bundle can be read by users.
 */
// In order of preference: tasks-wvlv is the active one; tasks-singapore is the backup.
const PRODUCTION_API_ORIGINS = ['https://tasks-wvlv.onrender.com', 'https://tasks-singapore.onrender.com'];
const LOCAL_API_ORIGIN = 'http://127.0.0.1:8003';
const USE_LOCAL_API = false;

/** The backend's API prefix (see Backend/app/api/router.py). */
export const API_PREFIX = '/api/v1';

/** Every backend the app may use, in order of preference. */
export const API_ORIGINS: string[] = __DEV__ && USE_LOCAL_API ? [LOCAL_API_ORIGIN] : PRODUCTION_API_ORIGINS;

/**
 * Whether this build lets people buy the WhatsApp plan (₹30 via Razorpay).
 * Off for the Google Play release: Play doesn't allow selling an in-app
 * feature with Razorpay alone (see PAYMENTS.md, "Google Play payment
 * policy"). Users still get their 3 free WhatsApp reminders and see their
 * allowance; the plan shows as coming soon. Turn on only for builds where
 * that's allowed (or once Play Billing is added).
 */
export const PLAN_PURCHASE_ENABLED = false;

/** Network request timeout, in milliseconds. */
export const API_TIMEOUT_MS = 15000;

/**
 * Google sign-in: the "Web application" OAuth client ID from Google Cloud
 * Console (it ends in .apps.googleusercontent.com). The app asks Google for
 * an ID token for this client, and the backend's GOOGLE_CLIENT_IDS must list
 * the same ID. Public by design, not a secret. Empty hides the Google button.
 */
export const GOOGLE_WEB_CLIENT_ID = '767574220578-iiqqa3hsofo25mg4bmsvn4hkoncr831o.apps.googleusercontent.com';
