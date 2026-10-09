import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { brand, colors, font, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { RealIcon } from '../../../components/RealIcon';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Glow } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { AnimatedNumber } from '../../../components/Progress';
import { TopBar } from '../../../components/ScreenHeader';
import { useLoop } from '../../../animations';
import { useCelebration } from '../../../components/Celebration';
import { getErrorMessage } from '../../../utils/apiError';
import { formatDateTime } from '../../../utils/date';
import { useGetDashboardQuery, useGetTrackCompletionsQuery } from '../../streaks/streaksApi';
import { useListTracksQuery } from '../../routines/routinesApi';
import type { MainTabParamList, RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
const SEEN_COMPLETIONS_KEY = '@rememberly/seen_track_completions';

/**
 * Home, as simple as it gets: the streak in the middle, then two cards —
 * the user's plans (tap one to open it) and the next reminder. Each card's
 * arrow opens its full tab.
 */
export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const completions = useGetTrackCompletionsQuery();
  const tracks = useListTracksQuery();
  const { celebrate } = useCelebration();
  const celebrated = useRef(false);

  // Celebrate finished categories the user hasn't seen yet.
  useEffect(() => {
    if (!completions.data?.length || celebrated.current) return;
    celebrated.current = true;
    AsyncStorage.getItem(SEEN_COMPLETIONS_KEY)
      .then(raw => {
        const seen = new Set<string>(raw ? JSON.parse(raw) : []);
        for (const c of completions.data!.filter(x => !seen.has(x.id) && x.required_total > 0)) {
          celebrate({
            icon: 'trophy',
            tone: c.is_perfect ? 'streak' : 'success',
            eyebrow: 'Plan finished',
            title: c.track_name,
            subtitle: c.is_perfect
              ? `${c.duration_days} days, every task done. Amazing!`
              : `You did ${Math.round((100 * c.completed_total) / c.required_total)}% of your tasks.`,
            stats: c.bonus_points ? [{ label: 'Bonus', value: `+${c.bonus_points}` }] : undefined,
          });
        }
        completions.data!.forEach(c => seen.add(c.id));
        return AsyncStorage.setItem(SEEN_COMPLETIONS_KEY, JSON.stringify([...seen]));
      })
      .catch(() => undefined);
  }, [completions.data, celebrate]);

  if (isLoading) {
    return (
      <Screen>
        <TopBar />
        <Skeleton height={220} rounded={radius.xl} style={styles.skelTop} />
        <Skeleton height={160} rounded={radius.lg} />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <TopBar />
        <ErrorState message={getErrorMessage(error, 'Could not load your home screen.')} onRetry={refetch} />
      </Screen>
    );
  }

  const { streak } = data;
  const nextReminder = data.upcoming_reminders[0];
  const plans = (tracks.data ?? []).filter(tr => tr.status === 'ACTIVE' || tr.status === 'UPCOMING');

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <TopBar />

      <FadeIn>
        <StreakHero count={streak.current_streak} lit={streak.today.secured} onPress={() => navigation.navigate('Consistency')} />
      </FadeIn>

      <FadeIn index={1}>
        <HomeCard icon="target" title="My plans" onOpen={() => navigation.navigate('RoutinesTab')}>
          {plans.length ? (
            plans.map((tr, i) => (
              <Row
                key={tr.id}
                title={tr.name}
                subtitle={planLine(tr.today_required, tr.today_completed, tr.status === 'UPCOMING')}
                onPress={() => navigation.navigate('TrackDetail', { trackId: tr.id })}
                last={i === plans.length - 1}
              />
            ))
          ) : (
            <Row title="Create your first plan" subtitle="A goal with small daily tasks" onPress={() => navigation.navigate('TrackEditor')} last add />
          )}
        </HomeCard>
      </FadeIn>

      <FadeIn index={2}>
        <HomeCard icon="bell" title="Next reminder" onOpen={() => navigation.navigate('RemindersTab')}>
          {nextReminder ? (
            <Row
              title={nextReminder.title}
              subtitle={formatDateTime(nextReminder.remind_at)}
              onPress={() => navigation.navigate('ReminderEditor', { reminderId: nextReminder.id })}
              last
            />
          ) : (
            <Row title="No reminders yet" subtitle="Tap to add one" onPress={() => navigation.navigate('ReminderEditor')} last add />
          )}
        </HomeCard>
      </FadeIn>
    </Screen>
  );
}

/** "2 of 3 tasks done today", or why there is nothing to do. */
function planLine(required: number, completed: number, upcoming: boolean) {
  if (upcoming) return 'Starts soon';
  if (required === 0) return 'Nothing due today';
  if (completed >= required) return 'All done today ✓';
  return `${Math.min(completed, required)} of ${required} tasks done today`;
}

/** The streak, centered: a breathing flame, the count, one word under it. */
function StreakHero({ count, lit, onPress }: { count: number; lit: boolean; onPress: () => void }) {
  return (
    <Card tone="hero" onPress={onPress} contentStyle={styles.streak} accessibilityLabel={`Streak ${count}. Open streak history.`}>
      <Glow color={brand.ember} size={260} intensity={0.16} style={styles.streakGlow} />
      <FlameMark lit={lit} />
      <AnimatedNumber value={count} style={styles.count} />
      <Text style={styles.streakLabel}>Streak</Text>
    </Card>
  );
}

/** A Home card: icon, title and an arrow that opens the full tab. */
function HomeCard({ icon, title, onOpen, children }: { icon: 'target' | 'bell'; title: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <Card padded={false} style={styles.homeCard}>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${title}`}>
        <RealIcon name={icon} size={30} />
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.openButton}>
          <Icon name="arrow-right" size={16} color={colors.gold} />
        </View>
      </Pressable>
      {children}
    </Card>
  );
}

/** One line inside a Home card, with an arrow into it. */
function Row({ title, subtitle, onPress, last, add }: { title: string; subtitle: string; onPress: () => void; last?: boolean; add?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={styles.flex}>
        <Text style={t.bodyStrong} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[t.caption, styles.rowSub]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Icon name={add ? 'plus' : 'chevron-right'} size={18} color={add ? colors.gold : colors.textTertiary} />
    </Pressable>
  );
}

/** The streak flame with a slow breathing glow; brighter once today is secured. */
function FlameMark({ lit }: { lit: boolean }) {
  const breathe = useLoop(3200);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <View style={styles.flame}>
      <Animated.View style={[styles.flameGlow, { transform: [{ scale }] }]}>
        <Glow color={brand.ember} size={130} intensity={lit ? 0.7 : 0.35} />
      </Animated.View>
      <RealIcon name="flame" size={76} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  skelTop: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  streak: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.sm,
  },
  streakGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: -60,
  },
  flame: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    ...font.heavy,
    fontSize: 60,
    lineHeight: 66,
    color: brand.champagneLight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  streakLabel: {
    ...t.micro,
    color: colors.heroTextSecondary,
  },
  homeCard: {
    marginTop: spacing.lg,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  cardTitle: {
    ...t.subtitle,
    flex: 1,
  },
  openButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowSub: {
    marginTop: 2,
  },
});
