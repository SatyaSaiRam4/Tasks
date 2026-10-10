import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, colors, font, gradients, radius, spacing, type as t } from '../../theme';
import { Gradient, Sheen } from '../../components/Gradient';
import { useMotion } from '../../hooks/useMotion';
import { Button } from '../../components/Button';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../auth/authSlice';
import { useCompleteOnboardingMutation } from '../users/usersApi';
import { SatyaModel, SatyaOrb, type SatyaGesture } from '../satya/SatyaModel';
import type { MainTabParamList } from '../../navigation/RootNavigator';

interface Step {
  tab: keyof MainTabParamList;
  title: (name: string) => string;
  text: string;
  gesture: SatyaGesture;
}

const STEPS: Step[] = [
  { tab: 'HomeTab', title: name => `Hi ${name}, I’m Melo!`, text: 'I’ll show you how Memo works. It is easy, I promise.', gesture: 'wave' },
  {
    tab: 'RoutinesTab',
    title: () => '1. Make a plan',
    text: 'A plan is a goal with an end date. For example: “Get fit in 30 days”. You can have up to 10 plans.',
    gesture: 'lookLeft',
  },
  {
    tab: 'RoutinesTab',
    title: () => '2. Add tasks to the plan',
    text: 'Tasks are the small things you do every day for that goal, like “Walk 20 minutes”. Up to 15 in a plan.',
    gesture: 'think',
  },
  {
    tab: 'RoutinesTab',
    title: () => '3. Tick when you finish',
    text: 'Open a plan and tap the circle next to a task when you have done it today.',
    gesture: 'nod',
  },
  {
    tab: 'HomeTab',
    title: () => '4. Earn streak points',
    text: 'Finish every task of a plan today = +1 streak. Finish 3 plans = +3. A plan you miss = −1.',
    gesture: 'hop',
  },
  {
    tab: 'HomeTab',
    title: () => '5. Streaks earn money',
    text: 'At 500 streak points you get ₹10, at 1000 you get ₹20. Tap the wallet at the top to redeem.',
    gesture: 'cheer',
  },
  {
    tab: 'RemindersTab',
    title: () => 'Reminders and alarms',
    text: 'Pick a time and I will remind you. For important things, turn on “Ring like an alarm”.',
    gesture: 'talk',
  },
  {
    tab: 'VaultTab',
    title: () => 'Private Vault',
    text: 'Write private notes here. They are locked with your own PIN, and only you can open them.',
    gesture: 'lookRight',
  },
  { tab: 'HomeTab', title: () => 'You are ready!', text: 'Make your first plan now. You can watch this tour again in Settings.', gesture: 'cheer' },
];

/** Reveals text a few letters at a time, like Melo is saying it. Tap to finish. */
function useTypewriter(text: string, enabled: boolean) {
  const [shown, setShown] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const id = setInterval(() => {
      setShown(n => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 2;
      });
    }, 28);
    return () => clearInterval(id);
  }, [text, enabled]);
  return { visible: text.slice(0, shown), done: shown >= text.length, finish: () => setShown(text.length) };
}

/**
 * A game-style guide: the real app stays visible but dimmed and untouchable,
 * while Melo at the bottom moves, talks and explains each tab in a speech
 * bubble. Shown once after sign-up, and again when replayed from Settings.
 */
export function SatyaTour({ goToTab }: { goToTab: (tab: keyof MainTabParamList) => void }) {
  const user = useAppSelector(selectCurrentUser);
  const satyaOn = useAppSelector(s => s.preferences.satyaEnabled);
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const [index, setIndex] = useState(0);
  const [complete, { isLoading }] = useCompleteOnboardingMutation();
  const fade = useRef(new Animated.Value(0)).current;

  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const name = user?.display_name.split(' ')[0] ?? 'there';
  const speech = useTypewriter(step.text, !reduced);

  // Show the tab this step talks about, then bring the bubble in.
  useEffect(() => {
    goToTab(step.tab);
    fade.setValue(reduced ? 1 : 0);
    if (!reduced) Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [index, step.tab, goToTab, fade, reduced]);

  const finish = () => {
    goToTab('HomeTab');
    complete();
  };
  const next = () => {
    if (!speech.done) return speech.finish();
    if (last) finish();
    else setIndex(i => i + 1);
  };

  const rise = fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    // Dims the app and swallows every touch, so only the guide is usable.
    <View style={styles.overlay} onStartShouldSetResponder={() => true} accessibilityViewIsModal>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.satya}>
          {satyaOn ? <SatyaModel size={170} intro="long" gesture={index === 0 ? [step.gesture, 'talk'] : ['walk', step.gesture, 'talk']} gestureKey={index} /> : <SatyaOrb size={84} />}
        </View>
        <Animated.View style={[styles.bubble, { opacity: fade, transform: [{ translateY: rise }] }]}>
          <Gradient colors={gradients.hero} direction="diagonal" style={StyleSheet.absoluteFill} />
          <Sheen color={gradients.heroSheen} inset="18%" />
          <View style={styles.tail} />
          <View style={styles.head}>
            <Text style={styles.name}>Melo · your guide</Text>
            <Text style={styles.count}>
              {index + 1} / {STEPS.length}
            </Text>
          </View>
          <Pressable onPress={speech.finish} accessibilityRole="text">
            <Text style={styles.title}>{step.title(name)}</Text>
            <Text style={[t.body, styles.text]} accessibilityLabel={step.text} accessibilityLiveRegion="polite">
              {speech.visible}
              {/* Keeps the bubble's height steady while the words appear. */}
              <Text style={styles.ghost}>{step.text.slice(speech.visible.length)}</Text>
            </Text>
          </Pressable>
          <View style={styles.footer}>
            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn, i < index && styles.dotDone]} />
              ))}
            </View>
            {index > 0 ? (
              <Pressable onPress={() => setIndex(i => i - 1)} hitSlop={10} accessibilityRole="button">
                <Text style={styles.link}>Back</Text>
              </Pressable>
            ) : (
              <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
                <Text style={styles.link}>Skip</Text>
              </Pressable>
            )}
            <Button label={last ? 'Start using Memo' : 'Next'} size="sm" fullWidth={false} loading={isLoading} onPress={next} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrimSoft,
    justifyContent: 'flex-end',
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  satya: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -spacing.md,
    zIndex: 1,
  },
  bubble: {
    alignSelf: 'stretch',
    padding: spacing.lg + 2,
    borderRadius: radius.xl,
    backgroundColor: brand.midnight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  tail: {
    position: 'absolute',
    top: -1,
    alignSelf: 'center',
    width: 60,
    height: 2,
    borderRadius: 1,
    backgroundColor: brand.champagne,
    opacity: 0.6,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    ...t.micro,
    color: brand.champagne,
  },
  count: {
    ...font.semibold,
    fontSize: 12,
    color: colors.heroTextTertiary,
  },
  title: {
    ...font.serif,
    fontSize: 24,
    lineHeight: 28,
    color: colors.heroText,
    marginTop: spacing.sm,
  },
  text: {
    ...font.medium,
    color: colors.heroTextSecondary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: spacing.xs,
  },
  ghost: {
    color: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(239,233,220,0.18)',
  },
  dotOn: {
    width: 16,
    backgroundColor: brand.champagne,
  },
  dotDone: {
    backgroundColor: 'rgba(243,220,166,0.5)',
  },
  link: {
    ...font.semibold,
    color: colors.heroTextSecondary,
  },
});
