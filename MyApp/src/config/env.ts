/**
 * Backend API configuration — the single place the app's backend URL is set.
 * Every request goes through the RTK Query client in src/api/baseApi.ts,
 * which uses API_BASE_URL.
 *
 * React Native has no build-time environment variables (no Vite/CRA/Next
 * style VITE_* or REACT_APP_*), so the URL is chosen here:
 *  - Release builds always talk to the production backend on Render (Singapore,
 *    next to the Mumbai database).
 *  - Debug builds (`npx react-native run-android`) use LOCAL_API_ORIGIN when
 *    USE_LOCAL_API is true, so local development keeps working. Set it to
 *    false to point a debug build at production.
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
const PRODUCTION_API_ORIGIN = 'https://tasks-singapore.onrender.com';
const LOCAL_API_ORIGIN = 'http://127.0.0.1:8003';
const USE_LOCAL_API = false;

/** The backend's API prefix (see Backend/app/api/router.py). */
const API_PREFIX = '/api/v1';

const origin = __DEV__ && USE_LOCAL_API ? LOCAL_API_ORIGIN : PRODUCTION_API_ORIGIN;

/** e.g. "https://tasks-singapore.onrender.com/api/v1" — no trailing slash, prefix added once. */
export const API_BASE_URL = `${origin.replace(/\/+$/, '')}${API_PREFIX}`;

/** Network request timeout, in milliseconds. */
export const API_TIMEOUT_MS = 15000;

/**
 * Google sign-in: the "Web application" OAuth client ID from Google Cloud
 * Console (it ends in .apps.googleusercontent.com). The app asks Google for
 * an ID token for this client, and the backend's GOOGLE_CLIENT_IDS must list
 * the same ID. Public by design, not a secret. Empty hides the Google button.
 */
export const GOOGLE_WEB_CLIENT_ID = '767574220578-iiqqa3hsofo25mg4bmsvn4hkoncr831o.apps.googleusercontent.com';
