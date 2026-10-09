/** Spacing, shape, motion and layout tokens shared by every screen. */

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

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const;

/** Durations (ms). The luxury ease lives in src/animations. */
export const motion = {
  fast: 160,
  normal: 280,
  slow: 560,
  stagger: 60,
  ambient: 6400,
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

/** Horizontal page gutter used by every screen (phones). */
export const GUTTER = 20;

/** Height of the floating tab bar, excluding the bottom safe-area padding. */
export const TAB_BAR_HEIGHT = 68;

/** Width of the navigation rail that replaces the tab bar on desktop. */
export const RAIL_WIDTH = 248;

/** Layout breakpoints (dp) and the readable content widths on large screens. */
export const breakpoints = {
  tablet: 700,
  desktop: 1024,
} as const;
export const CONTENT_MAX_WIDTH = 720;
export const WIDE_CONTENT_MAX_WIDTH = 1120;
