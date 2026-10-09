import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, motion, radius, spacing, type as t } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { easeOut } from '../animations';
import { Button } from './Button';
import { Emblem } from './Emblem';
import { type IconName } from './Icon';

// ---- FadeIn ------------------------------------------------------------------------

/** Fades and lifts its children in; staggered by `index`. Instant under reduced motion. */
export function FadeIn({ children, index = 0, style, distance = 16 }: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle>; distance?: number }) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    Animated.timing(value, {
      toValue: 1,
      duration: motion.slow + 120,
      delay: index * motion.stagger,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [index, reduced, value]);
  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: value, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

// ---- Skeleton ------------------------------------------------------------------------

/**
 * A loading placeholder: a quiet surface that breathes softly, so screens
 * waiting for data look calm rather than busy. All placeholders pulse in
 * step, because they share one clock.
 */
export function Skeleton({ width = '100%', height = 16, rounded = radius.sm, style }: { width?: number | `${number}%`; height?: number; rounded?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useBreath();
  return <Animated.View style={[{ width, height, borderRadius: rounded, opacity }, styles.skeleton, style]} />;
}

let breath: Animated.Value | null = null;
let breathers = 0;
let breathLoop: Animated.CompositeAnimation | null = null;

/** One shared 0.45 → 1 → 0.45 pulse for every skeleton on screen. */
function useBreath() {
  const { reduced } = useMotion();
  if (!breath) breath = new Animated.Value(0.7);
  const value = breath;
  useEffect(() => {
    if (reduced) {
      value.setValue(0.7);
      return;
    }
    breathers += 1;
    if (breathers === 1) {
      breathLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      breathLoop.start();
    }
    return () => {
      breathers -= 1;
      if (breathers === 0) breathLoop?.stop();
    };
  }, [reduced, value]);
  return value;
}

/** A ready-made skeleton for a list of cards. */
export function SkeletonList({ count = 3, height = 76 }: { count?: number; height?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} rounded={radius.lg} style={{ marginBottom: spacing.md }} />
      ))}
    </View>
  );
}

// ---- Empty / error states ------------------------------------------------------------

export function EmptyState({
  icon = 'sparkles',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <FadeIn style={[styles.empty, compact && styles.emptyCompact]}>
      <Emblem icon={icon} size={compact ? 132 : 176} />
      <Text style={[t.heading, styles.center, styles.emptyTitle]}>{title}</Text>
      {message ? <Text style={[t.body, styles.emptyMessage]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} style={styles.emptyAction} icon="plus" />
      ) : null}
    </FadeIn>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <Emblem icon="alert" size={150} tint={colors.danger} ring={[colors.danger, colors.danger]} />
      <Text style={[t.heading, styles.center, styles.emptyTitle]}>Something went wrong</Text>
      <Text style={[t.body, styles.emptyMessage]}>{message}</Text>
      {onRetry ? <Button label="Try again" icon="refresh" variant="secondary" onPress={onRetry} fullWidth={false} style={styles.emptyAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyCompact: {
    paddingVertical: spacing.md,
  },
  emptyTitle: {
    marginTop: spacing.sm,
    fontSize: 26,
    lineHeight: 30,
  },
  emptyMessage: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 340,
  },
  emptyAction: {
    marginTop: spacing.xl,
    alignSelf: 'center',
  },
});
