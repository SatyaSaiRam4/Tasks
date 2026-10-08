import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, gradients, hitSlop } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Gradient } from './Gradient';
import { Icon } from './Icon';

/** The completion circle used on tasks and reminders. Pops with a soft ring when checked. */
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
  const ring = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    Animated.timing(fill, { toValue: checked ? 1 : 0, duration: reduced ? 0 : 240, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (checked && !first.current && !reduced) {
      ring.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
        ]),
        Animated.timing(ring, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
    first.current = false;
  }, [checked, fill, scale, ring, reduced]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] });

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
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2, borderColor: colors.success, opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
        <View
          style={[
            styles.box,
            { width: size, height: size, borderRadius: size / 2, borderColor: color ?? colors.goldLine },
            disabled && styles.disabled,
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fill }]}>
            <Gradient colors={gradients.success} borderRadius={size / 2} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={{ opacity: fill }}>
            <Icon name="check" size={size * 0.56} color={colors.onPrimary} strokeWidth={2.6} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.5,
  },
});
