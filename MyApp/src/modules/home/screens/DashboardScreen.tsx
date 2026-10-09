import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { brand, colors, font, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { RealIcon } from '../../../components/RealIcon';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Glow } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { AnimatedNumber } from '../../../components/Progress';
import { TopBar } from '../../../components/ScreenHeader';
import { useLoop } from '../../../animations';
import { useCelebration } from '../../../components/Celebration';
import { getErrorMessage } from '../../../utils/apiError';
import { formatDateTime, fromDateKey, WEEKDAY_LONG, MONTH_LONG } from '../../../utils/date';
import { useGetDashboardQuery, useGetTrackCompletionsQuery, type Dashboard } from '../../streaks/streaksApi';
import { greeting } from '../../satya/messages';
import { TierRow } from '../../streaks/Tiers';
import type { MainTabParamList, RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
const SEEN_COMPLETIONS_KEY = '@rememberly/seen_track_completions';

/**
 * Home, kept simple: the streak count beside a flame, the streak badges
 * (tap one for its steps), then plain rows into today's categories and the
 * next reminder.
 */
export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const completions = useGetTrackCompletionsQuery();
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
            eyebrow: 'Category finished',
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
        <Skeleton width="45%" height={14} style={styles.skelEyebrow} />
        <Skeleton width="80%" height={40} style={styles.skelTitle} />
        <Skeleton height={280} rounded={radius.xl} />
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
  const groups = data.agenda.groups;
  const nextReminder = data.upcoming_reminders[0];

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <TopBar />
      <FadeIn style={styles.greeting}>
        <Text style={styles.date}>{longDate(streak.today.date)}</Text>
        <Text style={styles.hello} accessibilityRole="header">
          {greeting(data)}
        </Text>
      </FadeIn>

      <FadeIn index={1}>
        <StreakCard data={data} onPress={() => navigation.navigate('Consistency')} />
      </FadeIn>

      <FadeIn index={2}>
        <Text style={styles.section}>Badges</Text>
        <TierRow best={streak.best_streak} />
      </FadeIn>

      <FadeIn index={3}>
        <Text style={styles.section}>Today’s categories</Text>
        <ListGroup>
          {groups.length ? (
            groups.map((g, i) => (
              <ListRow
                key={g.track.id}
                leading={<RealIcon name="target" size={34} />}
                title={g.track.name}
                subtitle={g.required ? `${Math.min(g.completed, g.required)} of ${g.required} done` : 'Nothing due today'}
                onPress={() => navigation.navigate('TrackDetail', { trackId: g.track.id })}
                last={i === groups.length - 1}
              />
            ))
          ) : (
            <ListRow
              leading={<RealIcon name="target" size={34} />}
              title={data.total_tracks ? 'Nothing due today' : 'Create your first category'}
              onPress={() => (data.total_tracks ? navigation.navigate('RoutinesTab') : navigation.navigate('TrackEditor'))}
              last
            />
          )}
        </ListGroup>

        <Text style={styles.section}>Next reminder</Text>
        <ListGroup>
          <ListRow
            leading={<RealIcon name="bell" size={34} />}
            title={nextReminder ? nextReminder.title : 'No reminders coming up'}
            subtitle={nextReminder ? formatDateTime(nextReminder.remind_at) : 'Tap to add one'}
            onPress={() =>
              nextReminder ? navigation.navigate('ReminderEditor', { reminderId: nextReminder.id }) : navigation.navigate('RemindersTab')
            }
            last
          />
        </ListGroup>
      </FadeIn>
    </Screen>
  );
}

function longDate(key: string) {
  const d = fromDateKey(key);
  return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** One short line under the streak: what today still needs. */
function statusLine(d: Dashboard) {
  const { today } = d.streak;
  const tasks = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;
  if (d.total_tracks === 0) return { text: 'Add a category to start', color: colors.heroTextSecondary };
  if (today.secured) return { text: 'Today is done ✓', color: brand.jade };
  if (today.required === 0) return { text: 'Nothing due today', color: colors.heroTextSecondary };
  if (d.streak.at_risk) return { text: `${tasks(today.remaining)} left to keep it`, color: brand.ember };
  return { text: `${tasks(today.remaining)} left today`, color: brand.champagneLight };
}

/** The streak: a real flame beside the count, and one line about today. */
function StreakCard({ data, onPress }: { data: Dashboard; onPress: () => void }) {
  const { streak } = data;
  const status = statusLine(data);
  return (
    <Card tone="hero" onPress={onPress} contentStyle={styles.streak} accessibilityLabel={`${streak.current_streak} day streak. ${status.text}. Open streak history.`}>
      <Glow color={brand.ember} size={220} intensity={0.16} style={styles.streakGlow} />
      <FlameMark lit={streak.today.secured} />
      <View style={styles.flex}>
        <View style={styles.countRow}>
          <AnimatedNumber value={streak.current_streak} style={styles.count} />
          <Text style={styles.unit}>{streak.current_streak === 1 ? 'day' : 'days'}</Text>
        </View>
        <Text style={styles.streakLabel}>Current streak</Text>
        <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.heroTextTertiary} />
    </Card>
  );
}

/** The streak flame with a slow breathing glow; brighter once today is secured. */
function FlameMark({ lit }: { lit: boolean }) {
  const breathe = useLoop(3200);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <View style={styles.flame}>
      <Animated.View style={[styles.flameGlow, { transform: [{ scale }] }]}>
        <Glow color={brand.ember} size={110} intensity={lit ? 0.7 : 0.35} />
      </Animated.View>
      <RealIcon name="flame" size={64} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  skelEyebrow: {
    marginTop: spacing.lg,
  },
  skelTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  greeting: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  date: {
    ...t.caption,
    color: colors.textSecondary,
  },
  hello: {
    ...t.heading,
    marginTop: 2,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  streakGlow: {
    position: 'absolute',
    left: -60,
    top: -70,
  },
  flame: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  count: {
    ...font.heavy,
    fontSize: 52,
    lineHeight: 58,
    color: brand.champagneLight,
  },
  unit: {
    ...font.semibold,
    fontSize: 17,
    color: colors.heroTextSecondary,
  },
  streakLabel: {
    ...font.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.heroTextSecondary,
  },
  status: {
    ...font.bold,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  section: {
    ...t.micro,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
});
