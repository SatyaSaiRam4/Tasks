import React, { useRef } from 'react';
import { NativeModules, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useAppSelector } from '../app/hooks';

const native = NativeModules.TapSound as { click?: () => void } | undefined;

/** Further than this between press and release is a scroll or swipe, not a tap. */
const SLOP = 10;

/**
 * Plays a soft click when the user taps anywhere, if "Tap sound" is on in
 * Settings (off by default). Scrolls and swipes stay silent. It only
 * listens: touches still reach whatever was tapped.
 */
export function TapSound({ children }: { children: React.ReactNode }) {
  const enabled = useAppSelector(s => s.preferences.tapSound);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Always the same View, so switching the setting never remounts the app.
  const onTouchStart = (e: GestureResponderEvent) => {
    if (!enabled || !native?.click) return;
    start.current = e.nativeEvent.touches.length === 1 ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY } : null;
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const from = start.current;
    start.current = null;
    if (!from) return;
    if (Math.abs(e.nativeEvent.pageX - from.x) < SLOP && Math.abs(e.nativeEvent.pageY - from.y) < SLOP) native?.click?.();
  };

  return (
    <View style={styles.flex} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
