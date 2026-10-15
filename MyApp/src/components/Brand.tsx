import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { useMotion } from '../hooks/useMotion';

/**
 * Memo's logo: the friendly "M" character holding a ticked note, beside the
 * serif "Memo". Each comes in a dark-theme cut (gold lettering) and a
 * light-theme cut (navy lettering), with transparent backgrounds so they sit
 * on either theme. Sources: assets/memo-logo-{dark,light}-v2.png and
 * assets/memo-app-icon-{dark,light}.png.
 *
 * The character blinks now and then: a "-blink" copy of each image has its
 * eyes closed (same size and position), shown for a moment every few seconds.
 */
const LOGO = {
  dark: { source: require('../../assets/images/memo-logo-dark.png'), blink: require('../../assets/images/memo-logo-dark-blink.png'), ratio: 1432 / 544 },
  light: { source: require('../../assets/images/memo-logo-light.png'), blink: require('../../assets/images/memo-logo-light-blink.png'), ratio: 1431 / 542 },
};
const MARK = {
  dark: { source: require('../../assets/images/memo-mark-dark.png'), blink: require('../../assets/images/memo-mark-dark-blink.png'), ratio: 734 / 606 },
  light: { source: require('../../assets/images/memo-mark-light.png'), blink: require('../../assets/images/memo-mark-light-blink.png'), ratio: 732 / 605 },
};

const BLINK_MS = 140;

/**
 * True for a moment every 2.5–5.5 s (sometimes a quick double blink), like
 * Melo. Off when the phone asks for less motion.
 */
function useBlink(): boolean {
  const { system: still } = useMotion();
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (still) return;
    let timer: ReturnType<typeof setTimeout>;
    const blink = (times: number) => {
      setClosed(true);
      timer = setTimeout(() => {
        setClosed(false);
        timer = times > 1 ? setTimeout(() => blink(times - 1), 160) : setTimeout(() => blink(Math.random() < 0.2 ? 2 : 1), 2500 + Math.random() * 3000);
      }, BLINK_MS);
    };
    timer = setTimeout(() => blink(1), 1200 + Math.random() * 2500);
    return () => {
      clearTimeout(timer);
      setClosed(false);
    };
  }, [still]);
  return closed;
}

/** The image, with its eyes-closed copy laid exactly on top while blinking. */
function Blinking({ source, blink, width, height }: { source: number; blink: number; width: number; height: number }) {
  const closed = useBlink();
  return (
    <View style={{ width, height }}>
      <Image source={source} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
      {/* Always mounted (loaded once, no flicker); only its opacity changes. */}
      <Image
        source={blink}
        style={[StyleSheet.absoluteFill, { width, height }, closed ? styles.shown : styles.hidden]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** The dark-theme cut on dark grounds: the dark theme, or a midnight panel (`onDark`). */
function cut(onDark?: boolean) {
  return onDark || colors.isDark ? 'dark' : 'light';
}

/** The "M" character on its own, `size` tall. */
export function BrandMark({ size = 32, onDark }: { size?: number; onDark?: boolean }) {
  const { source, blink, ratio } = MARK[cut(onDark)];
  return <Blinking source={source} blink={blink} width={size * ratio} height={size} />;
}

/**
 * The full logo (character and "Memo"). `sm` for the top bar, `md` for the
 * desktop rail and Settings, `lg` for the splash and signed-out screens.
 * `light` marks a midnight panel (the rail, the sign-in panel), which takes
 * the dark-theme cut whatever the theme.
 */
export function Wordmark({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const { source, blink, ratio } = LOGO[cut(light)];
  const height = size === 'lg' ? 92 : size === 'sm' ? 34 : 40;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Memo">
      <Blinking source={source} blink={blink} width={height * ratio} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  shown: {
    opacity: 1,
  },
  hidden: {
    opacity: 0,
  },
});
