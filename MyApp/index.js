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
import { applyAccent, colors } from './src/theme';
import { ACCENT_STORAGE_KEY } from './src/utils/storage';

function Bootstrap() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_STORAGE_KEY)
      .catch(() => null)
      .then(accent => {
        applyAccent(accent);
        setApp(() => require('./App').default);
      });
  }, []);

  return App ? <App /> : <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

AppRegistry.registerComponent(appName, () => Bootstrap);
