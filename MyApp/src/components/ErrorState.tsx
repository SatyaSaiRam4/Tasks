import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { border, colors, fontSize, radius, spacing } from '../theme';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** A consistent error state for list/detail screens, used instead of a blank screen. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.glyphCircle}>
        <Text style={styles.glyph}>!</Text>
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <AppButton label="Try again" variant="danger" onPress={onRetry} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  glyphCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    borderWidth: border.thick,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  glyph: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.danger,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.ink,
  },
  message: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.lg,
    minWidth: 160,
  },
});
