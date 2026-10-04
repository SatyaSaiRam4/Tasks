import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Icon } from './Icon';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** PIN dots + numeric keypad. Shakes when `errorKey` changes. */
export function PinPad({
  value,
  onChange,
  length,
  errorKey,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  length: number;
  errorKey?: number;
  disabled?: boolean;
}) {
  const { reduced } = useMotion();
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!errorKey || reduced) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map(x => Animated.timing(shake, { toValue: x, duration: 50, useNativeDriver: true })),
    ).start();
  }, [errorKey, reduced, shake]);

  const press = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (key === 'del') onChange(value.slice(0, -1));
    else if (key && value.length < length) onChange(value + key);
  };

  return (
    <View>
      <Animated.View
        style={[styles.dots, { transform: [{ translateX: shake }] }]}
        accessibilityLabel={`${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </Animated.View>
      <View style={styles.pad}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete' : key}
              style={({ pressed }) => [styles.key, styles.keySurface, pressed && styles.keyPressed]}
            >
              {key === 'del' ? (
                <Icon name="chevron-left" size={22} color={colors.textSecondary} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    maxWidth: 300,
    alignSelf: 'center',
  },
  key: {
    width: 80,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keySurface: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  keyPressed: {
    backgroundColor: colors.surfaceHigh,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.text,
  },
});
