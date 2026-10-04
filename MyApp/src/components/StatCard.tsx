import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Panel } from './Panel';
import { border, colors, fontSize, radius, spacing } from '../theme';

interface StatCardProps {
  label: string;
  value: number | string;
  accentColor?: string;
  glyph?: string;
}

/** A single stat tile used in grids (e.g. the admin dashboard). */
export function StatCard({ label, value, accentColor = colors.primary, glyph }: StatCardProps) {
  return (
    <Panel style={styles.wrap} contentStyle={styles.card}>
      <View style={[styles.accentChip, { backgroundColor: accentColor }]}>
        <Text style={styles.accentGlyph}>{glyph ?? '•'}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexBasis: '47%',
    flexGrow: 1,
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.lg,
  },
  accentChip: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  accentGlyph: {
    fontSize: fontSize.md,
  },
  value: {
    fontSize: fontSize.xxl,
    fontWeight: '900',
    color: colors.ink,
  },
  label: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '700',
  },
});
