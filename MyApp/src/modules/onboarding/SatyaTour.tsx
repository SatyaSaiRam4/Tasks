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
  { tab: 'HomeTab', title: name => `Hi ${name}, I’m Satya!`, text: 'I’ll show you how Memo works. It takes one minute.', gesture: 'wave' },
  { tab: 'HomeTab', title: () => 'Your streak', text: 'The flame at the top counts the days in a row you finished all your tasks.', gesture: 'hop' },
  { tab: 'HomeTab', title: () => 'Plans and reminders', text: 'Under it are your plans and your next reminder. Tap the arrow on a card to open it.', gesture: 'nod' },
  { tab: 'RoutinesTab', title: () => 'Plans', text: 'A plan is a goal, like “30 days of fitness”. Tap the + button to make one.', gesture: 'lookLeft' },
  { tab: 'RoutinesTab', title: () => 'Daily tasks', text: 'Inside a plan, add small tasks for each day. Tap the circle when you finish one.', gesture: 'talk' },
  { tab: 'RoutinesTab', title: () => 'Grow your streak', text: 'Finish all of today’s tasks and your streak grows by one. 🔥', gesture: 'cheer' },
  { tab: 'RemindersTab', title: () => 'Reminders', text: 'Pick a time and I’ll remind you. Turn on “Ring like an alarm” for important things.', gesture: 'talk' },
  { tab: 'VaultTab', title: () => 'Private Vault', text: 'Keep private notes locked behind your own PIN. Only you can open them.', gesture: 'lookRight' },
  { tab: 'ProfileTab', title: () => 'You’re ready!', text: 'You can watch this tour again anytime from Settings.', gesture: 'cheer' },
];

/** Reveals text a few letters at a time, like Satya is saying it. Tap to finish. */
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
 * while Satya at the bottom moves, talks and explains each tab in a speech
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
          {satyaOn ? <SatyaModel size={170} intro="long" gesture={step.gesture} gestureKey={index} /> : <SatyaOrb size={84} />}
        </View>
        <Animated.View style={[styles.bubble, { opacity: fade, transform: [{ translateY: rise }] }]}>
          <Gradient colors={gradients.hero} direction="diagonal" style={StyleSheet.absoluteFill} />
          <Sheen color={gradients.heroSheen} inset="18%" />
          <View style={styles.tail} />
          <View style={styles.head}>
            <Text style={styles.name}>Satya · your guide</Text>
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
