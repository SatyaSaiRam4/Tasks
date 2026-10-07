/**
 * Memo design tokens — "Moonlight", a luxury dark system.
 *
 * Obsidian and midnight-navy surfaces, ivory type, one champagne-gold brand
 * color, with moonlight blue and a soft violet for atmosphere. Headlines and
 * numbers use the platform serif, everything else the platform sans.
 * Screens use semantic tokens from here, never raw hex values.
 *
 * `primary` is the interactive accent and is user-configurable (Settings →
 * Accent). It is applied once at startup (see applyAccent / index.js), before
 * any StyleSheet is created, so every screen picks it up consistently. The
 * gold brand color (`colors.gold`) never changes.
 */

import { Platform } from 'react-native';

export const ACCENTS = {
  amber: { primary: '#D9BC82', secondary: '#B89058' },
  violet: { primary: '#B1A3EC', secondary: '#8790DC' },
  ocean: { primary: '#A3BEEB', secondary: '#7C9BD6' },
  emerald: { primary: '#93D2B6', secondary: '#6FAFC0' },
  rose: { primary: '#E5AFBE', secondary: '#B9A0DC' },
} as const;

export type AccentName = keyof typeof ACCENTS;
export const DEFAULT_ACCENT: AccentName = 'amber';

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Type families: the platform's own serif and sans faces, no bundled font files. */
export const fonts = {
  display: Platform.select({ ios: 'Georgia', default: 'serif' }),
  sans: Platform.select({ ios: 'System', default: 'sans-serif' }),
};

export const colors = {
  // Surfaces, from the deepest layer up: obsidian → midnight navy.
  background: '#05060B',
  backgroundRaised: '#0A0D18',
  surface: '#0F1424',
  surfaceAlt: '#151B2F',
  surfaceHigh: '#1F2741',
  glass: 'rgba(17, 22, 40, 0.72)',
  glassStrong: 'rgba(14, 18, 34, 0.92)',
  overlay: 'rgba(2, 3, 8, 0.78)',

  // Warm hairlines: borders carry a hint of champagne.
  border: 'rgba(232, 214, 178, 0.08)',
  borderStrong: 'rgba(232, 214, 178, 0.16)',
  divider: 'rgba(232, 214, 178, 0.07)',

  text: '#F5F0E6',
  textSecondary: '#B4B1AB',
  textTertiary: '#77798A',
  textInverse: '#0A0B10',

  // Brand: champagne gold (constant).
  gold: '#D9BC82',
  goldBright: '#F1DDAF',
  goldDeep: '#A8844C',
  goldSoft: 'rgba(217, 188, 130, 0.12)',
  goldLine: 'rgba(217, 188, 130, 0.38)',
  moon: '#A9C0EC',
  moonSoft: 'rgba(169, 192, 236, 0.12)',
  violet: '#9C8BDA',

  // Accent (mutated by applyAccent at startup).
  primary: ACCENTS.amber.primary as string,
  primarySecondary: ACCENTS.amber.secondary as string,
  primarySoft: withAlpha(ACCENTS.amber.primary, 0.14),
  primaryGlow: withAlpha(ACCENTS.amber.primary, 0.32),
  onPrimary: '#0A0B10',

  success: '#8CD3B3',
  successSoft: 'rgba(140, 211, 179, 0.13)',
  streak: '#E8AD66',
  streakGold: '#F1D08E',
  streakSoft: 'rgba(232, 173, 102, 0.13)',
  warning: '#EACB82',
  warningSoft: 'rgba(234, 203, 130, 0.13)',
  danger: '#EC8796',
  dangerSoft: 'rgba(236, 135, 150, 0.13)',
  info: '#A3BEEB',
  infoSoft: 'rgba(163, 190, 235, 0.13)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const gradients = {
  primary: [colors.primary, colors.primarySecondary] as [string, string],
  gold: ['#F1DDAF', '#B89058'] as [string, string],
  streak: ['#F1D08E', '#D98A4E'] as [string, string],
  success: ['#A6E0C5', '#6FB7A8'] as [string, string],
  surface: ['#161C31', '#0B0F1C'] as [string, string],
  night: ['#121935', '#070912'] as [string, string],
  moonlight: ['#1B2546', '#0A0D1A'] as [string, string],
  vault: ['#1E1838', '#0A0A14'] as [string, string],
  danger: ['#EC8796', '#D9907A'] as [string, string],
};

