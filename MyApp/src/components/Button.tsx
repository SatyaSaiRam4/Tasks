import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, gradients, radius, shadow, spacing, TOUCH_TARGET, type as t } from '../theme';
import { usePressScale } from '../animations';
import { Gradient, Sheen } from './Gradient';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost' | 'success';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const HEIGHT: Record<Size, number> = { lg: 56, md: 50, sm: 38 };
const LABEL: Record<Size, number> = { lg: 15, md: 14.5, sm: 13 };

/**
 * The one button used everywhere, pill-shaped. `primary` is a satin
 * champagne (accent) gradient with dark ink and a soft glow, `secondary` a
 * glass button with a fine gold edge, `ghost` text-only, `danger` (and the
 * text-only `dangerGhost`) for destructive actions only, `success` for
 * completion confirmations.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const press = usePressScale(0.97);
  const isDisabled = disabled || loading;
  // A disabled call to action rests as a quiet outline instead of a dimmed gold.
  const muted = disabled && !loading && (variant === 'primary' || variant === 'success');
  const filled = !muted && (variant === 'primary' || variant === 'success');

  const textColor = muted
    ? colors.textTertiary
    : filled
    ? colors.onPrimary
    : variant === 'danger' || variant === 'dangerGhost'
      ? colors.danger
      : variant === 'ghost'
        ? colors.primary
        : colors.text;

  const iconSize = size === 'sm' ? 15 : 17;
  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={iconSize} color={textColor} strokeWidth={2} /> : null}
          <Text style={[styles.label, { color: textColor, fontSize: LABEL[size] }]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={iconSize} color={textColor} strokeWidth={2} /> : null}
        </>
      )}
    </View>
  );

  const height = { height: HEIGHT[size], minHeight: Math.max(HEIGHT[size], size === 'sm' ? 0 : TOUCH_TARGET) };
  let body: React.ReactNode;
  if (filled) {
    body = (
      <Gradient
        colors={variant === 'success' ? gradients.success : gradients.primary}
        direction="diagonal"
        borderRadius={radius.pill}
        style={[styles.base, styles.filled, height, size === 'sm' && styles.small]}
      >
        {/* A soft highlight along the top edge, like light on satin. */}
        <Sheen color={gradients.satinSheen} inset="14%" />
        {content}
      </Gradient>
    );
  } else {
    body = (
      <View
        style={[
          styles.base,
          height,
          size === 'sm' && styles.small,
          (variant === 'secondary' || muted) && styles.secondary,
          muted && styles.muted,
          variant === 'danger' && styles.danger,
          (variant === 'ghost' || variant === 'dangerGhost') && styles.ghost,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        fullWidth ? styles.full : styles.inline,
        filled && !isDisabled && variant === 'primary' && size !== 'sm' && shadow.glow,
        styles.round,
        { transform: [{ scale: press.scale }] },
        isDisabled && !muted && styles.disabled,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={isDisabled ? undefined : press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={({ pressed }) => pressed && !filled && styles.pressed}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  full: {
    alignSelf: 'stretch',
  },
  inline: {
    alignSelf: 'flex-start',
  },
  round: {
    borderRadius: radius.pill,
  },
  base: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    paddingHorizontal: spacing.lg,
  },
  filled: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...t.label,
  },
  secondary: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  muted: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.glass,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
  },
  ghost: {
    backgroundColor: colors.transparent,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.38,
  },
});
