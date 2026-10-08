import React, { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { brand, colors, font } from '../theme';

/**
 * Memo's mark: a jeweller's monogram. A fine champagne ring holds a monoline
 * serif "M", crowned by a small cut diamond.
 */
export function BrandMark({ size = 32, light = false }: { size?: number; light?: boolean }) {
  const id = useId().replace(/:/g, '');
  const top = light || colors.isDark ? brand.champagneLight : brand.champagne;
  const bottom = light || colors.isDark ? brand.champagneDeep : brand.bronze;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id={`bm${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Circle cx="20" cy="20" r="18.6" stroke={`url(#bm${id})`} strokeWidth="1.3" fill="none" />
      <Circle cx="20" cy="20" r="15.6" stroke={`url(#bm${id})`} strokeWidth="0.5" strokeOpacity="0.55" fill="none" />
      <Path
        d="M12.6 27.4 V14.6 L20 23.2 L27.4 14.6 V27.4"
        stroke={`url(#bm${id})`}
        strokeWidth="2"
        strokeLinejoin="miter"
        strokeLinecap="butt"
        fill="none"
      />
      <Path d="M10.6 27.4 H14.6 M25.4 27.4 H29.4" stroke={`url(#bm${id})`} strokeWidth="1.2" />
      <Path d="M20 7.4 L21.5 9.4 L20 11.4 L18.5 9.4 Z" fill={`url(#bm${id})`} />
    </Svg>
  );
}

/** Mark + "MEMO" wordmark, used in the app header and on the signed-out screens. */
export function Wordmark({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const mark = size === 'lg' ? 56 : size === 'sm' ? 26 : 32;
  return (
    <View style={[styles.row, size === 'lg' && styles.column]} accessibilityRole="header" accessibilityLabel="Memo">
      <BrandMark size={mark} light={light} />
      <Text style={[styles.word, size === 'lg' && styles.wordLg, size === 'sm' && styles.wordSm, light && styles.wordLight]}>MEMO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  column: {
    flexDirection: 'column',
    gap: 14,
  },
  word: {
    ...font.serif,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: 5,
    color: colors.text,
  },
  wordSm: {
    fontSize: 17,
    letterSpacing: 4,
  },
  wordLg: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 10,
    marginRight: -10,
  },
  wordLight: {
    color: colors.heroText,
  },
});
