/**
 * Rememberly design tokens — a premium, dark-first system.
 *
 * Deep near-black surfaces, one accent color (configurable), green for
 * completion, orange/gold for streaks, red only for destructive actions.
 * Screens use semantic tokens from here, never raw hex values.
 *
 * The accent is applied once at startup (see applyAccent / index.js), before
 * any StyleSheet is created, so every screen picks it up consistently.
 */

export const ACCENTS = {
  violet: { primary: '#8B7CFF', secondary: '#5B8CFF' },
  ocean: { primary: '#4DA3FF', secondary: '#3DD6D0' },
  emerald: { primary: '#2ED3A0', secondary: '#4DA3FF' },
  rose: { primary: '#FF6B9A', secondary: '#B57CFF' },
  amber: { primary: '#FFB347', secondary: '#FF7A59' },
} as const;

export type AccentName = keyof typeof ACCENTS;
export const DEFAULT_ACCENT: AccentName = 'violet';

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const colors = {
  // Surfaces, from the deepest layer up.
  background: '#07080B',
  backgroundRaised: '#0D0F14',
  surface: '#12151C',
  surfaceAlt: '#191D26',
  surfaceHigh: '#222733',
  overlay: 'rgba(3, 4, 7, 0.72)',

  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  divider: 'rgba(255, 255, 255, 0.06)',

  text: '#F4F5F8',
  textSecondary: '#A3A8B8',
  textTertiary: '#6A7083',
  textInverse: '#07080B',

  // Accent (mutated by applyAccent at startup).
  primary: ACCENTS.violet.primary as string,
  primarySecondary: ACCENTS.violet.secondary as string,
  primarySoft: withAlpha(ACCENTS.violet.primary, 0.16),
  primaryGlow: withAlpha(ACCENTS.violet.primary, 0.35),

  success: '#3DDC97',
  successSoft: 'rgba(61, 220, 151, 0.14)',
  streak: '#FF9F43',
  streakGold: '#FFC857',
  streakSoft: 'rgba(255, 159, 67, 0.14)',
  warning: '#FFC857',
  warningSoft: 'rgba(255, 200, 87, 0.14)',
  danger: '#FF5C7A',
  dangerSoft: 'rgba(255, 92, 122, 0.14)',
  info: '#5BC0FF',
  infoSoft: 'rgba(91, 192, 255, 0.14)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const gradients = {
  primary: [colors.primary, colors.primarySecondary] as [string, string],
  streak: ['#FFC857', '#FF7A45'] as [string, string],
  success: ['#3DDC97', '#2BB4C9'] as [string, string],
  surface: ['#171B24', '#0F1218'] as [string, string],
  vault: ['#1B1630', '#0B0B12'] as [string, string],
  danger: ['#FF5C7A', '#FF8A5C'] as [string, string],
};

/** Applies a named accent before any styles are created. */
export function applyAccent(name: string | null | undefined): AccentName {
  const key = (name && name in ACCENTS ? name : DEFAULT_ACCENT) as AccentName;
  const accent = ACCENTS[key];
  colors.primary = accent.primary;
  colors.primarySecondary = accent.secondary;
  colors.primarySoft = withAlpha(accent.primary, 0.16);
  colors.primaryGlow = withAlpha(accent.primary, 0.35);
  gradients.primary = [accent.primary, accent.secondary];
  return key;
}

/** Per-Track colors users can pick from. */
export const TRACK_COLORS = ['#8B7CFF', '#4DA3FF', '#2ED3A0', '#FFB347', '#FF6B9A', '#5BC0FF', '#C084FC', '#F97066'];

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/** Horizontal page gutter used by every screen. */
export const GUTTER = 20;

/** Height of the floating tab bar, excluding the bottom safe-area padding. */
export const TAB_BAR_HEIGHT = 64;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

export const fontSize = {
  micro: 11,
  caption: 13,
  body: 15,
  subtitle: 17,
  heading: 20,
  title: 26,
  display: 34,
  hero: 48,
} as const;

export const type = {
  hero: { fontSize: fontSize.hero, fontWeight: '800' as const, letterSpacing: -1.2, color: colors.text },
  display: { fontSize: fontSize.display, fontWeight: '800' as const, letterSpacing: -0.8, color: colors.text },
  title: { fontSize: fontSize.title, fontWeight: '700' as const, letterSpacing: -0.4, color: colors.text },
  heading: { fontSize: fontSize.heading, fontWeight: '700' as const, letterSpacing: -0.2, color: colors.text },
  subtitle: { fontSize: fontSize.subtitle, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: fontSize.body, fontWeight: '400' as const, lineHeight: 22, color: colors.text },
  bodyStrong: { fontSize: fontSize.body, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: fontSize.caption, fontWeight: '500' as const, color: colors.textSecondary },
  micro: {
    fontSize: fontSize.micro,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: colors.textTertiary,
  },
};

export const shadow = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  float: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  },
};

export const motion = {
  fast: 150,
  normal: 260,
  slow: 420,
  stagger: 60,
};

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

/** Minimum comfortable touch target. */
export const TOUCH_TARGET = 44;
