import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../app/hooks';
import { selectCurrentUser } from '../modules/auth/authSlice';
import { colors, hitSlop, spacing, type as t, withAlpha } from '../theme';
import { riseStyle, useEntrance } from '../animations';
import { useLayout } from '../hooks/useLayout';
import { Wordmark } from './Brand';
import { Avatar, IconButton } from './Controls';
import { Gradient } from './Gradient';

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
  return (
    <View style={styles.row}>
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
    </View>
  );
}

type Navigate = { navigate: (...args: unknown[]) => void };

/**
 * The brand bar at the top of every tab: the Memo mark on the left, then
 * screen actions, Notifications (Reminders), Settings and the Profile
 * avatar on the right. With the desktop rail the mark lives in the rail.
 */
export function TopBar({
  actions,
  hideProfile = false,
  hideSettings = false,
  hideNotifications = false,
}: {
  actions?: React.ReactNode;
  hideProfile?: boolean;
  hideSettings?: boolean;
  hideNotifications?: boolean;
}) {
  // Loosely typed: this bar is rendered inside both tab and stack screens.
  const navigation = useNavigation<Navigate>();
  const user = useAppSelector(selectCurrentUser);
  const { hasRail } = useLayout();
  return (
    <View style={[styles.topBar, hasRail && styles.topBarRail]}>
      {hasRail ? <View /> : <Wordmark size="sm" />}
      <View style={styles.topActions}>
        {actions}
        {hideNotifications ? null : (
          <IconButton
            icon="bell"
            accessibilityLabel="Reminders"
            onPress={() => navigation.navigate('Main', { screen: 'RemindersTab' })}
          />
        )}
        {hideSettings ? null : (
          <IconButton icon="settings" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />
        )}
        {hideProfile || !user ? null : (
          <Pressable
            onPress={() => navigation.navigate('Main', { screen: 'ProfileTab' })}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Avatar name={user.display_name} emoji={user.avatar} size={42} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The editorial title block at the top of each tab, under the brand bar. */
export function LargeTitle({
  eyebrow,
  title,
  subtitle,
  right,
  topBar = true,
  topBarActions,
  hideProfile,
  hideNotifications,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  topBar?: boolean;
  topBarActions?: React.ReactNode;
  hideProfile?: boolean;
  hideNotifications?: boolean;
}) {
  const enter = useEntrance(60, 760);
  return (
    <View>
      {topBar ? <TopBar actions={topBarActions} hideProfile={hideProfile} hideNotifications={hideNotifications} /> : null}
      <Animated.View style={[styles.large, riseStyle(enter, 16)]}>
        <View style={styles.flex}>
          {eyebrow ? <Eyebrow label={eyebrow} /> : null}
          <Text style={[t.display, styles.largeTitle]} accessibilityRole="header">
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...t.heading,
    fontSize: 22,
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
    alignItems: 'flex-end',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  largeTitle: {
    marginTop: spacing.md,
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
