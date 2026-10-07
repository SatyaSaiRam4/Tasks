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
import { colors, font, fontSize, gradients, radius, spacing, TOUCH_TARGET } from '../theme';
import { usePressScale } from '../animations';
import { Gradient } from './Gradient';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
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

const HEIGHT: Record<Size, number> = { lg: 58, md: 50, sm: 38 };
const LABEL: Record<Size, number> = { lg: fontSize.body, md: 14.5, sm: fontSize.caption };

/**
 * The one button used everywhere, pill-shaped. `primary` is a champagne
 * gradient call to action with dark ink, `secondary` a glass button with a
 * hairline edge, `ghost` text-only, `danger` for destructive actions only,
 * `success` for completion confirmations.
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
  const filled = variant === 'primary' || variant === 'success';

  const textColor = filled
    ? colors.onPrimary
    : variant === 'danger'
      ? colors.danger
      : variant === 'ghost'
        ? colors.primary
        : colors.text;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} color={textColor} strokeWidth={2} /> : null}
          <Text style={[styles.label, { color: textColor, fontSize: LABEL[size] }]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 15 : 17} color={textColor} strokeWidth={2} /> : null}
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
        direction="horizontal"
        borderRadius={radius.pill}
        style={[styles.base, styles.filled, height, size === 'sm' && styles.small]}
      >
        {/* A soft highlight along the top edge, like light on satin. */}
        <View style={styles.sheen} pointerEvents="none" />
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
          variant === 'secondary' && styles.secondary,
          variant === 'danger' && styles.danger,
          variant === 'ghost' && styles.ghost,
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
        { transform: [{ scale: press.scale }] },
        isDisabled && styles.disabled,
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
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...font.bold,
    letterSpacing: 0.5,
  },
  secondary: {
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(236,135,150,0.3)',
  },
  ghost: {
    backgroundColor: colors.transparent,
  },
  disabled: {
    opacity: 0.4,
  },
});
