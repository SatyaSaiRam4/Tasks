import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, gradients, motion, radius, spacing, type as t } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Button } from './Button';
import { Glow, Gradient } from './Gradient';
import { Icon, type IconName } from './Icon';

// ---- FadeIn ------------------------------------------------------------------------

/** Fades and lifts its children in; staggered by `index`. Instant under reduced motion. */
export function FadeIn({ children, index = 0, style, distance = 12 }: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle>; distance?: number }) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    Animated.timing(value, {
      toValue: 1,
      duration: motion.slow,
      delay: index * motion.stagger,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, reduced, value]);
  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: value, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

// ---- Skeleton ------------------------------------------------------------------------

export function Skeleton({ width = '100%', height = 16, rounded = radius.sm, style }: { width?: number | `${number}%`; height?: number; rounded?: number; style?: StyleProp<ViewStyle> }) {
  const { reduced } = useMotion();
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.surfaceHigh, opacity: pulse }, style]} />;
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
      <View style={styles.emptyArt}>
        <Glow color={colors.primary} size={160} intensity={0.35} style={StyleSheet.absoluteFill} />
        <Gradient colors={gradients.surface} borderRadius={radius.xl} style={styles.emptyIcon}>
          <Icon name={icon} size={30} color={colors.primary} />
        </Gradient>
      </View>
      <Text style={[t.heading, styles.center]}>{title}</Text>
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
      <View style={[styles.emptyIcon, styles.errorIcon]}>
        <Icon name="alert" size={28} color={colors.danger} />
      </View>
      <Text style={[t.heading, styles.center]}>Something went wrong</Text>
      <Text style={[t.body, styles.emptyMessage]}>{message}</Text>
      {onRetry ? <Button label="Try again" icon="refresh" variant="secondary" onPress={onRetry} fullWidth={false} style={styles.emptyAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyCompact: {
    paddingVertical: spacing.xl,
  },
  emptyArt: {
    width: 160,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  errorIcon: {
    backgroundColor: colors.dangerSoft,
    marginBottom: spacing.lg,
  },
  emptyMessage: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyAction: {
    marginTop: spacing.xl,
    alignSelf: 'center',
  },
});
