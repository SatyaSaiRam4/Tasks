import React, { useId } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { brand, colors, shadow } from '../theme';

// The Memo mark (a gold M with a sparkle) and the stacked logo, as
// transparent PNGs: bright gold for dark grounds, deeper gold and navy type
// for light ones (sources and the generator are in /branding).
const LOGO = require('../../assets/images/memo-logo.png');
const LOGO_LIGHT = require('../../assets/images/memo-logo-light.png');
const MARK = require('../../assets/images/memo-mark.png');
const MARK_LIGHT = require('../../assets/images/memo-mark-light.png');
const LOGO_RATIO = 661 / 827;
const MARK_RATIO = 639 / 579;

/**
 * Memo's "M" mark (without the word), `size` tall: bright gold on dark
 * grounds, deep gold on light ones. `bright` forces the bright one (for the
 * midnight hero cards); `tile` puts it on a midnight tile, like the app icon.
 */
export function BrandMark({ size = 32, tile, bright }: { size?: number; tile?: boolean; bright?: boolean }) {
  const image = (
    <Image source={colors.isDark || tile || bright ? MARK : MARK_LIGHT} style={{ height: size, width: size * MARK_RATIO }} resizeMode="contain" accessibilityIgnoresInvertColors />
  );
  if (!tile) return image;
  const pad = Math.round(size * 0.22);
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
    return (
      <Image
        source={light || colors.isDark ? LOGO : LOGO_LIGHT}
        style={styles.logo}
        resizeMode="contain"
        accessibilityRole="header"
        accessibilityLabel="Memo"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Memo">
      <BrandMark size={size === 'sm' ? 26 : 32} bright={light} />
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
  logo: {
    height: 150,
    width: 150 * LOGO_RATIO,
  },
});
