import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors, font, gradients, radius, spacing } from '../../theme';
import { Gradient } from '../../components/Gradient';
import { Button } from '../../components/Button';
import { RealIcon, type RealIconName } from '../../components/RealIcon';
import { Icon } from '../../components/Icon';
import { useMotion } from '../../hooks/useMotion';
import { SatyaModel } from '../satya/SatyaModel';
import { Kid, Man, Mom } from './Characters';

/**
 * The welcome story, shown once to new users right after they sign in (and
 * again from Settings): Aarav asks Mom to remind him of Grandma's
 * birthday, two days away. Two busy days fly by, she forgets, and they miss
 * the call. Melo arrives: tell Memo once, days or months ahead, and it
 * reminds you on the day. This time Mom saves it in Memo; on the birthday it
 * reminds her (and sends Papa a WhatsApp), and Aarav calls Grandma. Ends
 * on what the app does, with an optional Part 2 (a quiet link at the top
 * right of the last slide) with a new cast: Satya turns getting fit into a
 * plan with daily tasks, his streak grows, he earns the Bronze badge and
 * streaks can earn real money (his friend Riya explains); he keeps his
 * private things in the Vault, behind his own PIN. Plays like a phone
 * "story": it moves on by itself; tap the right side for next, the left for
 * back.
 *
 * The scenes play in 3D (assets/web/story, built from web/story/story.js)
 * in a WebView behind the captions. If the phone can't run it, the same
 * story plays as flat illustrated scenes instead.
 */

interface Scene {
  caption: string;
  /** How long the scene plays before moving on, in ms. */
  duration: number;
  /** The flat version, used when 3D isn't available. */
  Body: React.ComponentType;
}

const SCENES: Scene[] = [
  { caption: 'Meet Aarav. Grandma’s birthday is in 2 days.', duration: 12500, Body: AskScene },
  { caption: 'Two busy days fly by… and then…', duration: 15500, Body: MissedScene },
  { caption: 'That’s why Memo is here.', duration: 10500, Body: SatyaScene },
  { caption: 'This time, Mom tells Memo.', duration: 19000, Body: RemindScene },
  { caption: 'Part 2 · Meet Satya. Big goals, one small step a day.', duration: 21500, Body: PlanScene },
  { caption: 'Part 2 · Private things stay private.', duration: 11000, Body: VaultScene },
  { caption: 'Memo remembers, so you don’t have to.', duration: 0, Body: FeaturesScene },
];

/**
 * Part 1 (the birthday) plays by default. Part 2 (plans, streaks, the Vault)
 * is optional, from a quiet link on the last slide, and has its own bars.
 */
const MAIN_STORY = [0, 1, 2, 3, 6];
const PART_TWO = [4, 5, 6];

const STORY_PAGE = 'file:///android_asset/web/story/index.html';
/** Room for the progress bars and caption above the panels, and the hint below. */
const CAPTION_SPACE = 150;
const HINT_SPACE = 64;
const LOAD_TIMEOUT_MS = 9000;
type Mode = 'loading' | '3d' | 'flat';

