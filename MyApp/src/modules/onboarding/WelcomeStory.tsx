import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors, font, gradients, radius, spacing } from '../../theme';
import { Gradient } from '../../components/Gradient';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { RealIcon, type RealIconName } from '../../components/RealIcon';
import { useMotion } from '../../hooks/useMotion';
import { SatyaModel } from '../satya/SatyaModel';
import { Mom } from './Characters';

/**
 * The welcome story, shown once to new users right after they sign in (and
 * again from Settings): Riya's best friend invites her to a wedding two
 * months away and Riya plans to shop the big sale in ten days; weeks fly by
 * and she misses both. Melo arrives, and this time Memo reminds her of both,
 * months ahead. Ends on what the app does. Plays like a phone "story": it moves on by itself; tap the right
 * side for next and the left side for back.
 *
 * The scenes play in 3D (assets/web/story, built from web/story/story.js)
 * in a WebView behind the captions. If the phone can't run it, the same
 * story plays with the flat SVG characters instead.
 */

interface Scene {
  caption: string;
  /** How long the scene plays before moving on, in ms. */
  duration: number;
  /** The flat version, used when 3D isn't available. */
  Body: React.ComponentType;
}

const SCENES: Scene[] = [
  { caption: 'Meet Riya.', duration: 7800, Body: AskScene },
  { caption: 'But two months is a long time…', duration: 7000, Body: BusyScene },
  { caption: '15 December…', duration: 7000, Body: ForgotScene },
  { caption: 'That’s why Memo is here.', duration: 6500, Body: SatyaScene },
  { caption: 'This time, Riya tells Memo.', duration: 8200, Body: RemindScene },
  { caption: 'Memo remembers, so you don’t have to.', duration: 0, Body: FeaturesScene },
];

const STORY_PAGE = 'file:///android_asset/web/story/index.html';
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
          source={{ uri: `${STORY_PAGE}?motion=${reduced ? 'reduced' : 'full'}&scene=0` }}
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

/** A gentle up-and-down loop, so characters feel alive. */
function useBob(period = 2400, offset = 0) {
  const { reduced } = useMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(offset),
        Animated.timing(value, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [period, offset, reduced, value]);
  return value;
}

/** A character that walks in from one side and then breathes in place. */
function Actor({ from, delay = 0, children }: { from: 'left' | 'right' | 'bottom'; delay?: number; children: React.ReactNode }) {
  const enter = useAppear(delay, 800);
  const bob = useBob(2600, delay);
  const start = from === 'left' ? -120 : from === 'right' ? 120 : 0;
  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [start, 0] }) },
          { translateY: from === 'bottom' ? enter.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) : 0 },
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
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

function AskScene() {
  return (
    <View style={styles.scene}>
      <View style={styles.speechArea}>
        <Speech text="Riya! I’m getting married on 14 December. You have to be there!" delay={500} side="right" tone="gold" />
        <Speech text="I’ll be there! I’ll buy my dress in the big sale. It opens in 10 days!" delay={2900} side="left" />
      </View>
      <View style={styles.cast}>
        <Actor from="left">
          <Mom size={200} mood="happy" colors={['#3FBFAE', '#1F7A6F']} />
        </Actor>
        <Actor from="right" delay={200}>
          <Mom size={210} mood="happy" colors={['#D9334F', '#8C0F25']} />
        </Actor>
      </View>
    </View>
  );
}

const BUSY: IconName[] = ['clock', 'message', 'list', 'bell', 'calendar', 'repeat'];

