/**
 * Google sign-in on the device (@react-native-google-signin/google-signin).
 * The app gets an ID token from Google and the backend checks it with Google
 * (POST /auth/google). Off until GOOGLE_WEB_CLIENT_ID is set in config/env.ts.
 */
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../../config/env';

export const googleEnabled = Boolean(GOOGLE_WEB_CLIENT_ID);

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/**
 * Opens Google's account picker. Resolves with an ID token, or null if the
 * user backed out. Throws a readable Error for real failures.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  configure();
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

export async function signOutOfGoogle(): Promise<void> {
  if (!googleEnabled) return;
  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google: nothing to do
  }
}