export function WelcomeStory({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  // `step` walks through the chosen story; `index` is the scene it shows.
  const [step, setStep] = useState(0);
  const [more, setMore] = useState(false);
  const order = more ? PART_TWO : MAIN_STORY;
  const index = order[step];
  const [mode, setMode] = useState<Mode>(Platform.OS === 'android' ? 'loading' : 'flat');
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const scene = SCENES[index];
  const last = step === order.length - 1;

  // Give the 3D stage a few seconds to start; otherwise play the flat story.
  useEffect(() => {
    const timer = setTimeout(() => setMode(m => (m === 'loading' ? 'flat' : m)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mode === '3d') web.current?.injectJavaScript(`window.story && window.story.show(${index}, ${more ? 2 : 1}); true;`);
  }, [index, mode, more]);

  const go = useCallback(
    (to: number, withMore = more) => {
      const length = (withMore ? PART_TWO : MAIN_STORY).length;
      if (to < 0 || to >= length) return;
      const apply = () => {
        setMore(withMore);
        setStep(to);
      };
      if (reduced) {
        apply();
        return;
      }
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        apply();
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
    },
    [fade, reduced, more],
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
      if (finished) go(step + 1);
    });
    return () => run.stop();
  }, [step, index, scene.duration, reduced, progress, go, mode]);

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
          {order.map((_, i) => (
            <View key={i} style={styles.bar}>
              {i < step ? (
                <View style={[styles.barFill, styles.full]} />
              ) : i === step ? (
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
        {last && !more ? (
          // Optional, so it's quiet: Part 2 is Satya's story (plans, streaks, rewards, the Vault).
          <Pressable
            onPress={() => go(0, true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Watch part 2: Satya's story about plans, streaks and the Vault"
            style={({ pressed }) => [styles.moreLink, pressed && styles.pressed]}
          >
            <Icon name="play" size={11} color={colors.heroTextTertiary} strokeWidth={2.2} />
            <Text style={styles.moreText}>Part 2</Text>
          </Pressable>
        ) : null}
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
            <Pressable style={styles.flex} onPress={() => go(step - 1)} accessibilityLabel="Previous" accessibilityRole="button" />
            <Pressable style={styles.flex} onPress={() => go(step + 1)} accessibilityLabel="Next" accessibilityRole="button" />
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
  who: 'Aarav' | 'Mom' | 'Satya' | 'Riya';
  text: string;
  mood: 'happy' | 'sad' | 'worried' | 'surprised';
  thought?: boolean;
}

/** The flat version of a panel: Aarav and Mom, each with their line, one after the other. */
function Duo({ lines }: { lines: Line[] }) {
  return (
    <View style={styles.trio}>
      {lines.map((line, i) => (
        <DuoRow key={`${line.who}${i}`} line={line} index={i} compact={lines.length > 2} />
      ))}
    </View>
  );
}

function DuoRow({ line, index, compact }: { line: Line; index: number; compact?: boolean }) {
  const enter = useAppear(400 + index * 3800, 700);
  return (
    <Animated.View style={[styles.trioRow, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      {/* More lines in a scene: smaller figures, so it all fits on one screen. */}
      {line.who === 'Aarav' ? (
        <Kid size={compact ? 82 : 120} mood={line.mood} />
      ) : line.who === 'Satya' ? (
        <Man size={compact ? 100 : 140} mood={line.mood} />
      ) : line.who === 'Riya' ? (
        <Mom size={compact ? 92 : 130} mood={line.mood} colors={['#F6B04A', '#C97A12']} ponytail />
      ) : (
        <Mom size={compact ? 92 : 130} mood={line.mood} />
      )}
      <View style={styles.flex}>
        <Text style={styles.trioWho}>{line.who}</Text>
        <View style={[styles.speech, styles.speechLeft, line.thought && styles.trioThought]}>
          <Text style={[styles.speechText, line.thought && styles.trioThoughtText]}>{line.text}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function AskScene() {
  return (
    <Duo
      lines={[
        { who: 'Aarav', mood: 'happy', text: 'Mom, Grandma’s birthday is in 2 days! Please remind me to call her. 🎂' },
        { who: 'Mom', mood: 'happy', text: 'Just 2 days? I’ll remember, don’t worry.' },
      ]}
    />
  );
}

function MissedScene() {
  return (
    <Duo
      lines={[
        { who: 'Aarav', mood: 'sad', text: 'Mom… Grandma’s birthday was yesterday. We forgot to call her. 😞' },
        { who: 'Mom', mood: 'sad', text: 'Oh no, beta… I forgot.' },
      ]}
    />
  );
}

function SatyaScene() {
  return (
    <View style={styles.scene}>
      <View style={styles.speechArea}>
        <Speech text="Hi, I’m Melo! Tell Memo once, days or months ahead, and I’ll remind you right on the day." delay={900} side="right" tone="gold" />
      </View>
      <View style={styles.castCenter}>
        <SatyaModel size={250} intro="long" gesture="wave" />
      </View>
    </View>
  );
}

function RemindScene() {
  return (
    <Duo
      lines={[
        { who: 'Mom', mood: 'happy', text: 'Saved in Memo, for 14 October. Done! ✅' },
        { who: 'Mom', mood: 'surprised', text: 'Memo reminded me, and sent Papa a WhatsApp too! 📲' },
        { who: 'Aarav', mood: 'happy', text: 'Happy birthday, Grandma! 🎂 I made you a card!' },
      ]}
    />
  );
}

function PlanScene() {
  return (
    <Duo
      lines={[
        { who: 'Satya', mood: 'happy', text: 'Riya, I want to get fit in 30 days! 💪' },
        { who: 'Riya', mood: 'happy', text: 'Make it a plan in Memo, Satya: a few small tasks every day.' },
        { who: 'Satya', mood: 'surprised', text: 'Streak 7! I got the Bronze badge! 🥉' },
        { who: 'Riya', mood: 'happy', text: 'And your streaks can earn real money too! 💰' },
      ]}
    />
  );
}

function VaultScene() {
  return (
    <Duo
      lines={[
        { who: 'Satya', mood: 'happy', text: 'My bank details, ID photos and voice notes? In my private Vault, behind my own PIN. 🔒' },
        { who: 'Riya', mood: 'happy', text: 'So only you can open it? Smart, Satya! 😎' },
      ]}
    />
  );
}

const FEATURES: { icon: RealIconName; title: string; text: string }[] = [
  { icon: 'bell', title: 'Reminders', text: 'Right on the day, even months ahead, and on WhatsApp too' },
  { icon: 'target', title: 'Plans', text: 'Big goals as small daily tasks' },
  { icon: 'flame', title: 'Streaks and badges', text: 'Keep going, and earn real money' },
  { icon: 'lock', title: 'Private Vault', text: 'Notes, voice and photos behind your PIN' },
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
  moreLink: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.xs,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
  },
  moreText: {
    ...font.medium,
    fontSize: 12.5,
    color: colors.heroTextTertiary,
  },
  pressed: {
    opacity: 0.7,
  },
  hint: {
    ...font.medium,
    fontSize: 13,
    color: colors.heroTextTertiary,
  },
});
