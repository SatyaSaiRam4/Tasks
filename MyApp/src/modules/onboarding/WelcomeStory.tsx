import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors, font, gradients, radius, spacing } from '../../theme';
import { Gradient } from '../../components/Gradient';
import { Button } from '../../components/Button';
import { RealIcon, type RealIconName } from '../../components/RealIcon';
import { useMotion } from '../../hooks/useMotion';
import { SatyaModel } from '../satya/SatyaModel';
import { Mom } from './Characters';

/**
 * The welcome story, shown once to new users right after they sign in (and
 * again from Settings): three real-life stories at once, in three panels.
 * Riya waits for a sale to buy Mom's gift, Arjun's friend is getting married
 * in two months, Karan has a bill due in 15 days. Life gets busy and all
 * three forget. Melo arrives; this time they tell Memo once, months ahead,
 * and all three make it. Ends on what the app does. Plays like a phone
 * "story": it moves on by itself; tap the right side for next, the left for
 * back.
 *
 * The scenes play in 3D (assets/web/story, built from web/story/story.js)
 * in a WebView behind the captions. If the phone can't run it, the same
 * stories play as flat illustrated panels instead.
 */

interface Scene {
  caption: string;
  /** How long the scene plays before moving on, in ms. */
  duration: number;
  /** The flat version, used when 3D isn't available. */
  Body: React.ComponentType;
}

const SCENES: Scene[] = [
  { caption: 'Three people. Three things to remember.', duration: 11500, Body: IntroScene },
  { caption: 'But life gets busy…', duration: 7500, Body: BusyScene },
  { caption: '…and they forget.', duration: 11000, Body: ForgotScene },
  { caption: 'That’s why Memo is here.', duration: 8000, Body: SatyaScene },
  { caption: 'This time, they tell Memo.', duration: 12000, Body: RemindScene },
  { caption: 'Memo remembers, so you don’t have to.', duration: 0, Body: FeaturesScene },
];

const STORY_PAGE = 'file:///android_asset/web/story/index.html';
/** Room for the progress bars and caption above the panels, and the hint below. */
const CAPTION_SPACE = 150;
const HINT_SPACE = 64;
const LOAD_TIMEOUT_MS = 9000;
type Mode = 'loading' | '3d' | 'flat';

