/**
 * Memo design system — "Midnight & Champagne".
 *
 * One source of truth for color, type, shape, depth and motion. Screens read
 * semantic tokens from here and never use raw hex values.
 *
 * The theme (dark by default, or the ivory light theme) and the accent are
 * chosen in Settings and applied once at startup by `applyTheme` and
 * `applyAccent` (see index.js), before any screen creates its StyleSheet.
 * Both functions update the exported objects in place, so every token below
 * (colors, gradients, type, shadow) is already final when screens load.
 */
import type { TextStyle } from 'react-native';
import { ACCENTS, brand, DEFAULT_ACCENT, DEFAULT_THEME, PALETTES, withAlpha, type AccentName, type ThemeMode } from './palette';
import { font, sansFace, serifFace } from './typography';

export * from './palette';
export * from './typography';
export * from './tokens';

type Pair = [string, string];

export const colors = {
  ...PALETTES[DEFAULT_THEME],

  // Interactive accent (set by applyAccent).
  primary: ACCENTS[DEFAULT_ACCENT].primary as string,
  primarySecondary: ACCENTS[DEFAULT_ACCENT].deep as string,
  primarySoft: withAlpha(ACCENTS[DEFAULT_ACCENT].primary, 0.14),
  primaryGlow: withAlpha(ACCENTS[DEFAULT_ACCENT].primary, 0.32),
  /** Solid accent fill that always carries dark ink (chips, small round buttons). */
  primaryFill: ACCENTS[DEFAULT_ACCENT].primary as string,
  onPrimary: brand.ink as string,

  // The cinematic "hero" surfaces stay midnight in both themes.
  heroText: brand.ivory as string,
  heroTextSecondary: 'rgba(239, 233, 220, 0.66)',
  heroTextTertiary: 'rgba(239, 233, 220, 0.42)',
  heroLine: 'rgba(212, 175, 106, 0.28)',
  heroGlass: 'rgba(255, 255, 255, 0.05)',
  heroGoldSoft: 'rgba(212, 175, 106, 0.1)',
  heroGoldLine: 'rgba(212, 175, 106, 0.3)',
  /** Full-screen scrims behind celebrations and the guided tour. */
  scrim: 'rgba(2, 4, 9, 0.9)',
  scrimSoft: 'rgba(2, 4, 9, 0.72)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const gradients = {
  primary: [ACCENTS[DEFAULT_ACCENT].bright, ACCENTS[DEFAULT_ACCENT].primary] as Pair,
  gold: [brand.champagneLight, brand.champagneDeep] as Pair,
  /** The midnight hero panel used for feature cards, sheets and the tab bar. */
  hero: [brand.panelHigh, brand.midnight] as Pair,
  surface: ['#121A2E', '#0B1122'] as Pair,
  streak: ['#F0C27F', '#C9772F'] as Pair,
  success: ['#9FDCBF', '#5BA886'] as Pair,
  danger: ['#F0A2A6', '#C9606A'] as Pair,
  /** Backdrop wash, top → bottom. */
  backdrop: [brand.navy, brand.obsidian] as Pair,
  /** Faint gold sheen across the top edge of raised surfaces. */
  sheen: ['rgba(243, 220, 166, 0)', 'rgba(243, 220, 166, 0.38)'] as Pair,
  /** The brighter sheen used on midnight hero surfaces (same in both themes). */
  heroSheen: ['rgba(243, 220, 166, 0)', 'rgba(243, 220, 166, 0.55)'] as Pair,
  /** Light on satin: the highlight along filled buttons. */
  satinSheen: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.75)'] as Pair,
};

const serifStyle = (size: number, lineHeight: number, weight: '500' | '600' | '700' = '600'): TextStyle => ({
  ...serifFace(weight),
  fontSize: size,
  lineHeight,
  color: colors.text,
});

