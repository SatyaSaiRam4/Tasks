import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, gradients, hitSlop } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Gradient } from './Gradient';
import { Icon } from './Icon';

/** The completion circle used on Actions. Pops when it becomes checked. */
export function Checkbox({
  checked,
  onPress,
  disabled,
  size = 28,
  color,
  accessibilityLabel,
}: {
  checked: boolean;
  onPress?: () => void;
  disabled?: boolean;
  size?: number;
  color?: string;
  accessibilityLabel: string;
}) {
  const { reduced } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const first = useRef(true);

  useEffect(() => {
    Animated.timing(fill, { toValue: checked ? 1 : 0, duration: reduced ? 0 : 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (checked && !first.current && !reduced) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      ]).start();
    }
    first.current = false;
  }, [checked, fill, scale, reduced]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      hitSlop={hitSlop}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          style={[
            styles.box,
            { width: size, height: size, borderRadius: size / 2, borderColor: color ?? colors.borderStrong },
            disabled && styles.disabled,
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fill }]}>
            <Gradient colors={gradients.success} borderRadius={size / 2} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={{ opacity: fill }}>
            <Icon name="check" size={size * 0.6} color={colors.white} strokeWidth={3} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
});
