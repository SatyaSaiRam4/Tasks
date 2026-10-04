import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ActivityIndicator from '@ant-design/react-native/lib/activity-indicator';
import { colors, fontSize, spacing } from '../theme';

interface LoadingViewProps {
  label?: string;
  fullscreen?: boolean;
}

export function LoadingView({ label = 'Loading…', fullscreen = true }: LoadingViewProps) {
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  fullscreen: {
    flex: 1,
  },
  label: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
