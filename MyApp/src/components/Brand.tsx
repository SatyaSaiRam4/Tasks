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
 * The character's eyes are always alive: it looks ahead, blinks, glances
 * left and right. Each image has copies with the eyes closed ("-blink") and
 * looking left / right ("-left", "-right"), the same size and position; the
 * right one is shown at each moment.
 */
/** The four looks of each image: ahead, eyes closed, looking left, looking right. */
type Eyes = 'ahead' | 'closed' | 'left' | 'right';
type Look = Record<Eyes, number> & { ratio: number };

const LOGO: Record<'dark' | 'light', Look> = {
  dark: {
    ahead: require('../../assets/images/memo-logo-dark.png'),
    closed: require('../../assets/images/memo-logo-dark-blink.png'),
    left: require('../../assets/images/memo-logo-dark-left.png'),
    right: require('../../assets/images/memo-logo-dark-right.png'),
    ratio: 1432 / 544,
  },
  light: {
    ahead: require('../../assets/images/memo-logo-light.png'),
    closed: require('../../assets/images/memo-logo-light-blink.png'),
    left: require('../../assets/images/memo-logo-light-left.png'),
    right: require('../../assets/images/memo-logo-light-right.png'),
    ratio: 1431 / 542,
  },
};
const MARK: Record<'dark' | 'light', Look> = {
  dark: {
    ahead: require('../../assets/images/memo-mark-dark.png'),
    closed: require('../../assets/images/memo-mark-dark-blink.png'),
    left: require('../../assets/images/memo-mark-dark-left.png'),
    right: require('../../assets/images/memo-mark-dark-right.png'),
    ratio: 734 / 606,
  },
  light: {
    ahead: require('../../assets/images/memo-mark-light.png'),
    closed: require('../../assets/images/memo-mark-light-blink.png'),
    left: require('../../assets/images/memo-mark-light-left.png'),
    right: require('../../assets/images/memo-mark-light-right.png'),
    ratio: 732 / 605,
  },
};

/**
 * The eyes' little routine, on a loop (milliseconds per look): ahead, blink,
 * glance left, back, glance right, back, a quick double blink. Something
 * moves about every second; a blink comes about every 2 seconds.
 */
const ROUTINE: [Eyes, number][] = [
  ['ahead', 700],
  ['closed', 110],
  ['ahead', 500],
  ['left', 650],
  ['ahead', 250],
  ['right', 650],
  ['ahead', 450],
  ['closed', 110],
  ['ahead', 140],
  ['closed', 110],
  ['ahead', 600],
];

/** Where the eyes are right now. Still (ahead) when the phone asks for less motion. */
function useEyes(): Eyes {
  const { system: still } = useMotion();
  const [eyes, setEyes] = useState<Eyes>('ahead');
  useEffect(() => {
    if (still) return;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      const [look, ms] = ROUTINE[step];
      setEyes(look);
      step = (step + 1) % ROUTINE.length;
      timer = setTimeout(next, ms);
    };
    // Each logo starts at its own moment, so two on screen don't move in lockstep.
    timer = setTimeout(next, Math.random() * 800);
    return () => {
      clearTimeout(timer);
      setEyes('ahead');
    };
  }, [still]);
  return eyes;
}

const LOOKS: Eyes[] = ['ahead', 'closed', 'left', 'right'];

/** All four looks laid exactly on top of each other; only the current one shows. */
function Living({ look, width, height }: { look: Look; width: number; height: number }) {
  const eyes = useEyes();
  return (
    <View style={{ width, height }}>
      {LOOKS.map(kind => (
        // Always mounted (loaded once, no flicker); only the opacity changes.
        <Image
          key={kind}
          source={look[kind]}
          style={[StyleSheet.absoluteFill, { width, height }, kind === eyes ? styles.shown : styles.hidden]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ))}
    </View>
  );
}

/** The dark-theme cut on dark grounds: the dark theme, or a midnight panel (`onDark`). */
function cut(onDark?: boolean) {
  return onDark || colors.isDark ? 'dark' : 'light';
}

/** The "M" character on its own, `size` tall. */
export function BrandMark({ size = 32, onDark }: { size?: number; onDark?: boolean }) {
  const look = MARK[cut(onDark)];
  return <Living look={look} width={size * look.ratio} height={size} />;
}

/**
 * The full logo (character and "Memo"). `sm` for the top bar, `md` for the
 * desktop rail and Settings, `lg` for the splash and signed-out screens.
 * `light` marks a midnight panel (the rail, the sign-in panel), which takes
 * the dark-theme cut whatever the theme.
 */
export function Wordmark({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const look = LOGO[cut(light)];
  const height = size === 'lg' ? 92 : size === 'sm' ? 34 : 40;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Memo">
      <Living look={look} width={height * look.ratio} height={height} />
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
