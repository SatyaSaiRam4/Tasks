import React, { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { gradients } from '../theme';

interface GradientProps {
  colors: [string, string] | readonly [string, string];
  /** 'diagonal' (top-left → bottom-right), 'vertical', 'horizontal'. */
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

/**
 * A view with an SVG linear-gradient background (no extra native gradient lib
 * needed). The SVG is drawn at the view's measured size: a "100%" SVG can keep
 * the size of its first layout pass on Android, leaving a view that later
 * grows only partly filled. It is drawn a pixel larger than the view (the
 * view's rounded, clipped frame trims the extra): measured sizes are often
 * fractional, and Android rounds the drawing down, which otherwise leaves a
 * thin unfilled strip along the right and bottom edges.
 */
export function Gradient({ colors, direction = 'diagonal', opacity = [1, 1], style, children, borderRadius = 0 }: GradientProps) {
  const id = useId().replace(/:/g, '');
  const d = DIRECTIONS[direction];
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, style]} onLayout={onLayout}>
      {size.width > 0 && size.height > 0 ? (
        <Svg
          key={`${size.width}x${size.height}`}
          width={Math.ceil(size.width) + 1}
          height={Math.ceil(size.height) + 1}
          style={styles.fill}
        >
          <Defs>
            <LinearGradient id={`g${id}`} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}>
              <Stop offset="0" stopColor={colors[0]} stopOpacity={opacity[0]} />
              <Stop offset="1" stopColor={colors[1]} stopOpacity={opacity[1]} />
            </LinearGradient>
          </Defs>
          <Rect width={Math.ceil(size.width) + 1} height={Math.ceil(size.height) + 1} fill={`url(#g${id})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

/** A soft radial glow, used behind hero elements (streak flame, avatars, emblems). */
export function Glow({ color, size, style, intensity = 0.55 }: { color: string; size: number; style?: StyleProp<ViewStyle>; intensity?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`r${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={intensity} />
            <Stop offset="0.5" stopColor={color} stopOpacity={intensity * 0.32} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#r${id})`} />
      </Svg>
    </View>
  );
}

/** A hairline that fades in from both ends: the light catching a raised edge. */
export function Sheen({ color, inset = '16%', style }: { color?: [string, string]; inset?: `${number}%`; style?: StyleProp<ViewStyle> }) {
  const pair = color ?? gradients.sheen;
  return (
    <View pointerEvents="none" style={[styles.sheen, { left: inset, right: inset }, style]}>
      <Gradient colors={pair} direction="horizontal" style={styles.flex} />
      <Gradient colors={[pair[1], pair[0]]} direction="horizontal" style={styles.flex} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  flex: {
    flex: 1,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    height: 1,
    flexDirection: 'row',
  },
});
