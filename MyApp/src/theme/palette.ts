/**
 * Memo's raw color palette — "Midnight & Champagne".
 *
 * Obsidian and deep navy surfaces, champagne gold as the brand metal, soft
 * ivory for type, with moonlight blue and a subtle violet used only for
 * ambient light. Screens never use these directly: they read the semantic
 * tokens in `colors` (see ./index.ts), which are filled from one of the two
 * theme palettes below.
 */

export type ThemeMode = 'light' | 'dark';

/** Brand constants that never change with the theme. */
export const brand = {
  obsidian: '#05070D',
  midnight: '#070A13',
  navy: '#0B1122',
  panel: '#0E1526',
  panelHigh: '#141D33',
  champagne: '#D4AF6A',
  champagneLight: '#F3DCA6',
  champagneDeep: '#B48B45',
  bronze: '#8C6420',
  ivory: '#EFE9DC',
  pearl: '#F6F1E7',
  mist: '#A3ABBB',
  azure: '#8FB4E8',
  violet: '#9C8CE0',
  ink: '#0B0F1A',
  /** Tones that read on the midnight hero surfaces in both themes. */
  jade: '#9FDCBF',
  ember: '#F0C27F',
  emberDeep: '#E8A65E',
} as const;

/**
 * Interactive accents (Settings → Accent). Every accent is a soft, jewel-like
 * tone that carries dark ink, so buttons read the same in both themes.
 * `primary` is the value saved to the account; `bright`/`deep` complete the ramp.
 */
export const ACCENTS = {
  amber: { label: 'Champagne', primary: '#D4AF6A', bright: '#F0D79C', deep: '#8C6420' },
  violet: { label: 'Amethyst', primary: '#A796E6', bright: '#CEC3F6', deep: '#5E4BB0' },
  ocean: { label: 'Moonlight', primary: '#86A9DE', bright: '#BCD4F5', deep: '#3E66A3' },
  emerald: { label: 'Jade', primary: '#79C2A1', bright: '#B4E3CD', deep: '#2F7D5E' },
  rose: { label: 'Rosé', primary: '#D9909F', bright: '#F3C4CF', deep: '#9C4D61' },
} as const;

export type AccentName = keyof typeof ACCENTS;
export const DEFAULT_ACCENT: AccentName = 'amber';
export const DEFAULT_THEME: ThemeMode = 'dark';

export interface Palette {
  background: string;
  backgroundRaised: string;
  surface: string;
  surfaceAlt: string;
  surfaceHigh: string;
  overlay: string;
  border: string;
  borderStrong: string;
  divider: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  gold: string;
  goldBright: string;
  goldDeep: string;
  goldSoft: string;
  goldLine: string;
  glass: string;
  glassStrong: string;
  success: string;
  successSoft: string;
  streak: string;
  streakGold: string;
  streakSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  azure: string;
  violet: string;
  isDark: boolean;
}

/** Semantic surfaces and text for each theme. */
export const PALETTES: Record<ThemeMode, Palette> = {
  dark: {
    background: '#05070D',
    backgroundRaised: '#0A0F1D',
    surface: '#0E1526',
    surfaceAlt: '#131C31',
    surfaceHigh: '#1C2640',
    overlay: 'rgba(2, 4, 9, 0.78)',
    border: 'rgba(239, 233, 220, 0.08)',
    borderStrong: 'rgba(239, 233, 220, 0.14)',
    divider: 'rgba(239, 233, 220, 0.07)',
    text: '#F3EEE3',
    textSecondary: '#A3ABBB',
    textTertiary: '#6F7990',
    textInverse: '#05070D',
    gold: '#D4AF6A',
    goldBright: '#F3DCA6',
    goldDeep: '#B48B45',
    goldSoft: 'rgba(212, 175, 106, 0.12)',
    goldLine: 'rgba(212, 175, 106, 0.30)',
    glass: 'rgba(255, 255, 255, 0.035)',
    glassStrong: 'rgba(255, 255, 255, 0.07)',
    success: '#7CCBA6',
    successSoft: 'rgba(124, 203, 166, 0.13)',
    streak: '#E8A65E',
    streakGold: '#F0D79C',
    streakSoft: 'rgba(232, 166, 94, 0.14)',
    warning: '#E6C27A',
    warningSoft: 'rgba(230, 194, 122, 0.14)',
    danger: '#E58388',
    dangerSoft: 'rgba(229, 131, 136, 0.13)',
    info: '#8FB4E8',
    infoSoft: 'rgba(143, 180, 232, 0.13)',
    azure: '#8FB4E8',
    violet: '#9C8CE0',
    isDark: true,
  },
  light: {
    background: '#F6F1E7',
    backgroundRaised: '#FBF7EF',
    surface: '#FFFDF8',
    surfaceAlt: '#F1EADC',
    surfaceHigh: '#E6DCC8',
    overlay: 'rgba(11, 17, 34, 0.46)',
    border: 'rgba(11, 17, 34, 0.08)',
    borderStrong: 'rgba(11, 17, 34, 0.13)',
    divider: 'rgba(11, 17, 34, 0.07)',
    text: '#0B1122',
    textSecondary: '#4F5769',
    textTertiary: '#7D8393',
    textInverse: '#F6F1E7',
    gold: '#B48B45',
    goldBright: '#8C6420',
    goldDeep: '#7A561B',
    goldSoft: 'rgba(180, 139, 69, 0.12)',
    goldLine: 'rgba(140, 100, 32, 0.30)',
    glass: 'rgba(255, 255, 255, 0.55)',
    glassStrong: 'rgba(255, 255, 255, 0.82)',
    success: '#2F8A63',
    successSoft: 'rgba(47, 138, 99, 0.11)',
    streak: '#B8692A',
    streakGold: '#A47A2E',
    streakSoft: 'rgba(184, 105, 42, 0.11)',
    warning: '#9A6B16',
    warningSoft: 'rgba(154, 107, 22, 0.11)',
    danger: '#B8434B',
    dangerSoft: 'rgba(184, 67, 75, 0.09)',
    info: '#3E66A3',
    infoSoft: 'rgba(62, 102, 163, 0.10)',
    azure: '#5C84C4',
    violet: '#6E5CC4',
    isDark: false,
  },
};

/** Per-category colors (cards, monograms, gauges). Soft jewel tones. */
export const TRACK_COLORS = ['#D4AF6A', '#8FB4E8', '#7CCBA6', '#E8A65E', '#D9909F', '#A796E6', '#7FC4D8', '#E39A82'];

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
