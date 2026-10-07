import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { gradients, radius } from '../theme';
import { easeOut } from '../animations';
import { useMotion } from '../hooks/useMotion';
import { Gradient } from './Gradient';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular progress (0..1): a fine champagne track and a gradient arc that sweeps to its value. */
export function ProgressRing({
  progress,
  size = 120,
  stroke = 10,
  colorsPair = gradients.primary,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  colorsPair?: readonly [string, string];
  children?: React.ReactNode;
}) {
  const { reduced } = useMotion();
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useRef(new Animated.Value(reduced ? progress : 0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: reduced ? 0 : 1400,
      easing: easeOut,
      useNativeDriver: false,
    }).start();
  }, [progress, reduced, value]);

  const dashOffset = value.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  // A round cap on a zero-length arc still paints a dot; hide it at 0%.
  const arcOpacity = value.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1] });

  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={`ring${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colorsPair[0]} />
            <Stop offset="1" stopColor={colorsPair[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(217,188,130,0.12)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r + stroke / 2 + 3} stroke="rgba(217,188,130,0.10)" strokeWidth={StyleSheet.hairlineWidth * 2} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#ring${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeOpacity={arcOpacity}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

/** Linear progress (0..1). */
export function ProgressBar({
  progress,
  height = 8,
  colorsPair = gradients.primary,
  style,
}: {
  progress: number;
  height?: number;
  colorsPair?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
}) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(reduced ? progress : 0)).current;
  useEffect(() => {
    Animated.timing(value, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: reduced ? 0 : 1100,
      easing: easeOut,
      useNativeDriver: false,
    }).start();
  }, [progress, reduced, value]);

  const width = value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      style={[styles.barTrack, { height, borderRadius: height / 2 }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Animated.View style={{ width, height }}>
        <Gradient colors={colorsPair} direction="horizontal" borderRadius={height / 2} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

/** A number that counts up to its value. */
export function AnimatedNumber({ value, style, suffix = '' }: { value: number; style?: StyleProp<TextStyle>; suffix?: string }) {
  const { reduced } = useMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const anim = useRef(new Animated.Value(0)).current;
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    anim.setValue(0);
    const start = from.current;
    const id = anim.addListener(({ value: t }) => setDisplay(Math.round(start + (value - start) * t)));
    Animated.timing(anim, { toValue: 1, duration: 1200, easing: easeOut, useNativeDriver: false }).start(() => {
      from.current = value;
    });
    return () => anim.removeListener(id);
  }, [value, reduced, anim]);

  return (
    <Text style={style} accessibilityLabel={`${value}${suffix}`}>
      {display}
      {suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    backgroundColor: 'rgba(217,188,130,0.10)',
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
});
