/**
 * Google sign-in on the device (@react-native-google-signin/google-signin).
 * The app gets an ID token from Google and the backend checks it with Google
 * (POST /auth/google). Off until GOOGLE_WEB_CLIENT_ID is set in config/env.ts.
 *
 * The library is loaded only when needed, and only if its native part is in
 * this build of the app: an app installed before the library was added (or
 * a build without it) simply has no Google button, instead of crashing.
 */
import { TurboModuleRegistry } from 'react-native';
import type * as GoogleSigninModule from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../../config/env';

type Lib = typeof GoogleSigninModule;

/** True when this build contains the native Google Sign-In module. */
function hasNativeModule(): boolean {
  try {
    return TurboModuleRegistry.get('RNGoogleSignin') != null;
  } catch {
    return false;
  }
}

export const googleEnabled = Boolean(GOOGLE_WEB_CLIENT_ID) && hasNativeModule();

let lib: Lib | null = null;
/** The library, configured once; null when Google sign-in isn't available. */
function google(): Lib | null {
  if (!googleEnabled) return null;
  if (!lib) {
    const loaded: Lib = require('@react-native-google-signin/google-signin');
    loaded.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    lib = loaded;
  }
  return lib;
}

/**
 * Opens Google's account picker. Resolves with an ID token, or null if the
 * user backed out. Throws a readable Error for real failures.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  const g = google();
  if (!g) throw new Error('Google sign-in isn’t available in this version of the app.');
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = g;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null; // cancelled
    if (!response.data.idToken) throw new Error('Google didn’t return a sign-in token. Please try again.');
    return response.data.idToken;
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services are needed for Google sign-in.');
      // DEVELOPER_ERROR (code 10): Google doesn't know this app's package + signing
      // SHA-1 (an Android OAuth client in the same project as the web client).
      if (String(err.code) === '10' || err.code === 'DEVELOPER_ERROR') {
        throw new Error('Google sign-in isn’t set up for this build of the app yet.');
      }
      throw new Error(`Google sign-in didn’t work (${err.code}). Please try again.`);
    }
    throw err instanceof Error ? err : new Error('Google sign-in failed.');
  }
}

/** Signs out of Google too, so the next sign-in shows the account picker. Never throws. */
export async function signOutOfGoogle(): Promise<void> {
  try {
    await google()?.GoogleSignin.signOut();
  } catch {
    // not signed in with Google, or not available: nothing to do
  }
}