function buildType() {
  return {
    hero: { ...serifStyle(64, 66), letterSpacing: -1 },
    display: { ...serifStyle(40, 44), letterSpacing: -0.4 },
    title: { ...serifStyle(30, 34), letterSpacing: -0.2 },
    heading: serifStyle(23, 27),
    subtitle: { ...sansFace('600'), fontSize: 16, lineHeight: 22, color: colors.text },
    body: { ...sansFace('400'), fontSize: 15, lineHeight: 23, color: colors.text },
    bodyStrong: { ...sansFace('600'), fontSize: 15, lineHeight: 21, color: colors.text },
    caption: { ...sansFace('500'), fontSize: 13, lineHeight: 18, color: colors.textSecondary },
    /** Spaced small caps used for eyebrows and labels. */
    micro: {
      ...sansFace('700'),
      fontSize: 10.5,
      lineHeight: 14,
      letterSpacing: 2.2,
      textTransform: 'uppercase' as const,
      color: colors.gold,
    },
    /** A serif italic aside, e.g. greetings and quiet notes. */
    aside: { ...serifFace('500', true), fontSize: 18, lineHeight: 24, color: colors.textSecondary },
    /** Big serif numerals (streaks, counts). */
    numeral: { ...serifStyle(44, 48), letterSpacing: -0.5 },
    /** Button and tab labels. */
    label: { ...sansFace('700'), fontSize: 14.5, letterSpacing: 0.6, color: colors.text },
  };
}

export const type = buildType();

export const shadow = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 4,
  },
  float: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 12,
  },
  /** A warm halo under primary calls to action. */
  glow: {
    shadowColor: ACCENTS[DEFAULT_ACCENT].primary as string,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
};

/** Selects the theme palette before screens are loaded. */
export function applyTheme(mode: string | null | undefined): ThemeMode {
  const key: ThemeMode = mode === 'light' || mode === 'dark' ? mode : DEFAULT_THEME;
  Object.assign(colors, PALETTES[key]);
  const dark = key === 'dark';
  gradients.surface = dark ? ['#111A2E', '#0B1122'] : ['#FFFDF8', '#F7F1E5'];
  gradients.backdrop = dark ? [brand.navy, brand.obsidian] : ['#FBF7EF', '#F1E9DA'];
  gradients.streak = dark ? ['#F0C27F', '#C9772F'] : ['#E2A35A', '#B8692A'];
  gradients.success = dark ? ['#9FDCBF', '#5BA886'] : ['#5DB38B', '#2F8A63'];
  gradients.danger = dark ? ['#F0A2A6', '#C9606A'] : ['#D86A72', '#B8434B'];
  gradients.sheen = dark ? ['rgba(243, 220, 166, 0)', 'rgba(243, 220, 166, 0.38)'] : ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.95)'];
  Object.assign(shadow.card, {
    shadowColor: dark ? colors.black : '#3B2A10',
    shadowOpacity: dark ? 0.32 : 0.08,
    shadowRadius: dark ? 22 : 18,
    elevation: dark ? 4 : 2,
  });
  Object.assign(shadow.float, {
    shadowColor: dark ? colors.black : '#1A1408',
    shadowOpacity: dark ? 0.45 : 0.16,
    shadowRadius: dark ? 30 : 26,
    elevation: dark ? 12 : 8,
  });
  Object.assign(type, buildType());
  return key;
}

/** Applies a named accent before any styles are created. */
export function applyAccent(name: string | null | undefined): AccentName {
  const key = (name && name in ACCENTS ? name : DEFAULT_ACCENT) as AccentName;
  const accent = ACCENTS[key];
  // Light theme: interactive text uses the deep tone so it reads on ivory.
  colors.primary = colors.isDark ? accent.primary : accent.deep;
  colors.primarySecondary = colors.isDark ? accent.deep : accent.primary;
  colors.primarySoft = withAlpha(accent.primary, colors.isDark ? 0.14 : 0.16);
  colors.primaryGlow = withAlpha(accent.primary, 0.32);
  colors.primaryFill = accent.primary;
  colors.onPrimary = brand.ink;
  gradients.primary = [accent.bright, accent.primary];
  shadow.glow.shadowColor = accent.primary;
  return key;
}

export { font };
