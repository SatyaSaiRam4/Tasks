import React, { useId } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, gradients } from '../theme';
import { useLoop } from '../animations';

/**
 * The cinematic ambience behind every screen: a midnight (or ivory) wash,
 * three pools of soft light — moonlight blue, violet and champagne — that
 * drift very slowly, and one faint diagonal beam, like light through a
 * window at night. Purely decorative and never touchable; still under
 * reduced motion.
 */
export function Backdrop({ tint }: { tint?: string }) {
  const { width, height } = useWindowDimensions();
  const drift = useLoop(14000);
  const breathe = useLoop(9000);
  const id = useId().replace(/:/g, '');

  const dark = colors.isDark;
  const beamColor = dark ? colors.goldBright : '#FFFFFF';
  const big = Math.max(width, 560) * 1.2;
  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [10, -10] });
  const glow = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`wash${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.backdrop[0]} />
            <Stop offset="0.55" stopColor={gradients.backdrop[1]} />
            <Stop offset="1" stopColor={gradients.backdrop[1]} />
          </LinearGradient>
          {/* The beam is feathered across its width and fades out downward. */}
          <LinearGradient id={`beam${id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={beamColor} stopOpacity={0} />
            <Stop offset="0.5" stopColor={beamColor} stopOpacity={dark ? 0.06 : 0.16} />
            <Stop offset="1" stopColor={beamColor} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={`fade${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <Mask id={`mask${id}`}>
            <Rect width={width} height={height * 0.7} fill={`url(#fade${id})`} />
          </Mask>
        </Defs>
        <Rect width={width} height={height} fill={`url(#wash${id})`} />
        <Polygon
          points={`${width * 0.58},0 ${width * 0.92},0 ${width * 0.46},${height * 0.7} ${width * 0.04},${height * 0.7}`}
          fill={`url(#beam${id})`}
          mask={`url(#mask${id})`}
        />
      </Svg>

      <Animated.View
        style={[
          styles.abs,
          { width: big, height: big, left: -big * 0.45, top: -big * 0.55, opacity: glow, transform: [{ translateX: driftX }, { translateY: driftY }] },
        ]}
      >
        <Pool id={`a${id}`} color={tint ?? colors.azure} intensity={dark ? 0.2 : 0.14} />
      </Animated.View>
      <Animated.View
        style={[styles.abs, { width: big * 0.85, height: big * 0.85, right: -big * 0.42, top: -big * 0.3, transform: [{ translateX: Animated.multiply(driftX, -1) }] }]}
      >
        <Pool id={`b${id}`} color={colors.violet} intensity={dark ? 0.15 : 0.08} />
      </Animated.View>
      <Animated.View style={[styles.abs, { width: big, height: big * 0.7, left: (width - big) / 2, bottom: -big * 0.42, opacity: glow }]}>
        <Pool id={`c${id}`} color={colors.gold} intensity={dark ? 0.08 : 0.12} />
      </Animated.View>
    </View>
  );
}

function Pool({ id, color, intensity }: { id: string; color: string; intensity: number }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={intensity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={intensity * 0.32} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
  },
});
