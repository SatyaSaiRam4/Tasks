import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, motion, radius, spacing, type as t } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { easeOut } from '../animations';
import { Button } from './Button';
import { Emblem } from './Emblem';
import { Gradient } from './Gradient';
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

/** A loading placeholder with a slow champagne shimmer sweeping across it. */
export function Skeleton({ width = '100%', height = 16, rounded = radius.sm, style }: { width?: number | `${number}%`; height?: number; rounded?: number; style?: StyleProp<ViewStyle> }) {
  const { reduced } = useMotion();
  const sweep = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (reduced || !w) return;
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, reduced, w]);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: rounded }, styles.skeleton, style]}
    >
      {w && !reduced ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <View style={styles.shimmerRow}>
            <Gradient colors={['rgba(217,188,130,0)', 'rgba(217,188,130,0.07)']} direction="horizontal" style={styles.flex} />
            <Gradient colors={['rgba(217,188,130,0.07)', 'rgba(217,188,130,0)']} direction="horizontal" style={styles.flex} />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
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
      <Emblem icon={icon} size={compact ? 128 : 168} />
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
      <Emblem icon="alert" size={140} tint={colors.danger} ring={[colors.danger, '#8A4B5A']} />
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
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  shimmerRow: {
    flex: 1,
    flexDirection: 'row',
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
    marginTop: spacing.xs,
  },
  emptyMessage: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyAction: {
    marginTop: spacing.xl,
    alignSelf: 'center',
  },
});
