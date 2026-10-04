import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { border, colors, fontSize, radius, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const FILL: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  danger: colors.surface,
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.ink,
  danger: colors.danger,
};

/**
 * The one button used everywhere: a thick ink outline and a solid offset
 * shadow block, in one of three flavors. `primary` is every main call to
 * action (Sign in, Save, Create…), `secondary` is a neutral outlined action
 * (Cancel, Archive, Sign out), `danger` is destructive (Delete).
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const shadowOffset = size === 'sm' ? 3 : 4;

  return (
    <View style={style}>
      <View
        style={[
          styles.shadowBlock,
          { top: shadowOffset, left: shadowOffset, borderRadius: radius.md, backgroundColor: colors.ink },
          isDisabled && styles.shadowDisabled,
        ]}
      />
      <TouchableOpacity
        style={[
          styles.button,
          size === 'sm' ? styles.buttonSm : styles.buttonMd,
          { backgroundColor: FILL[variant], borderColor: colors.ink },
          isDisabled && styles.buttonDisabled,
        ]}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {loading ? (
          <ActivityIndicator size="small" color={TEXT_COLOR[variant]} />
        ) : (
          <Text
            style={[
              styles.label,
              { color: TEXT_COLOR[variant] },
              size === 'sm' && styles.labelSm,
              isDisabled && styles.labelDisabled,
            ]}
          >
            {label}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowBlock: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  shadowDisabled: {
    opacity: 0.35,
  },
  button: {
    zIndex: 1,
    borderRadius: radius.md,
    borderWidth: border.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMd: {
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  buttonSm: {
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.button,
    fontSize: fontSize.md,
  },
  labelSm: {
    fontSize: fontSize.sm,
  },
  labelDisabled: {
    opacity: 0.8,
  },
});
