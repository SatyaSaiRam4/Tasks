import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

interface GradientProps {
  colors: [string, string] | readonly [string, string];
  /** Angle-ish direction: 'diagonal' (top-left → bottom-right), 'vertical', 'horizontal'. */
  direction?: 'diagonal' | 'vertical' | 'horizontal';
  opacity?: [number, number];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  borderRadius?: number;
}

const DIRECTIONS = {
  diagonal: { x1: '0', y1: '0', x2: '1', y2: '1' },
  vertical: { x1: '0', y1: '0', x2: '0', y2: '1' },
  horizontal: { x1: '0', y1: '0', x2: '1', y2: '0' },
};

/** A view with an SVG linear-gradient background (no extra native gradient lib needed). */
export function Gradient({ colors, direction = 'diagonal', opacity = [1, 1], style, children, borderRadius = 0 }: GradientProps) {
  const id = useId().replace(/:/g, '');
  const d = DIRECTIONS[direction];
  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`g${id}`} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}>
            <Stop offset="0" stopColor={colors[0]} stopOpacity={opacity[0]} />
            <Stop offset="1" stopColor={colors[1]} stopOpacity={opacity[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#g${id})`} />
      </Svg>
      {children}
    </View>
  );
}

/** A soft radial glow, used behind hero elements (Satya, streak flame). */
export function Glow({ color, size, style, intensity = 0.55 }: { color: string; size: number; style?: StyleProp<ViewStyle>; intensity?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`r${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={intensity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#r${id})`} />
      </Svg>
    </View>
  );
}
