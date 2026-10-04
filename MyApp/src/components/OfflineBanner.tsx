import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, radius, spacing } from '../theme';
import { Icon } from './Icon';

/** A slim banner shown only while the device has no connection. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener(state => {
      setOffline(state.isConnected === false);
    });
  }, []);

  if (!offline) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="wifiOff" size={14} color={colors.warning} />
      <Text style={styles.text}>You're offline. Changes will need a connection to save.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: 20,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  text: {
    flex: 1,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
});
