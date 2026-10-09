/**
 * Memo — root app component.
 *
 * Wires up Redux, the ant-design/react-native provider (recolored to the
 * selected theme), safe areas, session rehydration, and the app-wide
 * providers (celebrations, the Action completion flow), then hands off to
 * RootNavigator (src/navigation/RootNavigator.tsx), which owns all navigation.
 */
import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import AntProvider from '@ant-design/react-native/lib/provider';
import enUS from '@ant-design/react-native/lib/locale-provider/en_US';

import { store } from './src/app/store';
import { useAppDispatch, useAppSelector } from './src/app/hooks';
import { restoreSession, selectIsAuthenticated, selectIsBootstrapped } from './src/modules/auth/authSlice';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initNotifications, loadAlarmPreferences, subscribeToNotificationEvents } from './src/notifications';
import { colors, radius } from './src/theme';
import { CelebrationProvider } from './src/components/Celebration';
import { CompletionProvider } from './src/modules/routines/CompletionProvider';
import { BackgroundSync } from './src/modules/home/BackgroundSync';
import { VaultAutoLock } from './src/modules/vault/VaultAutoLock';
import { Wordmark } from './src/components/Brand';
import { Glow } from './src/components/Gradient';
import { Backdrop } from './src/layouts/Backdrop';

// Recolors antd-mobile-rn's own chrome (Toast, DatePicker) to match the selected theme.
const antTheme = {
  brand_primary: colors.primary,
  brand_primary_tap: colors.primarySecondary,
  brand_success: colors.success,
  brand_warning: colors.warning,
  brand_error: colors.danger,
  color_text_base: colors.text,
  color_text_paragraph: colors.textSecondary,
  color_text_caption: colors.textSecondary,
  color_text_placeholder: colors.textTertiary,
  color_link: colors.primary,
  fill_body: colors.background,
  fill_base: colors.backgroundRaised,
  fill_tap: colors.surfaceAlt,
  fill_grey: colors.surface,
  border_color_base: colors.border,
  border_color_thin: colors.goldLine,
  fill_mask: colors.overlay,
  color_text_base_inverse: '#F3EEE3',
  picker_item_height: 42,
  picker_header_height: 52,
  radius_sm: radius.sm,
  radius_md: radius.md,
  radius_lg: radius.lg,
  toast_fill: 'rgba(11, 17, 34, 0.96)',
  primary_button_fill: colors.primary,
  primary_button_fill_tap: colors.primarySecondary,
};

function AppContent() {
  const dispatch = useAppDispatch();
  const isBootstrapped = useAppSelector(selectIsBootstrapped);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    dispatch(restoreSession());
    initNotifications().catch(() => {
      // Permission denied: everything still saves, notifications just won't show.
    });
    loadAlarmPreferences();
    // Stops a ringing alarm when its Stop button is pressed with the app open.
    return subscribeToNotificationEvents();
  }, [dispatch]);

  if (!isBootstrapped) {
    return (
      <View style={styles.splash} accessibilityLabel="Loading Memo">
        <Backdrop />
        <View style={styles.splashMark}>
          <Glow color={colors.gold} size={320} intensity={0.22} style={styles.splashGlow} />
          <Wordmark size="lg" />
        </View>
      </View>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <>
          <BackgroundSync />
          <VaultAutoLock />
        </>
      ) : null}
      <RootNavigator />
    </>
  );
}

function App() {
  return (
    <View style={styles.flex}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <AntProvider locale={enUS} theme={antTheme}>
            <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} />
            <CelebrationProvider>
              <CompletionProvider>
                <AppContent />
              </CompletionProvider>
            </CelebrationProvider>
          </AntProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splashMark: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashGlow: {
    position: 'absolute',
  },
});

export default App;
