import React from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, gradients, radius, shadow, spacing } from '../theme';
import { usePressScale } from '../animations';
import { Gradient } from './Gradient';

type Tone = 'default' | 'glass' | 'feature';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Gradient fill instead of the layered surface. */
  gradient?: [string, string] | readonly [string, string];
  gradientOpacity?: [number, number];
  /**
   * `default` is the layered midnight surface, `glass` a lighter translucent
   * pane, `feature` a moonlit hero surface with a champagne edge.
   */
  tone?: Tone;
  /** A thin accent-colored edge on the left, e.g. a Track's color. */
  accent?: string;
  padded?: boolean;
  elevated?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * The base surface for every card: a layered midnight pane with a warm
 * hairline edge and a faint light catching its top. Pressable cards sink
 * slightly under the finger.
 */
export function Card({
  children,
  style,
  contentStyle,
  onPress,
  onLongPress,
  gradient,
  gradientOpacity,
  tone = 'default',
  accent,
  padded = true,
  elevated = true,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const press = usePressScale(0.975);

  const fill = gradient ?? (tone === 'feature' ? gradients.moonlight : tone === 'glass' ? null : gradients.surface);
  const body = (
    <>
      <View style={styles.sheen} pointerEvents="none" />
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      <View style={[padded && styles.padded, contentStyle]}>{children}</View>
    </>
  );

  const surface = fill ? (
    <Gradient
      colors={fill}
      direction="vertical"
      opacity={gradientOpacity}
      borderRadius={radius.lg}
      style={[styles.base, tone === 'feature' ? styles.featureBorder : styles.border, styles.fill]}
    >
      {body}
    </Gradient>
  ) : (
    <View style={[styles.base, styles.glass, styles.border, styles.fill]}>{body}</View>
  );

  const outer = [elevated && shadow.card, styles.radius, style];

  if (!onPress && !onLongPress) {
    return <View style={outer}>{surface}</View>;
  }

  return (
    <Animated.View style={[outer, { transform: [{ scale: press.scale }] }]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        android_ripple={{ color: 'rgba(217,188,130,0.06)' }}
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
  base: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  glass: {
    backgroundColor: colors.glass,
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  featureBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(241,221,175,0.35)',
  },
  padded: {
    padding: spacing.xl,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
