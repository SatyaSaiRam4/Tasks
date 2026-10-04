import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors } from '../theme';

/**
 * Line icons drawn with react-native-svg (shapes adapted from Lucide, ISC
 * license). 24×24 grid, round caps/joins, stroke scales with size.
 */
const ICONS = {
  home: (
    <>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  target: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="5" />
      <Circle cx="12" cy="12" r="1.2" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  lock: (
    <>
      <Rect x="4" y="11" width="16" height="10" rx="2.5" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  unlock: (
    <>
      <Rect x="4" y="11" width="16" height="10" rx="2.5" />
      <Path d="M8 11V7a4 4 0 0 1 7.8-1.2" />
    </>
  ),
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <Path d="M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Line x1="21" y1="21" x2="16.2" y2="16.2" />
    </>
  ),
  plus: (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  check: <Polyline points="20 6 9 17 4 12" />,
  'check-circle': (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="8 12.5 11 15.5 16.5 9.5" />
    </>
  ),
  x: (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  'chevron-right': <Polyline points="9 18 15 12 9 6" />,
  'chevron-left': <Polyline points="15 18 9 12 15 6" />,
  'chevron-down': <Polyline points="6 9 12 15 18 9" />,
  'arrow-right': (
    <>
      <Line x1="5" y1="12" x2="19" y2="12" />
      <Polyline points="12 5 19 12 12 19" />
    </>
  ),
  flame: (
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  trophy: (
    <>
      <Path d="M8 21h8M12 17v4" />
      <Path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <Path d="M17 5h2.5a1.5 1.5 0 0 1 1.5 1.5c0 2-1.5 3.5-4 3.5M7 5H4.5A1.5 1.5 0 0 0 3 6.5C3 8.5 4.5 10 7 10" />
    </>
  ),
  calendar: (
    <>
      <Rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <Line x1="16" y1="2.5" x2="16" y2="6.5" />
      <Line x1="8" y1="2.5" x2="8" y2="6.5" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  edit: (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </>
  ),
  trash: (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6M14 11v6" />
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  archive: (
    <>
      <Rect x="2.5" y="3.5" width="19" height="5" rx="1.5" />
      <Path d="M4.5 8.5v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-10" />
      <Line x1="10" y1="12.5" x2="14" y2="12.5" />
    </>
  ),
  star: (
    <Polyline points="12 2.5 15 8.6 21.7 9.6 16.8 14.3 18 21 12 17.8 6 21 7.2 14.3 2.3 9.6 9 8.6 12 2.5" />
  ),
  pin: (
    <>
      <Line x1="12" y1="17" x2="12" y2="22" />
      <Path d="M5 17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2z" />
    </>
  ),
  eye: (
    <>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6A18.4 18.4 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.4-1.6" />
      <Line x1="2" y1="2" x2="22" y2="22" />
    </>
  ),
  filter: <Polyline points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />,
  sparkles: (
    <>
      <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <Path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15z" />
    </>
  ),
  flag: (
    <>
      <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <Line x1="4" y1="22" x2="4" y2="15" />
    </>
  ),
  award: (
    <>
      <Circle cx="12" cy="8.5" r="6" />
      <Polyline points="8.2 13.3 7 22 12 19 17 22 15.8 13.3" />
    </>
  ),
  crown: <Path d="M3 18h18M4 18l-1-11 5.5 4L12 4l3.5 7L21 7l-1 11" />,
  sunrise: (
    <>
      <Path d="M17 18a5 5 0 0 0-10 0" />
      <Line x1="12" y1="2" x2="12" y2="9" />
      <Line x1="4.2" y1="10.2" x2="5.6" y2="11.6" />
      <Line x1="1" y1="18" x2="3" y2="18" />
      <Line x1="21" y1="18" x2="23" y2="18" />
      <Line x1="18.4" y1="11.6" x2="19.8" y2="10.2" />
      <Line x1="23" y1="22" x2="1" y2="22" />
      <Polyline points="8 6 12 2 16 6" />
    </>
  ),
  refresh: (
    <>
      <Polyline points="23 4 23 10 17 10" />
      <Polyline points="1 20 1 14 7 14" />
      <Path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
    </>
  ),
  repeat: (
    <>
      <Polyline points="17 1 21 5 17 9" />
      <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <Polyline points="7 23 3 19 7 15" />
      <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  shield: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  key: (
    <>
      <Circle cx="7.5" cy="15.5" r="4.5" />
      <Path d="M10.7 12.3 21 2M17 6l3 3M15 8l2 2" />
    </>
  ),
  folder: <Path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  tag: (
    <>
      <Path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <Circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  more: (
    <>
      <Circle cx="5" cy="12" r="1.2" />
      <Circle cx="12" cy="12" r="1.2" />
      <Circle cx="19" cy="12" r="1.2" />
    </>
  ),
  logout: (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  compass: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5" />
    </>
  ),
  alert: (
    <>
      <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  message: <Path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.5 8.5 0 1 1 21 11.5z" />,
  zap: <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  sun: (
    <>
      <Circle cx="12" cy="12" r="4.5" />
      <Path d="M12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  moon: <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sliders: (
    <>
      <Line x1="4" y1="21" x2="4" y2="14" />
      <Line x1="4" y1="10" x2="4" y2="3" />
      <Line x1="12" y1="21" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12" y2="3" />
      <Line x1="20" y1="21" x2="20" y2="16" />
      <Line x1="20" y1="12" x2="20" y2="3" />
      <Line x1="1" y1="14" x2="7" y2="14" />
      <Line x1="9" y1="8" x2="15" y2="8" />
      <Line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  palette: (
    <>
      <Path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.3H17a5 5 0 0 0 5-5C22 6 17.5 2 12 2z" />
      <Circle cx="7.5" cy="10.5" r="1.2" />
      <Circle cx="10.5" cy="6.5" r="1.2" />
      <Circle cx="15.5" cy="7" r="1.2" />
    </>
  ),
  play: <Polyline points="6 3 20 12 6 21 6 3" />,
  copy: (
    <>
      <Rect x="9" y="9" width="12" height="12" rx="2" />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  wifiOff: (
    <>
      <Line x1="2" y1="2" x2="22" y2="22" />
      <Path d="M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.8M16.9 10.3A10 10 0 0 1 19 12.9" />
      <Line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  'snooze': (
    <>
      <Circle cx="12" cy="13" r="8" />
      <Path d="M5 3 2 6M22 6l-3-3" />
      <Path d="M9.5 10.5h5l-5 5h5" />
    </>
  ),
  'list': (
    <>
      <Line x1="8" y1="6" x2="21" y2="6" />
      <Line x1="8" y1="12" x2="21" y2="12" />
      <Line x1="8" y1="18" x2="21" y2="18" />
      <Line x1="3" y1="6" x2="3.01" y2="6" />
      <Line x1="3" y1="12" x2="3.01" y2="12" />
      <Line x1="3" y1="18" x2="3.01" y2="18" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 2, fill = 'none' }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </Svg>
  );
}
