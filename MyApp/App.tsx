/**
 * Rememberly — root app component.
 *
 * Wires up the Redux store, the ant-design/react-native Provider, safe-area
 * handling, and session rehydration before handing off to RootNavigator
 * (src/navigation/RootNavigator.tsx), which owns all navigation structure.
 */
import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import AntProvider from '@ant-design/react-native/lib/provider';
import enUS from '@ant-design/react-native/lib/locale-provider/en_US';

import { store } from './src/app/store';
import { useAppDispatch, useAppSelector } from './src/app/hooks';
import { restoreSession, selectIsBootstrapped } from './src/modules/auth/authSlice';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoadingView } from './src/components/LoadingView';
import { initNotifications } from './src/notifications';
import { colors, radius } from './src/theme';

// Recolors antd-mobile-rn's own chrome (Toast, Modal, DatePicker, SearchBar)
// to match Rememberly's "Shonen Energy" palette, so every surface — not just
// our own custom components — reads as one consistent system.
const antTheme = {
  brand_primary: colors.primary,
  brand_primary_tap: colors.primaryDark,
  brand_success: colors.success,
  brand_warning: colors.warning,
  brand_error: colors.danger,
  color_text_base: colors.ink,
  color_text_paragraph: colors.ink,
  color_text_caption: colors.textMuted,
  color_text_placeholder: colors.textFaint,
  color_link: colors.primary,
  fill_body: colors.background,
  fill_base: colors.surface,
  border_color_base: colors.ink,
  radius_sm: radius.sm,
  radius_md: radius.md,
  radius_lg: radius.lg,
  toast_fill: 'rgba(20, 20, 31, 0.94)',
  primary_button_fill: colors.primary,
  primary_button_fill_tap: colors.primaryDark,
};

function AppContent() {
  const dispatch = useAppDispatch();
  const isBootstrapped = useAppSelector(selectIsBootstrapped);

  useEffect(() => {
    dispatch(restoreSession());
    initNotifications().catch(() => {
      // Permission denied or unsupported device — reminders will still save,
      // they just won't show a local notification until permission is granted.
    });
  }, [dispatch]);

  if (!isBootstrapped) {
    return (
      <View style={styles.splash}>
        <LoadingView label="Getting Rememberly ready…" />
      </View>
    );
  }

  return <RootNavigator />;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <View style={styles.flex}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <AntProvider locale={enUS} theme={antTheme}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <AppContent />
          </AntProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default App;