function BusyScene() {
  const spin = useBob(3000);
  const swap = useAppear(2600, 700);
  return (
    <View style={styles.scene}>
      <View style={styles.speechArea}>
        <View style={styles.thought}>
          <Animated.Text style={[styles.thoughtText, { opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            The sale… the wedding… 🛍️💍
          </Animated.Text>
          <Animated.Text style={[styles.thoughtText, styles.thoughtOver, { opacity: swap }]}>…wait, what was coming up? 🤔</Animated.Text>
        </View>
        <View style={styles.thoughtDots}>
          <View style={[styles.thoughtDot, styles.thoughtDotBig]} />
          <View style={styles.thoughtDot} />
        </View>
      </View>
      <View style={styles.cast}>
        <View>
          {BUSY.map((icon, i) => {
            const angle = (i / BUSY.length) * Math.PI * 2;
            return (
              <Animated.View
                key={icon}
                style={[
                  styles.busyIcon,
                  {
                    left: 50 + Math.cos(angle) * 120,
                    top: 90 + Math.sin(angle) * 95,
                    transform: [{ translateY: spin.interpolate({ inputRange: [0, 1], outputRange: [i % 2 ? -8 : 8, i % 2 ? 8 : -8] }) }],
                  },
                ]}
              >
                <Icon name={icon} size={20} color={brand.champagneLight} />
              </Animated.View>
            );
          })}
          <Actor from="bottom">
            <Mom size={230} mood="worried" colors={['#3FBFAE', '#1F7A6F']} />
          </Actor>
        </View>
      </View>
    </View>
  );
}

function ForgotScene() {
  return (
    <View style={styles.scene}>
      <View style={styles.speechArea}>
        <Speech text="Ananya’s wedding was yesterday?! I missed it… and the sale too. 😢" delay={400} side="left" />
        
      </View>
      <View style={styles.cast}>
        <Actor from="left">
          <Mom size={210} mood="sad" colors={['#3FBFAE', '#1F7A6F']} />
        </Actor>
        <Actor from="right" delay={200}>
          <View />
        </Actor>
      </View>
    </View>
  );
}

function SatyaScene() {
  return (
    <View style={styles.scene}>
      <View style={styles.speechArea}>
        <Speech text="Hi, I’m Melo! Tell Memo once, even months ahead, and I’ll remember for you." delay={900} side="right" tone="gold" />
      </View>
      <View style={styles.castCenter}>
        <SatyaModel size={250} intro="long" gesture="wave" />
      </View>
    </View>
  );
}

function RemindScene() {
  const ring = useBob(220);
  const ringing = useAppear(2000, 300);
  const shake = Animated.multiply(ringing, ring.interpolate({ inputRange: [0, 1], outputRange: [-1, 1] }));
  return (
    <View style={styles.scene}>
      <View style={styles.speechArea}>
        <Speech text="Memo reminded me, weeks ahead! 💍" delay={3200} side="left" />
      </View>
      <View style={styles.cast}>
        <Actor from="left">
          <Mom size={200} mood="happy" colors={['#F06A9B', '#B0305F']} />
        </Actor>
        <Actor from="right" delay={300}>
          <Animated.View style={{ transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) }] }}>
            <View style={styles.phone}>
              <View style={styles.notch} />
              <Text style={styles.phoneTime}>9:00</Text>
              <View style={styles.alarmCard}>
                <RealIcon name="bell" size={30} />
                <Text style={styles.alarmTitle}>Ananya’s wedding 💍</Text>
                <Text style={styles.alarmMeta}>Today · 14 December</Text>
                <View style={styles.alarmPill}>
                  <Text style={styles.alarmPillText}>Alarm</Text>
                </View>
              </View>
              <View style={styles.stopButton}>
                <Text style={styles.stopText}>Stop</Text>
              </View>
            </View>
          </Animated.View>
        </Actor>
      </View>
    </View>
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
  cast: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: spacing.lg,
  },
  castCenter: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  thought: {
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: 40,
    backgroundColor: 'rgba(239,233,220,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,233,220,0.25)',
  },
  thoughtText: {
    ...font.semibold,
    fontSize: 17,
    color: colors.heroText,
    textAlign: 'center',
  },
  thoughtOver: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: spacing.lg,
  },
  thoughtDots: {
    alignItems: 'center',
    gap: 4,
  },
  thoughtDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(239,233,220,0.18)',
  },
  thoughtDotBig: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  busyIcon: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,233,220,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,233,220,0.22)',
  },
  phone: {
    width: 130,
    height: 230,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#3A3F52',
    backgroundColor: '#0B1122',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  notch: {
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3A3F52',
    marginTop: spacing.sm,
  },
  phoneTime: {
    ...font.serif,
    fontSize: 30,
    color: colors.heroText,
    marginTop: spacing.sm,
  },
  alarmCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239,233,220,0.1)',
  },
  alarmTitle: {
    ...font.bold,
    fontSize: 12.5,
    color: colors.heroText,
    marginTop: 4,
    textAlign: 'center',
  },
  alarmMeta: {
    ...font.medium,
    fontSize: 10.5,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  alarmPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: brand.ember,
  },
  alarmPillText: {
    ...font.bold,
    fontSize: 10,
    color: '#fff',
  },
  stopButton: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: brand.champagne,
  },
  stopText: {
    ...font.bold,
    fontSize: 12,
    color: brand.midnight,
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
