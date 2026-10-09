import React, { useId } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { brand, colors, shadow } from '../theme';

// Transparent PNGs cut from the Memo logo.
const LOGO = require('../../assets/images/memo-logo.png');
const MARK = require('../../assets/images/memo-mark.png');
const LOGO_RATIO = 439 / 352;
const MARK_RATIO = 439 / 276;

/**
 * The neon logo is made for a dark ground. In the light theme (or when
 * `tile` is set) it sits on a small midnight tile, like an app icon, so it
 * keeps its glow instead of washing out on cream.
 */
function onTile(tile?: boolean) {
  return tile ?? !colors.isDark;
}

/** Memo's "M" mark (without the word), `size` tall. */
export function BrandMark({ size = 32, tile }: { size?: number; tile?: boolean }) {
  const image = <Image source={MARK} style={{ height: size, width: size * MARK_RATIO }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  if (!onTile(tile)) return image;
  const pad = Math.round(size * 0.18);
  return <View style={[styles.tile, shadow.card, { padding: pad, borderRadius: size * 0.34 }]}>{image}</View>;
}

/**
 * "Memo" in the brand's own lettering: a serif italic filled with the logo's
 * gold-to-ember gradient (deeper in the light theme, for contrast). Drawn as
 * SVG so the gradient sits in the letters themselves.
 */
export function BrandName({ size = 24, light = false }: { size?: number; light?: boolean }) {
  const id = useId().replace(/:/g, '');
  const bright = light || colors.isDark;
  const from = bright ? '#FFE27A' : '#C27A0E';
  const to = bright ? '#FF8A2A' : '#9A3D0A';
  const width = Math.round(size * 2.55);
  const height = Math.round(size * 1.3);
  return (
    <Svg width={width} height={height} accessibilityLabel="Memo">
      <Defs>
        <LinearGradient id={`bn${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <SvgText
        x={2}
        y={size * 1.02}
        fontSize={size * 1.12}
        fontFamily={Platform.OS === 'ios' ? 'Georgia' : 'CormorantGaramond-SemiBoldItalic'}
        fontStyle="italic"
        fontWeight={Platform.OS === 'ios' ? '700' : 'normal'}
        letterSpacing={0.6}
        fill={`url(#bn${id})`}
      >
        Memo
      </SvgText>
    </Svg>
  );
}

/**
 * The Memo logo. Large: the full logo (mark and word), for the splash and
 * signed-out screens. Small and medium: the mark beside the name, for headers.
 */
export function Wordmark({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  if (size === 'lg') {
    const image = (
      <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityRole="header" accessibilityLabel="Memo" accessibilityIgnoresInvertColors />
    );
    return onTile(light ? false : undefined) ? <View style={[styles.tile, styles.logoTile, shadow.float]}>{image}</View> : image;
  }
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Memo">
      <BrandMark size={size === 'sm' ? 26 : 32} tile={light ? false : undefined} />
      <BrandName size={size === 'sm' ? 25 : 28} light={light} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    backgroundColor: brand.midnight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 106, 0.35)',
  },
  logoTile: {
    padding: 18,
    borderRadius: 32,
  },
  logo: {
    height: 120,
    width: 120 * LOGO_RATIO,
  },
});
