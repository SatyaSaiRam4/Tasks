import { useWindowDimensions } from 'react-native';
import { breakpoints, CONTENT_MAX_WIDTH, GUTTER, WIDE_CONTENT_MAX_WIDTH } from '../theme';

/**
 * Responsive layout facts for the current window. Phones get the single
 * column; tablets and desktops get wider gutters, a capped reading width
 * and multi-column grids where a screen supports them.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= breakpoints.tablet;
  const isDesktop = width >= breakpoints.desktop;
  const gutter = isDesktop ? 40 : isTablet ? 32 : GUTTER;
  return {
    width,
    height,
    isPhone: !isTablet,
    isTablet,
    isDesktop,
    gutter,
    /** Width for reading-focused screens (forms, settings, details). */
    contentWidth: Math.min(width - gutter * 2, CONTENT_MAX_WIDTH),
    /** Width for dashboard-style screens that use columns. */
    wideWidth: Math.min(width - gutter * 2, WIDE_CONTENT_MAX_WIDTH),
    /** Grid columns for card lists. */
    columns: isDesktop ? 3 : isTablet ? 2 : 1,
  };
}
