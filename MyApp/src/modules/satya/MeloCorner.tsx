import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import { brand, colors, font, radius, spacing } from '../../theme';
import { useMotion } from '../../hooks/useMotion';
import { shyLine, type MeloMood } from './messages';

const MODEL_PAGE = 'file:///android_asset/web/satya/index.html';
const STAGE_HEIGHT = 190;
const BUBBLE_WIDTH = 220;

type Phase = 'loading' | 'ready' | 'off';

/**
 * What the page tells us: he stopped to talk (his head's position; "shy" after
 * he's tapped), or walked on.
 */
type StageEvent = { type: 'stop'; kind?: 'tip' | 'shy'; x: number; y: number } | { type: 'move' };

/**
 * Melo's corner, at the bottom of Home: Melo lives here. He arrives as a
 * ball in his own robe red that rolls in from one side and flips open; he
 * pops out and strolls off casually, turns his face to you mid-walk, goes
 * bright red (steam puffing) and runs off the screen; then, Chopper-style,
 * he leans back in from the edge with half of him showing to check whether
 * you're still looking, twice (tap him then and he's found), and comes back
 * to tell you his tip. Tapping him any time makes him blush bright red. He walks, stops
 * to wave and tell you your tip of the moment (a speech bubble above his
 * head), wanders, now and then strolls off one side and comes back from the
 * other (peeking in first), with a soft gold spotlight following him
 * (assets/web/satya, mode "stroll"). His mood follows the user's day: proud
 * and sparkly when it's all done, pleading puppy eyes when the streak is at
 * risk, yawning late at night. Tap him and he blushes and does a shy happy
 * dance ("Tapping me won't make me happy!"). He pauses while Home isn't on
 * screen, and the corner simply isn't shown where 3D isn't available.
 */
export function MeloCorner({ tip, mood }: { tip: string; mood: MeloMood }) {
  const { reduced } = useMotion();
  const focused = useIsFocused();
  const [phase, setPhase] = useState<Phase>(Platform.OS === 'android' ? 'loading' : 'off');
  const [width, setWidth] = useState(0);
  // What he last said and where (kept while the bubble fades away), and whether it's showing.
  const [spot, setSpot] = useState<{ x: number; y: number; text: string } | null>(null);
  const [talking, setTalking] = useState(false);
  const taps = useRef(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const bubble = useRef(new Animated.Value(0)).current;

  // Rest while Home is hidden or the app is in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (phase !== 'ready') return;
    web.current?.injectJavaScript(`window.melo && window.melo.setPaused(${!(focused && active)}); true;`);
  }, [phase, focused, active]);
  useEffect(() => {
    if (phase !== 'ready') return;
    web.current?.injectJavaScript(`window.melo && window.melo.setMood(${JSON.stringify(mood)}); true;`);
  }, [phase, mood]);

  // The bubble pops in when he stops to talk and away when he walks on.
  useEffect(() => {
    Animated.spring(bubble, { toValue: talking ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: talking ? 8 : 0 }).start();
  }, [talking, bubble]);

  if (phase === 'off') return null;

  const onMessage = (data: string) => {
    if (data === 'loaded') {
      setPhase('ready');
      return;
    }
    if (data === 'nowebgl' || data === 'error') {
      setPhase('off');
      return;
    }
    try {
      const event = JSON.parse(data) as StageEvent;
      if (event.type === 'stop') {
        const text = event.kind === 'shy' ? shyLine(taps.current++) : tip;
        setSpot({ x: event.x, y: event.y, text });
        setTalking(true);
      } else if (event.type === 'move') setTalking(false);
    } catch {
      // not a stage event
    }
  };

  // Keep the bubble on screen, centred over his head where possible.
  const left = spot ? Math.max(0, Math.min(width - BUBBLE_WIDTH, spot.x * width - BUBBLE_WIDTH / 2)) : 0;
  const tail = spot ? Math.max(16, Math.min(BUBBLE_WIDTH - 16, spot.x * width - left)) : BUBBLE_WIDTH / 2;
  const bottom = spot ? (1 - spot.y) * STAGE_HEIGHT + spacing.xs : 0;

  return (
    <View style={styles.stage} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <WebView
        ref={web}
        source={{ uri: `${MODEL_PAGE}?mode=stroll&motion=${reduced ? 'reduced' : 'full'}` }}
        style={[StyleSheet.absoluteFill, styles.web, phase !== 'ready' && styles.hidden]}
        containerStyle={styles.web}
        originWhitelist={['file://*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        javaScriptEnabled
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={req => req.url.startsWith('file:///android_asset/')}
        onMessage={e => onMessage(e.nativeEvent.data)}
        onError={() => setPhase('off')}
        onRenderProcessGone={() => setPhase('off')}
        pointerEvents="none"
      />
      {/* Tap Melo (anywhere on his stage) and he cheers. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => web.current?.injectJavaScript('window.melo && window.melo.poke(); true;')}
        accessibilityRole="button"
        accessibilityLabel={`Melo says: ${tip}. Tap to say hi.`}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bubble,
          { left, bottom, opacity: bubble, transform: [{ scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
        ]}
      >
        <Text style={styles.bubbleText}>{spot?.text}</Text>
        <View style={[styles.tail, { left: tail - 7 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: STAGE_HEIGHT,
    marginTop: spacing.md,
  },
  web: {
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    backgroundColor: brand.midnight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroGoldLine,
  },
  bubbleText: {
    ...font.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: brand.champagneLight,
    textAlign: 'center',
  },
  tail: {
    position: 'absolute',
    bottom: -6,
    width: 14,
    height: 14,
    backgroundColor: brand.midnight,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroGoldLine,
    transform: [{ rotate: '45deg' }],
  },
});
