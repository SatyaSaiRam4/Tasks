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
import { SatyaModel, SatyaOrb } from '../satya/SatyaModel';
import type { MainTabParamList } from '../../navigation/RootNavigator';

interface Step {
  tab: keyof MainTabParamList;
  text: (name: string) => string;
}

const STEPS: Step[] = [
  { tab: 'HomeTab', text: name => `Hi ${name}, I'm Satya! Let me show you around. It's quick.` },
  { tab: 'HomeTab', text: () => 'This is Home. Your streak and today’s progress are right here.' },
  { tab: 'RoutinesTab', text: () => 'Plans are your goals, like 30 days of fitness. Add daily tasks and tick them off every day.' },
  { tab: 'RoutinesTab', text: () => 'Finish all of today’s tasks to grow your streak 🔥' },
  { tab: 'RemindersTab', text: () => 'Reminders ping you at the right time. Pick a day and add what to remember.' },
  { tab: 'VaultTab', text: () => 'The Vault keeps your private notes safe behind a PIN.' },
  { tab: 'ProfileTab', text: () => 'That’s it! You can replay this tour anytime from Settings.' },
];

/**
 * A game-style guide: the real app stays visible but dimmed and untouchable,
 * while a small Satya at the bottom explains each tab in a speech bubble.
 * Shown once after sign-up, and again when replayed from Settings.
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

  // Show the tab this step talks about, then fade the bubble in.
  useEffect(() => {
    goToTab(step.tab);
    fade.setValue(reduced ? 1 : 0);
    if (!reduced) Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [index, step.tab, goToTab, fade, reduced]);

  const finish = () => {
    goToTab('HomeTab');
    complete();
  };

  return (
    // Dims the app and swallows every touch, so only the guide is usable.
    <View style={styles.overlay} onStartShouldSetResponder={() => true} accessibilityViewIsModal>
      <Animated.View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg, opacity: fade }]}>
        <View style={styles.bubble}>
          <Gradient colors={gradients.hero} direction="diagonal" style={StyleSheet.absoluteFill} />
          <Sheen color={gradients.heroSheen} inset="18%" />
          <Text style={styles.name}>Satya · your guide</Text>
          <Text style={[t.body, styles.text]} accessibilityLiveRegion="polite">
            {step.text(name)}
          </Text>
          <View style={styles.footer}>
            <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
            {!last ? (
              <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
                <Text style={styles.skip}>Skip</Text>
              </Pressable>
            ) : null}
            <Button
              label={last ? 'Done' : 'Next'}
              size="sm"
              fullWidth={false}
              loading={isLoading}
              onPress={() => (last ? finish() : setIndex(i => i + 1))}
            />
          </View>
        </View>
        <View style={styles.satya}>{satyaOn ? <SatyaModel size={110} /> : <SatyaOrb size={64} />}</View>
      </Animated.View>
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  satya: {
    width: 110,
    height: 110,
    marginLeft: -spacing.sm,
  },
  bubble: {
    flex: 1,
    padding: spacing.lg + 2,
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
    backgroundColor: brand.midnight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  name: {
    ...t.micro,
    color: brand.champagne,
  },
  text: {
    ...t.aside,
    color: colors.heroText,
    fontSize: 19,
    lineHeight: 25,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(239,233,220,0.18)',
  },
  dotOn: {
    width: 18,
    backgroundColor: brand.champagne,
  },
  skip: {
    ...font.semibold,
    color: colors.heroTextSecondary,
  },
});
