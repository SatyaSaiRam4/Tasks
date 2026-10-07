import React, { useMemo } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { useLoop } from '../animations';

/** Deterministic pseudo-random numbers, so the sky is the same on every render. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

function makeStars(count: number, width: number, height: number, seed: number): Star[] {
  const rand = rng(seed);
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    // Denser near the top, fading out toward the middle of the screen.
    y: Math.pow(rand(), 1.7) * height * 0.62,
    r: 0.45 + rand() * 1.05,
    o: 0.18 + rand() * 0.55,
  }));
}

/**
 * The cinematic night sky behind every screen: a midnight wash, moonlit
 * glows that breathe slowly, and a field of faint stars (some twinkle).
 * Purely decorative and never touchable. Still under reduced motion.
 */
export function Backdrop({ tint = colors.moon, stars = true }: { tint?: string; stars?: boolean }) {
  const { width, height } = useWindowDimensions();
  const breathe = useLoop(9000);
  const twinkle = useLoop(3800);
  const fieldA = useMemo(() => (stars ? makeStars(46, width, height, 7) : []), [stars, width, height]);
  const fieldB = useMemo(() => (stars ? makeStars(18, width, height, 91) : []), [stars, width, height]);

  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const twinkleOpacity = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const big = Math.max(width, 520) * 1.25;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bdWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0C1226" stopOpacity={1} />
            <Stop offset="0.45" stopColor={colors.background} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#bdWash)" />
      </Svg>

      <Animated.View style={[styles.glowA, { width: big, height: big, left: -big * 0.42, top: -big * 0.55, opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
        <RadialGlow id="bdGlowA" size={big} color={tint} intensity={0.2} />
      </Animated.View>
      <Animated.View style={[styles.glowA, { width: big * 0.8, height: big * 0.8, right: -big * 0.38, top: -big * 0.36, opacity: glowOpacity }]}>
        <RadialGlow id="bdGlowB" size={big * 0.8} color={colors.violet} intensity={0.14} />
      </Animated.View>
      <View style={[styles.glowA, { width: big, height: big * 0.6, left: (width - big) / 2, bottom: -big * 0.36 }]}>
        <RadialGlow id="bdGlowC" size={big} color={colors.gold} intensity={0.05} />
      </View>

      {stars ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {fieldA.map((s, i) => (
              <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.text} opacity={s.o * 0.7} />
            ))}
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkleOpacity }]}>
            <Svg width={width} height={height}>
              {fieldB.map((s, i) => (
                <Circle key={i} cx={s.x} cy={s.y} r={s.r + 0.3} fill={i % 3 === 0 ? colors.goldBright : colors.text} opacity={s.o} />
              ))}
            </Svg>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

function RadialGlow({ id, size, color, intensity }: { id: string; size: number; color: string; intensity: number }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={intensity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={intensity * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glowA: {
    position: 'absolute',
  },
});
