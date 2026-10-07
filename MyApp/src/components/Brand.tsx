import React, { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { colors, font } from '../theme';

/** Memo's mark: a champagne crescent moon with a small four-point star. */
export function MoonMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id={`mg${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.goldBright} />
          <Stop offset="1" stopColor={colors.goldDeep} />
        </LinearGradient>
        <Mask id={`mm${id}`}>
          <Rect width="32" height="32" fill="#fff" />
          <Circle cx="19.5" cy="12" r="10" fill="#000" />
        </Mask>
      </Defs>
      <Circle cx="14" cy="17" r="12" fill={`url(#mg${id})`} mask={`url(#mm${id})`} />
      <Path d="M25 3.5 L26 6.5 L29 7.5 L26 8.5 L25 11.5 L24 8.5 L21 7.5 L24 6.5 Z" fill={colors.goldBright} />
    </Svg>
  );
}

/** Mark + "Memo" wordmark, used in the top bar and on the signed-out screens. */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Memo">
      <MoonMark size={lg ? 40 : 28} />
      <Text style={[styles.word, lg && styles.wordLg]}>Memo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  word: {
    ...font.serif,
    fontSize: 21,
    letterSpacing: 0.6,
    color: colors.text,
  },
  wordLg: {
    fontSize: 30,
  },
});
