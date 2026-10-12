/**
 * Entry point.
 *
 * The chosen accent color must be applied before any screen module creates
 * its StyleSheet, so the app is required lazily, after the accent has been
 * read from storage.
 */
import React, { useEffect, useState } from 'react';
import { AppRegistry, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { name as appName } from './app.json';
import { applyAccent, applyTheme, colors } from './src/theme';
import { ACCENT_STORAGE_KEY, THEME_STORAGE_KEY } from './src/utils/storage';
import notifee from 'react-native-notify-kit';
import { handleNotificationEvent } from './src/notifications';

// Stops a ringing alarm when Stop is pressed while the app is closed.
notifee.onBackgroundEvent(handleNotificationEvent);

// The theme is applied once per JavaScript session. Android can mount this
// component again in the same session (the activity is recreated, e.g. after
// the camera or a dark-mode switch); then the app is simply shown again.
let LoadedApp = null;

function Bootstrap() {
  const [App, setApp] = useState(() => LoadedApp);

  useEffect(() => {
    if (LoadedApp) return;
    AsyncStorage.getMany([ACCENT_STORAGE_KEY, THEME_STORAGE_KEY])
      .catch(() => [])
      .then(values => {
        applyTheme(values[THEME_STORAGE_KEY]);
        const accent = values[ACCENT_STORAGE_KEY];
        applyAccent(accent);
        LoadedApp = require('./App').default;
        setApp(() => LoadedApp);
      });
  }, []);

  return App ? <App /> : <View style={[styles.boot, { backgroundColor: colors.background }]} />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
  },
});

AppRegistry.registerComponent(appName, () => Bootstrap);
