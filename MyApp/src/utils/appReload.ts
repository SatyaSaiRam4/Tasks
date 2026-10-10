import { DevSettings, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** The screen to reopen after a reload (read once by RootNavigator). */
export const REOPEN_SCREEN_KEY = '@memo/reopen_screen';

/**
 * Restarts the app's JavaScript in place, so a new theme or accent applies
 * at once (screen styles are built when the JS starts). Android uses the
 * AppReload native module; debug builds anywhere fall back to the dev
 * reload. Returns false when neither is available (iOS release), in which
 * case the change applies the next time the app opens.
 */
export async function reloadApp(reopen?: 'Settings'): Promise<boolean> {
  const native = NativeModules.AppReload as { reload?: (reason: string) => void } | undefined;
  const canReload = Boolean(native?.reload) || __DEV__;
  if (!canReload) return false;
  if (reopen) await AsyncStorage.setItem(REOPEN_SCREEN_KEY, reopen).catch(() => undefined);
  if (native?.reload) native.reload('Appearance changed');
  else DevSettings.reload('Appearance changed');
  return true;
}

/** Fades out the snapshot laid over the screen during a reload (Android). */
export function hideReloadCover() {
  const native = NativeModules.AppReload as { hideCover?: () => void } | undefined;
  native?.hideCover?.();
}
