import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, type as t, withAlpha } from '../theme';
import { riseStyle, useEntrance } from '../animations';
import { useLayout } from '../hooks/useLayout';
import { Wordmark } from './Brand';
import { IconButton } from './Controls';
import { Gradient } from './Gradient';
import { ProfileMenu } from '../modules/users/ProfileMenu';

/**
 * Header for pushed screens: back/close button, a centered serif title and
 * an optional right action. Tab roots use TopBar + LargeTitle instead.
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
  const drop = useEntrance(0, 420);
  return (
    <Animated.View style={[styles.row, riseStyle(drop, -14)]}>
      <IconButton
        icon={close ? 'x' : 'chevron-left'}
        accessibilityLabel={close ? 'Close' : 'Back'}
        onPress={onBack ?? (() => navigation.goBack())}
      />
      <View style={styles.titles}>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {title ? (
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </Animated.View>
  );
}

/**
 * The brand bar at the top of every tab: the Memo mark on the left, then
 * screen actions and the user's profile picture on the right. The picture
 * opens a menu with Find a friend, Wallet and Settings. Reminders and
 * Profile live in the tab bar, which is on every screen. With the desktop
 * rail the mark lives in the rail.
 */
export function TopBar({ actions }: { actions?: React.ReactNode }) {
  const { hasRail } = useLayout();
  const drop = useEntrance(0, 420);
  return (
    <Animated.View style={[styles.topBar, hasRail && styles.topBarRail, riseStyle(drop, -14)]}>
      {hasRail ? <View /> : <Wordmark size="sm" />}
      <View style={styles.topActions}>
        {actions}
        <ProfileMenu />
      </View>
    </Animated.View>
  );
}

/** The title block at the top of each tab, under the brand bar. */
export function LargeTitle({
  eyebrow,
  title,
  subtitle,
  right,
  topBar = true,
  topBarActions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  topBar?: boolean;
  topBarActions?: React.ReactNode;
}) {
  const enter = useEntrance(60, 760);
  return (
    <View>
      {topBar ? <TopBar actions={topBarActions} /> : null}
      <Animated.View style={[styles.large, riseStyle(enter, 16)]}>
        <View style={styles.flex}>
          {eyebrow ? <Eyebrow label={eyebrow} /> : null}
          <Text style={styles.largeTitle} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.largeSubtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.largeRight}>{right}</View> : null}
      </Animated.View>
    </View>
  );
}

/** A small champagne eyebrow with a leading rule: "—— TODAY". */
export function Eyebrow({ label, color, style }: { label: string; color?: string; style?: object }) {
  return (
    <View style={[styles.eyebrow, style]}>
      <Gradient
        colors={[withAlpha(color ?? colors.gold, 0), color ?? colors.gold]}
        direction="horizontal"
        style={styles.eyebrowRule}
      />
      <Text style={[t.micro, color ? { color } : null]}>{label}</Text>
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
  title: {
    ...t.heading,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  subtitle: {
    ...t.micro,
    fontSize: 9.5,
    marginBottom: 2,
  },
  right: {
    minWidth: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  topBarRail: {
    paddingTop: spacing.sm,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  largeTitle: {
    ...t.title,
  },
  largeSubtitle: {
    ...t.aside,
    marginTop: spacing.xs,
  },
  largeRight: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: 6,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrowRule: {
    width: 22,
    height: 1,
  },
});
