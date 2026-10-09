/**
 * Motion primitives shared by every component. All of them respect
 * reduced motion (system setting or the user's own preference).
 */
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useMotion } from '../hooks/useMotion';
import { motion } from '../theme';

/** The luxury ease: quick start, long soft landing. */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** A gentler in-out curve for ambient loops. */
export const easeInOut = Easing.inOut(Easing.sin);

/** Press feedback: a gentle scale-down while a finger is on the element. */
export function usePressScale(to = 0.97) {
  const { reduced } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    if (reduced) return;
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: value === 1 ? 6 : 0 }).start();
  };
  return {
    scale,
    onPressIn: () => animate(to),
    onPressOut: () => animate(1),
  };
}

/**
 * A 0 → 1 → 0 ambient loop (breathing glows, drifting light, shimmer).
 * Stays at `rest` under reduced motion.
 */
export function useLoop(duration: number = motion.ambient, { rest = 0.5, pingPong = true }: { rest?: number; pingPong?: boolean } = {}) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(reduced ? rest : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(rest);
      return;
    }
    const loop = pingPong
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(value, { toValue: 1, duration: duration / 2, easing: easeInOut, useNativeDriver: true }),
            Animated.timing(value, { toValue: 0, duration: duration / 2, easing: easeInOut, useNativeDriver: true }),
          ]),
        )
      : Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [duration, pingPong, reduced, rest, value]);
  return value;
}

/** Animates 0 → 1 once on mount (after `delay`), for entrances. */
export function useEntrance(delay = 0, duration: number = motion.slow) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    Animated.timing(value, { toValue: 1, duration, delay, easing: easeOut, useNativeDriver: true }).start();
  }, [delay, duration, reduced, value]);
  return value;
}

/** Like useEntrance, but replays every time the screen comes back into focus. */
export function useFocusEntrance(duration = 420) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useFocusEffect(
    useCallback(() => {
      if (reduced) {
        value.setValue(1);
        return;
      }
      value.setValue(0);
      Animated.timing(value, { toValue: 1, duration, easing: easeOut, useNativeDriver: true }).start();
    }, [duration, reduced, value]),
  );
  return value;
}

/** Fade + rise style for an entrance value from useEntrance (a negative distance drops in from above). */
export function riseStyle(value: Animated.Value, distance = 14) {
  return {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}
