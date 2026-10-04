import React, { useRef } from 'react';
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
import { colors, fontSize, gradients, radius, spacing, TOUCH_TARGET } from '../theme';
import { useMotion } from '../hooks/useMotion';
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

const HEIGHT: Record<Size, number> = { lg: 56, md: 48, sm: 38 };
const LABEL: Record<Size, number> = { lg: fontSize.subtitle, md: fontSize.body, sm: fontSize.caption };

/**
 * The one button used everywhere. `primary` is a gradient call to action,
 * `secondary` a quiet surface button, `ghost` text-only, `danger` for
 * destructive actions only, `success` for completion confirmations.
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
  const { reduced } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const press = (to: number) => {
    if (reduced || isDisabled) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 5 }).start();
  };

  const textColor =
    variant === 'primary' || variant === 'success'
      ? colors.white
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
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={textColor} /> : null}
          <Text style={[styles.label, { color: textColor, fontSize: LABEL[size] }]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} color={textColor} /> : null}
        </>
      )}
    </View>
  );

  const height = { height: HEIGHT[size], minHeight: Math.max(HEIGHT[size], size === 'sm' ? 0 : TOUCH_TARGET) };
  let body: React.ReactNode;
  if (variant === 'primary' || variant === 'success') {
    body = (
      <Gradient
        colors={variant === 'success' ? gradients.success : gradients.primary}
        direction="horizontal"
        borderRadius={radius.md}
        style={[styles.base, height]}
      >
        {content}
      </Gradient>
    );
  } else {
    body = (
      <View
        style={[
          styles.base,
          height,
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
        { transform: [{ scale }] },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
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
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
  },
  ghost: {
    backgroundColor: colors.transparent,
  },
  disabled: {
    opacity: 0.45,
  },
});
