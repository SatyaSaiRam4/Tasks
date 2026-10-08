import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { breakpoints, CONTENT_MAX_WIDTH, GUTTER, RAIL_WIDTH, WIDE_CONTENT_MAX_WIDTH } from '../theme';

/** True inside the main tabs while the desktop navigation rail is showing. */
export const RailContext = createContext(false);

/**
 * Responsive layout facts for the current window.
 *
 * - Phone: one column, floating tab bar.
 * - Tablet: wider gutters, two-column grids, a centered floating tab bar.
 * - Desktop: a navigation rail on the left of the main tabs, three-column
 *   grids and capped reading widths, so nothing simply stretches.
 */
export function useLayout() {
  const { width: windowWidth, height } = useWindowDimensions();
  const hasRail = useContext(RailContext);
  const isTablet = windowWidth >= breakpoints.tablet;
  const isDesktop = windowWidth >= breakpoints.desktop;
  // The rail takes a fixed column on the left of the tab screens.
  const width = hasRail ? windowWidth - RAIL_WIDTH : windowWidth;
  const gutter = isDesktop ? 48 : isTablet ? 32 : GUTTER;
  const wideWidth = Math.min(width - gutter * 2, WIDE_CONTENT_MAX_WIDTH);
  return {
    width,
    windowWidth,
    height,
    isPhone: !isTablet,
    isTablet,
    isDesktop,
    hasRail,
    gutter,
    /** Width for reading-focused screens (forms, settings, details). */
    contentWidth: Math.min(width - gutter * 2, CONTENT_MAX_WIDTH),
    /** Width for dashboard-style screens that use columns. */
    wideWidth,
    /** Grid columns for card lists. */
    columns: wideWidth >= 900 ? 3 : isTablet ? 2 : 1,
  };
}
