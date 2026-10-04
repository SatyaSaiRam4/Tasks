import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '../modules/auth/authSlice';

const KEYS = {
  ACCESS_TOKEN: '@rememberly/access_token',
  REFRESH_TOKEN: '@rememberly/refresh_token',
  USER: '@rememberly/user',
} as const;

export interface StoredSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/** Persists the session so it survives an app restart. */
export async function saveSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setMany({
    [KEYS.ACCESS_TOKEN]: session.accessToken,
    [KEYS.REFRESH_TOKEN]: session.refreshToken,
    [KEYS.USER]: JSON.stringify(session.user),
  });
}

/** Reads the persisted session, if any. Returns null if incomplete/missing/corrupt. */
export async function loadSession(): Promise<StoredSession | null> {
  const values = await AsyncStorage.getMany([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER]);
  const accessToken = values[KEYS.ACCESS_TOKEN];
  const refreshToken = values[KEYS.REFRESH_TOKEN];
  const userRaw = values[KEYS.USER];

  if (!accessToken || !refreshToken || !userRaw) {
    return null;
  }

  try {
    const user = JSON.parse(userRaw) as AuthUser;
    return { user, accessToken, refreshToken };
  } catch {
    return null;
  }
}

/** Clears the persisted session (logout, or refresh failure). */
export async function clearSession(): Promise<void> {
  await AsyncStorage.removeMany([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER]);
}

/** The chosen accent name; read at startup before any styles are created. */
export const ACCENT_STORAGE_KEY = '@rememberly/accent';
