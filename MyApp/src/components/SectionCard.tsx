import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Panel } from './Panel';
import { colors, fontSize, spacing, typography } from '../theme';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

/** A titled, ink-bordered panel used to group related content on a screen. */
export function SectionCard({ title, subtitle, right, children, style }: SectionCardProps) {
  return (
    <Panel style={[styles.wrap, style]} contentStyle={styles.card}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </Panel>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    fontSize: fontSize.lg,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
});
