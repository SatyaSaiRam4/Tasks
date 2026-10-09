/**
 * Entry point.
 *
 * The chosen accent color must be applied before any screen module creates
 * its StyleSheet, so the app is required lazily, after the accent has been
 * read from storage.
 */
import React, { useEffect, useState } from 'react';
import { AppRegistry, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { name as appName } from './app.json';
import { applyAccent, applyTheme, colors } from './src/theme';
import { ACCENT_STORAGE_KEY, THEME_STORAGE_KEY } from './src/utils/storage';
import notifee from 'react-native-notify-kit';
import { handleNotificationEvent } from './src/notifications';

// Stops a ringing alarm when Stop is pressed while the app is closed.
notifee.onBackgroundEvent(handleNotificationEvent);

function Bootstrap() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    AsyncStorage.getMany([ACCENT_STORAGE_KEY, THEME_STORAGE_KEY])
      .catch(() => [])
      .then(values => {
        applyTheme(values[THEME_STORAGE_KEY]);
        const accent = values[ACCENT_STORAGE_KEY];
        applyAccent(accent);
        setApp(() => require('./App').default);
      });
  }, []);

  return App ? <App /> : <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

AppRegistry.registerComponent(appName, () => Bootstrap);
