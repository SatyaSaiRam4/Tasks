import React from 'react';
import { Image } from 'react-native';
import { colors } from '../theme';

/**
 * Memo's logo: the friendly "M" character holding a ticked note, beside the
 * serif "Memo". Each comes in a dark-theme cut (gold lettering) and a
 * light-theme cut (navy lettering), with transparent backgrounds so they sit
 * on either theme. Sources: assets/memo-logo-{dark,light}-v2.png and
 * assets/memo-app-icon-{dark,light}.png.
 */
const LOGO = {
  dark: { source: require('../../assets/images/memo-logo-dark.png'), ratio: 1432 / 544 },
  light: { source: require('../../assets/images/memo-logo-light.png'), ratio: 1431 / 542 },
};
const MARK = {
  dark: { source: require('../../assets/images/memo-mark-dark.png'), ratio: 734 / 606 },
  light: { source: require('../../assets/images/memo-mark-light.png'), ratio: 732 / 605 },
};

/** The dark-theme cut on dark grounds: the dark theme, or a midnight panel (`onDark`). */
function cut(onDark?: boolean) {
  return onDark || colors.isDark ? 'dark' : 'light';
}

/** The "M" character on its own, `size` tall. */
export function BrandMark({ size = 32, onDark }: { size?: number; onDark?: boolean }) {
  const { source, ratio } = MARK[cut(onDark)];
  return <Image source={source} style={{ height: size, width: size * ratio }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

/**
 * The full logo (character and "Memo"). `sm` for the top bar, `md` for the
 * desktop rail and Settings, `lg` for the splash and signed-out screens.
 * `light` marks a midnight panel (the rail, the sign-in panel), which takes
 * the dark-theme cut whatever the theme.
 */
export function Wordmark({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const { source, ratio } = LOGO[cut(light)];
  const height = size === 'lg' ? 92 : size === 'sm' ? 34 : 40;
  return (
    <Image
      source={source}
      style={{ height, width: height * ratio }}
      resizeMode="contain"
      accessibilityRole="header"
      accessibilityLabel="Memo"
      accessibilityIgnoresInvertColors
    />
  );
}
