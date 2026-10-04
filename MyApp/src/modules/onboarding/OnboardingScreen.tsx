import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, GUTTER, radius, spacing, type as t } from '../../theme';
import { useMotion } from '../../hooks/useMotion';
import { Button } from '../../components/Button';
import { Glow, Gradient } from '../../components/Gradient';
import { Icon, type IconName } from '../../components/Icon';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../auth/authSlice';
import { useCompleteOnboardingMutation } from '../users/usersApi';
import { SatyaModel } from '../satya/SatyaModel';

interface Step {
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  example?: () => React.ReactNode;
}

function ExampleCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.example}>{children}</View>;
}

function Line({ left, right, done }: { left: string; right: string; done?: boolean }) {
  return (
    <View style={styles.exLine}>
      <Icon name={done ? 'check-circle' : 'target'} size={16} color={done ? colors.success : colors.textTertiary} />
      <Text style={styles.exTime}>{left}</Text>
      <Text style={[t.body, styles.flex]}>{right}</Text>
    </View>
  );
}

const STEPS: Step[] = [
  {
    icon: 'sparkles',
    eyebrow: 'Welcome',
    title: "Hi, I'm Satya.",
    body: "I'll help you build consistency without overwhelming you. Let me show you around. It takes a minute.",
  },
  {
    icon: 'home',
    eyebrow: 'Dashboard',
    title: 'Your day at a glance',
    body: 'See your current streak, your best streak, today’s progress, and the actions still pending, all in one place.',
  },
  {
    icon: 'target',
    eyebrow: 'Tracks',
    title: 'Tracks are your goals',
    body: 'A Track is something you want to stay consistent with, for a set period.',
    example: () => (
      <ExampleCard>
        <Text style={t.micro}>Track</Text>
        <Text style={t.heading}>🏋️ Gym</Text>
        <Text style={t.caption}>01 Oct → 30 Oct</Text>
      </ExampleCard>
    ),
  },
  {
    icon: 'clock',
    eyebrow: 'Actions',
    title: 'Actions fill your day',
    body: 'Inside each Track, add the actions you’ll do, with a time and how often they repeat.',
    example: () => (
      <ExampleCard>
        <Line left="7:00 AM" right="Morning Gym" />
        <Line left="9:00 AM" right="Office" />
        <Line left="10:00 AM" right="Oats" />
      </ExampleCard>
    ),
  },
  {
    icon: 'check-circle',
    eyebrow: 'Verification',
    title: 'Confirm, don’t just tick',
    body: 'When you finish an action, I’ll ask you to confirm it. That keeps your streak honest and meaningful.',
    example: () => (
      <ExampleCard>
        <Text style={[t.caption, styles.center]}>Did you actually complete</Text>
        <Text style={[t.subtitle, styles.center]}>“Morning Workout”?</Text>
        <View style={styles.exButton}>
          <Text style={styles.exButtonText}>Yes, I completed it</Text>
        </View>
      </ExampleCard>
    ),
  },
  {
    icon: 'flame',
    eyebrow: 'Streak',
    title: 'Every required action, every day',
    body: 'Complete every required action for the day to keep your streak. Miss one and it starts again tomorrow. No guilt, just a fresh start.',
    example: () => (
      <ExampleCard>
        <Line left="5 / 5" right="Today complete" done />
        <Text style={[t.heading, { color: colors.streak }]}>🔥 +1 day</Text>
      </ExampleCard>
    ),
  },
  {
    icon: 'bell',
    eyebrow: 'Reminders',
    title: 'Never forget what matters',
    body: 'Set date and time reminders, later today or months away. Get a notification on time, and optionally a WhatsApp message too.',
  },
  {
    icon: 'lock',
    eyebrow: 'Vault',
    title: 'Your private space',
    body: 'Keep secrets, credentials and personal notes in the Vault. It’s encrypted, has its own PIN, and locks itself.',
  },
  {
    icon: 'users',
    eyebrow: 'Discover',
    title: 'Share the streak, not your life',
    body: 'Friends can look you up by your User ID, but only if you make your profile public, and they only see what you choose.',
  },
];

export function OnboardingScreen() {
  const user = useAppSelector(selectCurrentUser);
  const { reduced } = useMotion();
  const [index, setIndex] = useState(0);
  const [complete, { isLoading }] = useCompleteOnboardingMutation();
  const fade = useRef(new Animated.Value(1)).current;
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const go = (next: number) => {
    if (reduced) {
      setIndex(next);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setIndex(next);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };

  // Completing the tour flips the flag, and the navigator moves on to the dashboard.
  const finish = () => complete();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Glow color={colors.primary} size={600} intensity={0.2} style={styles.glow} />
      <View style={styles.top}>
        <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn, i < index && styles.dotDone]} />
          ))}
        </View>
        {!last ? (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.skip}>Skip tour</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.satya}>
        <SatyaModel size={index === 0 ? 240 : 170} intro={index === 0 ? 'long' : 'short'} />
      </View>

      <Animated.View style={[styles.content, { opacity: fade }]}>
        <View style={styles.eyebrowRow}>
          <Gradient colors={gradients.primary} borderRadius={radius.sm} style={styles.stepIcon}>
            <Icon name={step.icon} size={16} color={colors.white} />
          </Gradient>
          <Text style={[t.micro, { color: colors.primary }]}>{step.eyebrow}</Text>
        </View>
        <Text style={[t.display, styles.title]} accessibilityRole="header">
          {index === 0 && user ? `Hi ${user.display_name.split(' ')[0]}, I'm Satya.` : step.title}
        </Text>
        <Text style={[t.body, styles.body]}>{step.body}</Text>
        {step.example?.()}
      </Animated.View>

      <View style={styles.footer}>
        {index > 0 ? <Button label="Back" variant="secondary" fullWidth={false} onPress={() => go(index - 1)} style={styles.back} /> : null}
        <Button
          label={last ? "Let's begin" : index === 0 ? 'Show me around' : 'Next'}
          iconRight={last ? 'arrow-right' : 'chevron-right'}
          size="lg"
          onPress={() => (last ? finish() : go(index + 1))}
          loading={isLoading}
          style={styles.flex}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: GUTTER,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  glow: {
    position: 'absolute',
    top: -200,
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    minHeight: 24 + spacing.md, // steady when "Skip tour" hides on the last step
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceHigh,
  },
  dotOn: {
    width: 22,
    backgroundColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primarySoft,
  },
  skip: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  satya: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  content: {
    flex: 1,
    marginTop: spacing.lg,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
  },
  body: {
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  example: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  exLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exTime: {
    width: 64,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  exButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  exButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  back: {
    minWidth: 96,
  },
});
