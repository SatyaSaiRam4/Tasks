/**
 * Memo design tokens — a light-first system with a dark alternative.
 *
 * Warm, light-first surfaces with a configurable accent, semantic colors for
 * completion and streaks, and red only for destructive actions. Screens use
 * semantic tokens from here, never raw hex values.
 *
 * The accent is applied once at startup (see applyAccent / index.js), before
 * any StyleSheet is created, so every screen picks it up consistently.
 */

export const ACCENTS = {
  violet: { primary: '#6D5BD0', secondary: '#5274C8' },
  ocean: { primary: '#2678A8', secondary: '#168B83' },
  emerald: { primary: '#168363', secondary: '#2678A8' },
  rose: { primary: '#BD4C72', secondary: '#875AB8' },
  amber: { primary: '#A85D20', secondary: '#C47732' },
} as const;

export type AccentName = keyof typeof ACCENTS;
export type ThemeMode = 'light' | 'dark';
export const DEFAULT_ACCENT: AccentName = 'amber';
export const DEFAULT_THEME: ThemeMode = 'light';

const PALETTES = {
  light: {
    background: '#F5F3EE',
    backgroundRaised: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F0EEE8',
    surfaceHigh: '#E8E5DE',
    overlay: 'rgba(19, 25, 31, 0.48)',
    border: 'rgba(34, 43, 51, 0.09)',
    borderStrong: 'rgba(34, 43, 51, 0.16)',
    divider: 'rgba(34, 43, 51, 0.08)',
    text: '#1D292F',
    textSecondary: '#59666B',
    textTertiary: '#7B8588',
    textInverse: '#FFFFFF',
    success: '#168363',
    successSoft: 'rgba(22, 131, 99, 0.12)',
    streak: '#B86A2D',
    streakGold: '#C18436',
    streakSoft: 'rgba(184, 106, 45, 0.12)',
    warning: '#A66A1D',
    warningSoft: 'rgba(166, 106, 29, 0.12)',
    danger: '#C44747',
    dangerSoft: 'rgba(196, 71, 71, 0.10)',
    info: '#28759A',
    infoSoft: 'rgba(40, 117, 154, 0.11)',
    isDark: false,
  },
  dark: {
    background: '#101416',
    backgroundRaised: '#171D1F',
    surface: '#1B2224',
    surfaceAlt: '#242D2F',
    surfaceHigh: '#303B3D',
    overlay: 'rgba(3, 7, 8, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    divider: 'rgba(255, 255, 255, 0.07)',
    text: '#F3F4EF',
    textSecondary: '#AEB8B7',
    textTertiary: '#7E8A89',
    textInverse: '#101416',
    success: '#48BE91',
    successSoft: 'rgba(72, 190, 145, 0.14)',
    streak: '#E79A53',
    streakGold: '#E8BE72',
    streakSoft: 'rgba(231, 154, 83, 0.14)',
    warning: '#E8BE72',
    warningSoft: 'rgba(232, 190, 114, 0.14)',
    danger: '#E77777',
    dangerSoft: 'rgba(231, 119, 119, 0.14)',
    info: '#71B5D2',
    infoSoft: 'rgba(113, 181, 210, 0.14)',
    isDark: true,
  },
} as const;

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const colors = {
  ...PALETTES.light,

  // Accent (mutated by applyAccent at startup).
  primary: ACCENTS[DEFAULT_ACCENT].primary as string,
  primarySecondary: ACCENTS[DEFAULT_ACCENT].secondary as string,
  primarySoft: withAlpha(ACCENTS[DEFAULT_ACCENT].primary, 0.16),
  primaryGlow: withAlpha(ACCENTS[DEFAULT_ACCENT].primary, 0.35),

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

/** Selects the shared surface and semantic colors before screens are loaded. */
export function applyTheme(mode: string | null | undefined): ThemeMode {
  const key: ThemeMode = mode === 'dark' ? 'dark' : DEFAULT_THEME;
  Object.assign(colors, PALETTES[key]);
  gradients.surface = key === 'light' ? ['#FFFFFF', '#F0EEE8'] : ['#242D2F', '#171D1F'];
  gradients.vault = key === 'light' ? ['#E9E5F1', '#F5F3EE'] : ['#292536', '#101416'];
  gradients.dashboard = key === 'light' ? ['#304840', '#203932'] : ['#293B36', '#182925'];
  gradients.streak = key === 'light' ? ['#C18436', '#A85D20'] : ['#E8BE72', '#D78642'];
  gradients.success = key === 'light' ? ['#168363', '#267D69'] : ['#48BE91', '#2E9B8C'];
  gradients.danger = key === 'light' ? ['#C44747', '#A93E57'] : ['#E77777', '#C85B65'];
  Object.assign(shadow.card, {
    shadowOpacity: key === 'light' ? 0.09 : 0.35,
    shadowRadius: key === 'light' ? 14 : 20,
    elevation: key === 'light' ? 2 : 6,
  });
  Object.assign(shadow.float, {
    shadowOpacity: key === 'light' ? 0.14 : 0.45,
    shadowRadius: key === 'light' ? 20 : 28,
    elevation: key === 'light' ? 5 : 12,
  });
  return key;
}

export const gradients = {
  primary: [colors.primary, colors.primarySecondary] as [string, string],
  streak: ['#C18436', '#A85D20'] as [string, string],
  success: ['#168363', '#267D69'] as [string, string],
  surface: ['#FFFFFF', '#F0EEE8'] as [string, string],
  vault: ['#E9E5F1', '#F5F3EE'] as [string, string],
  dashboard: ['#304840', '#203932'] as [string, string],
  danger: ['#C44747', '#A93E57'] as [string, string],
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
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 24,
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
  hero: { fontFamily: 'serif', fontSize: fontSize.hero, fontWeight: '800' as const, color: colors.text },
  display: { fontFamily: 'serif', fontSize: fontSize.display, fontWeight: '800' as const, color: colors.text },
  title: { fontFamily: 'serif', fontSize: fontSize.title, fontWeight: '700' as const, color: colors.text },
  heading: { fontFamily: 'serif', fontSize: fontSize.heading, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: fontSize.subtitle, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: fontSize.body, fontWeight: '400' as const, lineHeight: 22, color: colors.text },
  bodyStrong: { fontSize: fontSize.body, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: fontSize.caption, fontWeight: '500' as const, color: colors.textSecondary },
  micro: {
    fontSize: fontSize.micro,
    fontWeight: '700' as const,
    letterSpacing: 0,
    textTransform: 'uppercase' as const,
    color: colors.textTertiary,
  },
};

export const shadow = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 2,
  },
  float: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 5,
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
