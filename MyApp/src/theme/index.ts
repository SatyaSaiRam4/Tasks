/**
 * Rememberly's design language: "Shonen Energy" — bold saturated color,
 * thick ink outlines on every panel (manga-panel linework), and hard,
 * offset drop-shadows instead of soft blur. Every screen and shared
 * component pulls from these tokens so the look stays one consistent
 * system from the login screen through to the deepest detail screen.
 */

export const colors = {
  // Manga "paper" background + white panel surfaces.
  background: '#F3EEDF',
  surface: '#FFFFFF',
  surfaceAlt: '#FBF6EA',

  // Ink — used for borders, hard shadows, and primary text everywhere.
  ink: '#14141F',

  // Brand action red, the app's primary color.
  primary: '#FF3B30',
  primaryDark: '#C81E1E',
  primarySoft: '#FFD9D5',

  // Secondary energy accents.
  accentOrange: '#FF9500',
  accentOrangeSoft: '#FFE3BD',
  accentBlue: '#00AEEF',
  accentBlueSoft: '#CFF3FF',
  accentYellow: '#FFD60A',
  accentYellowSoft: '#FFF3BF',

  text: '#14141F',
  textMuted: '#5B5768',
  textFaint: '#9C96A8',

  border: '#14141F',
  divider: 'rgba(20, 20, 31, 0.14)',

  success: '#1FAA59',
  successSoft: '#CFF3DC',
  danger: '#D6281F',
  dangerSoft: '#FFD9D5',
  warning: '#FF9500',
  warningSoft: '#FFE3BD',
  info: '#00AEEF',
  infoSoft: '#CFF3FF',
  pin: '#FFD60A',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(20, 20, 31, 0.6)',
} as const;

export const priorityColors: Record<'LOW' | 'NORMAL' | 'HIGH', string> = {
  LOW: colors.accentBlue,
  NORMAL: colors.accentOrange,
  HIGH: colors.primary,
};

export const priorityLabels: Record<'LOW' | 'NORMAL' | 'HIGH', string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  display: 32,
} as const;

/** Ink border widths used on every panel/input/button in the system. */
export const border = {
  thin: 1.5,
  thick: 2.5,
} as const;

/**
 * Manga-panel "hard" shadow: a crisp, un-blurred offset block rather than a
 * soft blur. iOS renders this natively via shadowRadius: 0; on Android,
 * elevation alone can't avoid blur, so components that want the true
 * comic-panel look pair this with a second, offset ink-colored layer
 * (see `Panel` / `AppButton`) rather than relying on shadow props alone.
 */
export const shadow = {
  card: {
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  fab: {
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  hardSm: {
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
} as const;

/** Bold, tight-tracking display type used for headers and CTAs. */
export const typography = {
  eyebrow: {
    fontSize: fontSize.xs,
    fontWeight: '800' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  display: {
    fontSize: fontSize.display,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
    color: colors.ink,
  },
  h1: {
    fontSize: fontSize.xxl,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
    color: colors.ink,
  },
  h2: {
    fontSize: fontSize.xl,
    fontWeight: '800' as const,
    color: colors.ink,
  },
  button: {
    fontSize: fontSize.md,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const;