export function WelcomeStory({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>(Platform.OS === 'android' ? 'loading' : 'flat');
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const scene = SCENES[index];
  const last = index === SCENES.length - 1;

  // Give the 3D stage a few seconds to start; otherwise play the flat story.
  useEffect(() => {
    const timer = setTimeout(() => setMode(m => (m === 'loading' ? 'flat' : m)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mode === '3d') web.current?.injectJavaScript(`window.story && window.story.show(${index}); true;`);
  }, [index, mode]);

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= SCENES.length) return;
      if (reduced) {
        setIndex(to);
        return;
      }
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setIndex(to);
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
    },
    [fade, reduced],
  );

  // Each scene fills its bar, then moves on by itself (not the last one).
  // Nothing runs until the stage is ready.
  useEffect(() => {
    progress.setValue(0);
    if (mode === 'loading') return;
    if (reduced || !scene.duration) {
      progress.setValue(1);
      return;
    }
    const run = Animated.timing(progress, { toValue: 1, duration: scene.duration, easing: Easing.linear, useNativeDriver: false });
    run.start(({ finished }) => {
      if (finished) go(index + 1);
    });
    return () => run.stop();
  }, [index, scene.duration, reduced, progress, go, mode]);

  const Body = scene.Body;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Gradient colors={gradients.hero} direction="diagonal" style={StyleSheet.absoluteFill} />

      {mode !== 'flat' ? (
        <WebView
          ref={web}
          source={{
            // The panels fit between the caption at the top and the hint at the bottom.
            uri: `${STORY_PAGE}?motion=${reduced ? 'reduced' : 'full'}&scene=0&top=${Math.round(insets.top + CAPTION_SPACE)}&bottom=${Math.round(insets.bottom + HINT_SPACE)}`,
          }}
          style={[StyleSheet.absoluteFill, styles.web, mode !== '3d' && styles.hidden]}
          containerStyle={[StyleSheet.absoluteFill, styles.web]}
          originWhitelist={['file://*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          javaScriptEnabled
          scrollEnabled={false}
          overScrollMode="never"
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={req => req.url.startsWith('file:///android_asset/')}
          onMessage={e => {
            if (e.nativeEvent.data === 'loaded') setMode(m => (m === 'loading' ? '3d' : m));
            else setMode('flat');
          }}
          onError={() => setMode('flat')}
          onRenderProcessGone={() => setMode('flat')}
          pointerEvents="none"
        />
      ) : null}
      {/* Keeps the caption readable over the 3D scene. */}
      {mode === '3d' ? (
        <Gradient colors={[brand.midnight, 'rgba(11,17,34,0)']} direction="vertical" style={[styles.scrim, { height: insets.top + 170 }]} />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.bars}>
          {SCENES.map((_, i) => (
            <View key={i} style={styles.bar}>
              {i < index ? (
                <View style={[styles.barFill, styles.full]} />
              ) : i === index ? (
                <Animated.View style={[styles.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              ) : null}
            </View>
          ))}
        </View>
        {!last ? (
          <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.View style={[styles.stage, { opacity: fade }]}>
        <Text style={styles.caption} accessibilityRole="header" accessibilityLiveRegion="polite">
          {mode === 'loading' ? ' ' : scene.caption}
        </Text>
        <View style={styles.flex}>
          {mode === 'flat' ? <Body key={index} /> : mode === '3d' && last ? <FeaturesScene compact /> : null}
        </View>
      </Animated.View>

      {/* Tap zones: left half goes back, right half goes forward. */}
      {!last && mode !== 'loading' ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={[styles.zones, { top: insets.top + 56 }]}>
            <Pressable style={styles.flex} onPress={() => go(index - 1)} accessibilityLabel="Previous" accessibilityRole="button" />
            <Pressable style={styles.flex} onPress={() => go(index + 1)} accessibilityLabel="Next" accessibilityRole="button" />
          </View>
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        {last ? (
          <Button label="Let’s begin" size="lg" onPress={onDone} />
        ) : (
          <Text style={styles.hint}>{mode === 'loading' ? 'Getting the story ready…' : 'Tap to continue'}</Text>
        )}
      </View>
    </View>
  );
}

// ---- Building blocks ------------------------------------------------------------

/** Animates 0 → 1 after `delay` ms (instantly with reduced motion). */
function useAppear(delay = 0, duration = 600) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [delay, duration, reduced, value]);
  return value;
}

/** A speech bubble that pops in after `delay`. */
function Speech({ text, delay = 0, side = 'left', tone = 'light' }: { text: string; delay?: number; side?: 'left' | 'right'; tone?: 'light' | 'gold' }) {
  const pop = useAppear(delay, 500);
  return (
    <Animated.View
      style={[
        styles.speech,
        tone === 'gold' && styles.speechGold,
        side === 'left' ? styles.speechLeft : styles.speechRight,
        { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
      ]}
    >
      <Text style={[styles.speechText, tone === 'gold' && styles.speechTextGold]}>{text}</Text>
    </Animated.View>
  );
}

// ---- Scenes ------------------------------------------------------------------------

interface Line {
  who: string;
  color: [string, string];
  text: string;
  mood: 'happy' | 'sad' | 'worried' | 'surprised';
  thought?: boolean;
}

/** The flat version of a three-panel scene: one row per story, each with its person and line. */
function Trio({ lines }: { lines: Line[] }) {
  return (
    <View style={styles.trio}>
      {lines.map((line, i) => (
        <TrioRow key={line.who} line={line} index={i} />
      ))}
    </View>
  );
}

function TrioRow({ line, index }: { line: Line; index: number }) {
  const enter = useAppear(300 + index * 1800, 600);
  return (
    <Animated.View style={[styles.trioRow, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <Mom size={96} mood={line.mood} colors={line.color} />
      <View style={styles.flex}>
        <Text style={styles.trioWho}>{line.who}</Text>
        <View style={[styles.speech, styles.speechLeft, line.thought && styles.trioThought]}>
          <Text style={[styles.speechText, line.thought && styles.trioThoughtText]}>{line.text}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const TEAL: [string, string] = ['#3FBFAE', '#1F7A6F'];
const BLUE: [string, string] = ['#5B8DEF', '#2F5FD0'];
const GREY: [string, string] = ['#A3A9B3', '#6B717C'];

function IntroScene() {
  return (
    <Trio
      lines={[
        { who: '🛍️ Riya', color: TEAL, mood: 'happy', text: 'The big sale opens in 10 days. I’ll buy Mom’s birthday gift then!' },
        { who: '💍 Arjun', color: BLUE, mood: 'happy', text: 'My friend Vikram’s wedding is on 12 February. I have to be there!' },
        { who: '⚡ Karan', color: GREY, mood: 'happy', text: 'Electricity bill, due on the 20th. I’ll pay it later.' },
      ]}
    />
  );
}

function BusyScene() {
  return (
    <Trio
      lines={[
        { who: '🛍️ Riya', color: TEAL, mood: 'worried', thought: true, text: 'The sale… when was it again? 🤔' },
        { who: '💍 Arjun', color: BLUE, mood: 'worried', thought: true, text: 'Vikram’s wedding… which date was it? 🤔' },
        { who: '⚡ Karan', color: GREY, mood: 'worried', thought: true, text: 'That bill… did I pay it? 🤔' },
      ]}
    />
  );
}

function ForgotScene() {
  return (
    <Trio
      lines={[
        { who: '🛍️ Riya', color: TEAL, mood: 'sad', text: 'Sold out?! The sale ended yesterday. No gift for Mom… 😞' },
        { who: '💍 Arjun', color: BLUE, mood: 'sad', text: 'Vikram’s wedding was yesterday?! I missed it… 😢' },
        { who: '⚡ Karan', color: GREY, mood: 'surprised', text: 'Power cut?! I forgot to pay the bill! 😱' },
      ]}
    />
  );
}

function SatyaScene() {
  return (
    <View style={styles.scene}>
      <View style={styles.speechArea}>
        <Speech text="Hi, I’m Melo! Tell Memo once, even months ahead, and I’ll remind you right on time." delay={900} side="right" tone="gold" />
      </View>
      <View style={styles.castCenter}>
        <SatyaModel size={250} intro="long" gesture="wave" />
      </View>
    </View>
  );
}

function RemindScene() {
  return (
    <Trio
      lines={[
        { who: '🛍️ Riya', color: TEAL, mood: 'happy', text: '“Sale opens today” — got Mom’s gift! 🎁' },
        { who: '💍 Arjun', color: BLUE, mood: 'happy', text: '“Vikram’s wedding today” — I made it! 💍' },
        { who: '⚡ Karan', color: GREY, mood: 'happy', text: '“Pay the bill, due tomorrow” — paid on time! 💡' },
      ]}
    />
  );
}

const FEATURES: { icon: RealIconName; title: string; text: string }[] = [
  { icon: 'target', title: 'Plans', text: 'Goals with small daily tasks' },
  { icon: 'flame', title: 'Streaks', text: 'Keep going, day after day' },
  { icon: 'bell', title: 'Reminders & alarms', text: 'Never forget what matters' },
  { icon: 'lock', title: 'Private Vault', text: 'Notes only you can open' },
];

/** What Memo does. `compact` sits under the 3D cast at the bottom of the screen. */
function FeaturesScene({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.features, compact && styles.featuresCompact]}>
      {FEATURES.map((f, i) => (
        <FeatureRow key={f.title} index={i} {...f} />
      ))}
    </View>
  );
}

function FeatureRow({ icon, title, text, index }: { icon: RealIconName; title: string; text: string; index: number }) {
  const enter = useAppear(200 + index * 220, 600);
  return (
    <Animated.View
      style={[
        styles.feature,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
    >
      <RealIcon name={icon} size={40} />
      <View style={styles.flex}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: brand.midnight,
    zIndex: 100,
    elevation: 100,
  },
  flex: {
    flex: 1,
  },
  top: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(239,233,220,0.2)',
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    backgroundColor: brand.champagne,
  },
  full: {
    width: '100%',
  },
  skip: {
    paddingVertical: spacing.xs,
  },
  skipText: {
    ...font.semibold,
    color: colors.heroTextSecondary,
  },
  stage: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  caption: {
    ...font.serifItalic,
    fontSize: 30,
    lineHeight: 36,
    color: colors.heroText,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  scene: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  speechArea: {
    minHeight: 170,
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  speech: {
    maxWidth: '78%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: brand.ivory,
  },
  speechGold: {
    backgroundColor: brand.champagne,
  },
  speechLeft: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  speechRight: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  speechText: {
    ...font.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: brand.midnight,
  },
  speechTextGold: {
    color: brand.midnight,
  },
  castCenter: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  trio: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  trioRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  trioWho: {
    ...font.bold,
    fontSize: 13,
    color: brand.champagne,
    marginBottom: spacing.xs,
  },
  trioThought: {
    backgroundColor: 'rgba(239,233,220,0.14)',
  },
  trioThoughtText: {
    color: colors.heroText,
    fontStyle: 'italic',
  },
  features: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  featuresCompact: {
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  web: {
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(11,17,34,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
  },
  featureTitle: {
    ...font.bold,
    fontSize: 16,
    color: colors.heroText,
  },
  featureText: {
    ...font.medium,
    fontSize: 13.5,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  zones: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  hint: {
    ...font.medium,
    fontSize: 13,
    color: colors.heroTextTertiary,
  },
});
