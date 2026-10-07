import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Gradient } from './Gradient';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Gradient fill instead of the flat surface. */
  gradient?: [string, string] | readonly [string, string];
  gradientOpacity?: [number, number];
  /** A thin accent-colored edge on the left, e.g. a Track's color. */
  accent?: string;
  padded?: boolean;
  elevated?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * The base surface for every card: rounded, hairline-bordered, softly
 * elevated. Pressable cards scale down slightly on press.
 */
export function Card({
  children,
  style,
  contentStyle,
  onPress,
  onLongPress,
  gradient,
  gradientOpacity,
  accent,
  padded = true,
  elevated = true,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const { reduced } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    if (reduced) return;
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };

  const body = (
    <>
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      <View style={[padded && styles.padded, contentStyle]}>{children}</View>
    </>
  );

  const surface = gradient ? (
    <Gradient colors={gradient} opacity={gradientOpacity} borderRadius={radius.lg} style={[styles.border, styles.fill]}>
      {body}
    </Gradient>
  ) : (
    <View style={[styles.surface, styles.border, styles.fill]}>{body}</View>
  );

  const outer = [elevated && shadow.card, styles.radius, style];

  if (!onPress && !onLongPress) {
    return <View style={outer}>{surface}</View>;
  }

  return (
    <Animated.View style={[outer, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        android_ripple={{ color: colors.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(29,41,47,0.06)' }}
        style={[styles.radius, styles.fill]}
      >
        {surface}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  radius: {
    borderRadius: radius.lg,
  },
  // When a parent row stretches the card (e.g. side-by-side cards of unequal
  // height), the surface must grow with it or a bare strip shows underneath.
  fill: {
    flexGrow: 1,
  },
  surface: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  padded: {
    padding: spacing.lg,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
});
