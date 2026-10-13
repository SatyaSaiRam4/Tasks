import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import { brand, colors, font, radius, spacing } from '../../theme';
import { useMotion } from '../../hooks/useMotion';
import { shyLine, type MeloMood } from './messages';
import { useWeather, weatherCare, weatherLabel } from './weather';

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
 * pops out and strolls off casually, turns his face to you mid-walk,
 * blushes (steam puffing) and runs off the screen; Chopper-style, he leans
 * back in from the edge with half of him showing to check whether you're
 * still looking, twice (tap him then and he's found), and comes back to
 * tell you his tip. He leaves footprints as he walks. Tapping him any time makes him blush. He walks, stops
 * to wave and tell you your tip of the moment (a speech bubble above his
 * head), wanders, now and then strolls off one side and comes back from the
 * other (peeking in first), with a soft gold spotlight following him
 * (assets/web/satya, mode "stroll"). His mood follows the user's day: proud
 * and sparkly when it's all done, pleading puppy eyes when the streak is at
 * risk, yawning late at night. Tap him and he blushes and does a shy happy
 * dance ("Tapping me won't make me happy!"). The real weather where the
 * user is shows lightly behind him (sun glow, clouds, rain, snow, mist) with
 * a small "☀️ 31° · Hyderabad" in the corner (weather.ts), and every other
 * time he stops to talk he gives a caring weather report ("It's raining in
 * Hyderabad ☔ Take an umbrella!"). Melo himself stays as he is. Nothing if
 * location isn't allowed. He pauses while Home isn't on screen, and the corner
 * simply isn't shown where 3D isn't available. If Android closes his page in
 * the background or it fails to load, it's loaded again (3 tries, and again
 * each time Home comes back), so he doesn't just vanish.
 */
export function MeloCorner({ tip, mood }: { tip: string; mood: MeloMood }) {
  // Melo's show (the ball, the stroll, the peeking) is the heart of Home, so
  // it plays even with Memo's own Reduced motion on; only the phone's system
  // Remove animations setting makes him stand still.
  const { system: reduced } = useMotion();
  const focused = useIsFocused();
  const [phase, setPhase] = useState<Phase>(Platform.OS === 'android' ? 'loading' : 'off');
  // Reloads after his page is closed or fails (the key remounts the WebView).
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);
  const noWebGL = useRef(false);
  const retry = () => {
    if (failures.current >= 3) return setPhase('off');
    failures.current += 1;
    setPhase('loading');
    setAttempt(a => a + 1);
  };
  const [width, setWidth] = useState(0);
  // What he last said and where (kept while the bubble fades away), and whether it's showing.
  const [spot, setSpot] = useState<{ x: number; y: number; text: string } | null>(null);
  const [talking, setTalking] = useState(false);
  const taps = useRef(0);
  const talks = useRef(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const bubble = useRef(new Animated.Value(0)).current;
  const weather = useWeather(focused && active);

  // Rest while Home is hidden or the app is in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (phase !== 'ready') return;
    web.current?.injectJavaScript(`window.melo && window.melo.setPaused(${!(focused && active)}); true;`);
  }, [phase, focused, active]);
  // Back on Home after he gave up: try once more (not where 3D is missing).
  useEffect(() => {
    if (phase !== 'off' || !focused || !active || noWebGL.current || Platform.OS !== 'android') return;
    failures.current = 0;
    setPhase('loading');
    setAttempt(a => a + 1);
  }, [focused, active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'ready') return;
    web.current?.injectJavaScript(`window.melo && window.melo.setMood(${JSON.stringify(mood)}); true;`);
  }, [phase, mood]);
  useEffect(() => {
    if (phase !== 'ready' || !weather) return;
    web.current?.injectJavaScript(`window.melo && window.melo.setWeather && window.melo.setWeather(${JSON.stringify(weather.kind)}, ${weather.isDay}); true;`);
  }, [phase, weather]);

  // The bubble pops in when he stops to talk and away when he walks on.
  useEffect(() => {
    Animated.spring(bubble, { toValue: talking ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: talking ? 8 : 0 }).start();
  }, [talking, bubble]);

  if (phase === 'off') return null;

  const onMessage = (data: string) => {
    if (data === 'loaded') {
      failures.current = 0;
      setPhase('ready');
      return;
    }
    if (data === 'nowebgl') {
      noWebGL.current = true;
      setPhase('off');
      return;
    }
    if (data === 'error') {
      retry();
      return;
    }
    try {
      const event = JSON.parse(data) as StageEvent;
      if (event.type === 'stop') {
        // He takes turns: the tip of the moment, then a word about the weather.
        const text = event.kind === 'shy' ? shyLine(taps.current++) : weather && talks.current++ % 2 === 1 ? weatherCare(weather) : tip;
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
        key={attempt}
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
        onError={retry}
        onRenderProcessGone={retry}
        pointerEvents="none"
      />
      {/* Tap Melo (anywhere on his stage) and he cheers. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => web.current?.injectJavaScript('window.melo && window.melo.poke(); true;')}
        accessibilityRole="button"
        accessibilityLabel={`Melo says: ${tip}. Tap to say hi.`}
      />
      {weather && phase === 'ready' ? (
        <Text style={styles.weather} pointerEvents="none" accessibilityLabel={`Weather: ${weatherCare(weather)}`}>
          {weatherLabel(weather)}
        </Text>
      ) : null}
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
  weather: {
    ...font.semibold,
    position: 'absolute',
    top: 2,
    right: spacing.xs,
    fontSize: 11.5,
    color: colors.textSecondary,
    opacity: 0.8,
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
