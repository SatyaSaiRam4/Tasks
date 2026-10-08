import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
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
    marginBottom: spacing.xl,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.goldLine,
    transform: [{ rotate: '45deg' }],
  },
  dotFilled: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.xl,
    rowGap: spacing.sm + 2,
    maxWidth: 300,
    alignSelf: 'center',
  },
  key: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keySurface: {
    borderRadius: 33,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  keyPressed: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldLine,
  },
  keyText: {
    ...font.serif,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
  },
});