/** Applies a named accent before any styles are created. */
export function applyAccent(name: string | null | undefined): AccentName {
  const key = (name && name in ACCENTS ? name : DEFAULT_ACCENT) as AccentName;
  const accent = ACCENTS[key];
  colors.primary = accent.primary;
  colors.primarySecondary = accent.secondary;
  colors.primarySoft = withAlpha(accent.primary, 0.14);
  colors.primaryGlow = withAlpha(accent.primary, 0.32);
  gradients.primary = [accent.primary, accent.secondary];
  return key;
}

/** Per-Track colors users can pick from. */
export const TRACK_COLORS = ['#D9BC82', '#A3BEEB', '#93D2B6', '#E8AD66', '#E5AFBE', '#B1A3EC', '#8FC6E0', '#E6957F'];

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  huge: 56,
} as const;

/** Horizontal page gutter used by every screen (phones). */
export const GUTTER = 20;

/** Height of the floating tab bar, excluding the bottom safe-area padding. */
export const TAB_BAR_HEIGHT = 68;

/** Layout breakpoints (dp) and the readable content width on large screens. */
export const breakpoints = {
  tablet: 700,
  desktop: 1024,
} as const;
export const CONTENT_MAX_WIDTH = 760;
export const WIDE_CONTENT_MAX_WIDTH = 1080;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 34,
  pill: 999,
} as const;

export const fontSize = {
  micro: 10.5,
  caption: 13,
  body: 15,
  subtitle: 16,
  heading: 20,
  title: 26,
  display: 32,
  hero: 52,
} as const;

/** Some serif faces default to old-style figures; numbers must read as numbers. */
const LINING: ('lining-nums')[] = ['lining-nums'];

const serif = (size: number, weight: '500' | '600' | '700' = '600') => ({
  fontFamily: fonts.display,
  fontVariant: LINING,
  fontSize: size,
  fontWeight: weight,
  color: colors.text,
});
const sans = (size: number, weight: '400' | '500' | '600' | '700' | '800' = '400') => ({
  fontFamily: fonts.sans,
  fontSize: size,
  fontWeight: weight,
  color: colors.text,
});

/** Font family + weight for one-off styles, so nothing falls back to the system face. */
export const font = {
  regular: { fontFamily: fonts.sans, fontWeight: '400' as const },
  medium: { fontFamily: fonts.sans, fontWeight: '500' as const },
  semibold: { fontFamily: fonts.sans, fontWeight: '600' as const },
  bold: { fontFamily: fonts.sans, fontWeight: '700' as const },
  heavy: { fontFamily: fonts.sans, fontWeight: '800' as const },
  serif: { fontFamily: fonts.display, fontWeight: '600' as const, fontVariant: LINING },
  serifBold: { fontFamily: fonts.display, fontWeight: '700' as const, fontVariant: LINING },
  serifItalic: { fontFamily: fonts.display, fontWeight: '500' as const, fontStyle: 'italic' as const, fontVariant: LINING },
};

export const type = {
  hero: { ...serif(fontSize.hero, '600'), letterSpacing: -1, lineHeight: fontSize.hero * 1.02 },
  display: { ...serif(fontSize.display, '600'), letterSpacing: -0.4, lineHeight: fontSize.display * 1.08 },
  title: { ...serif(fontSize.title, '600'), letterSpacing: -0.2, lineHeight: fontSize.title * 1.12 },
  heading: { ...serif(fontSize.heading, '600'), lineHeight: fontSize.heading * 1.18 },
  subtitle: { ...sans(fontSize.subtitle, '600'), letterSpacing: 0.1 },
  body: { ...sans(fontSize.body, '400'), lineHeight: 23 },
  bodyStrong: { ...sans(fontSize.body, '600') },
  caption: { ...sans(fontSize.caption, '500'), color: colors.textSecondary, lineHeight: 19 },
  /** Editorial eyebrow: small, spaced, champagne. */
  micro: {
    ...sans(fontSize.micro, '700'),
    letterSpacing: 2.2,
    textTransform: 'uppercase' as const,
    color: withAlpha(colors.gold, 0.78),
  },
  /** A serif italic aside, e.g. greetings and quiet notes. */
  aside: { ...font.serifItalic, fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  /** Big serif numerals (streaks, counts). */
  numeral: { ...serif(36, '600'), letterSpacing: -0.5 },
};

export const shadow = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 8,
  },
  float: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 34,
    elevation: 16,
  },
  glow: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 10,
  },
};

export const motion = {
  fast: 160,
  normal: 280,
  slow: 520,
  stagger: 70,
  ambient: 5200,
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
