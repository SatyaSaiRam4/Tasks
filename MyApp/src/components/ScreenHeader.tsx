import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../app/hooks';
import { selectCurrentUser } from '../modules/auth/authSlice';
import { colors, hitSlop, spacing, type as t } from '../theme';
import { useEntrance } from '../animations';
import { Wordmark } from './Brand';
import { Avatar, IconButton } from './Controls';

/**
 * Header for pushed screens: back/close button, a centered serif title,
 * optional right actions. Tab roots use LargeTitle instead.
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
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

/**
 * The brand bar at the top of every tab: the Memo mark on the left, then
 * any screen actions, Settings and the Profile avatar on the right.
 */
export function TopBar({
  actions,
  hideProfile = false,
  hideSettings = false,
}: {
  actions?: React.ReactNode;
  hideProfile?: boolean;
  hideSettings?: boolean;
}) {
  // Loosely typed: this bar is rendered inside both tab and stack screens.
  const navigation = useNavigation<{ navigate: (...args: unknown[]) => void }>();
  const user = useAppSelector(selectCurrentUser);
  return (
    <View style={styles.topBar}>
      <Wordmark />
      <View style={styles.topActions}>
        {actions}
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
            <Avatar name={user.display_name} emoji={user.avatar} size={40} />
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
  right,
  topBar = true,
  topBarActions,
  hideProfile,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
  topBar?: boolean;
  topBarActions?: React.ReactNode;
  hideProfile?: boolean;
}) {
  const enter = useEntrance(0, 700);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return (
    <View>
      {topBar ? <TopBar actions={topBarActions} hideProfile={hideProfile} /> : null}
      <Animated.View style={[styles.large, { opacity: enter, transform: [{ translateY }] }]}>
        <View style={styles.flex}>
          {eyebrow ? <Eyebrow label={eyebrow} /> : null}
          <Text style={[t.display, styles.largeTitle]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right ? <View style={styles.largeRight}>{right}</View> : null}
      </Animated.View>
    </View>
  );
}

/** A small champagne eyebrow with a leading rule: "—— TODAY". */
export function Eyebrow({ label, color }: { label: string; color?: string }) {
  return (
    <View style={styles.eyebrow}>
      <View style={[styles.eyebrowRule, color ? { backgroundColor: color } : null]} />
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
    paddingBottom: spacing.lg,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...t.heading,
    fontSize: 20,
  },
  subtitle: {
    ...t.caption,
    marginTop: 1,
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
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  largeTitle: {
    marginTop: spacing.sm,
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
    width: 18,
    height: 1,
    backgroundColor: colors.goldLine,
  },
});
