import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, type as t } from '../theme';
import { IconButton } from './Controls';

/**
 * Header for pushed screens: back/close button, title, optional right actions.
 * Tab roots use LargeTitle instead.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  close = false,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  close?: boolean;
  onBack?: () => void;
}) {
  const navigation = useNavigation();
  return (
    <View style={styles.row}>
      <IconButton
        icon={close ? 'x' : 'chevron-left'}
        accessibilityLabel={close ? 'Close' : 'Back'}
        onPress={onBack ?? (() => navigation.goBack())}
      />
      <View style={styles.titles}>
        {title ? (
          <Text style={t.subtitle} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={t.caption} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

/** The big title at the top of each tab. */
export function LargeTitle({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.large}>
      <View style={styles.flex}>
        {eyebrow ? <Text style={t.micro}>{eyebrow}</Text> : null}
        <Text style={[t.display, styles.largeTitle]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right ? <View style={styles.largeRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    minWidth: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  largeTitle: {
    marginTop: 4,
    color: colors.text,
  },
  largeRight: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: 4,
  },
});
