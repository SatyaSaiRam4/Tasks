import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { colors, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { Chip, IconButton } from '../../../components/Controls';
import { ProgressRing } from '../../../components/Progress';
import { EmptyState, ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { useCelebration } from '../../../components/Celebration';
import { useAppSelector } from '../../../app/hooks';
import { formatClock, formatDayShort, relativeDayLabel, toDateKey } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import { useGetDashboardQuery, useGetTrackCompletionsQuery } from '../../streaks/streaksApi';
import { useListTracksQuery } from '../../routines/routinesApi';
import { CategoryCard } from '../../routines/components';
import { SatyaOrb } from '../../satya/SatyaModel';
import { greeting, satyaMessage } from '../../satya/messages';
import type { MainTabParamList, RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Tab = 'categories' | 'reminders';

const SEEN_COMPLETIONS_KEY = '@rememberly/seen_track_completions';

/** Home: the streak, then two simple lists, Categories and Reminders. */
export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const satyaOn = useAppSelector(s => s.preferences.satyaEnabled);
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const tracks = useListTracksQuery();
  const completions = useGetTrackCompletionsQuery();
  const { celebrate } = useCelebration();
  const [tab, setTab] = useState<Tab>('categories');
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

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text style={t.title} numberOfLines={1}>
          {data ? greeting(data) : ' '}
        </Text>
        <Text style={t.caption}>{data ? formatDayShort(data.streak.today.date) : ' '}</Text>
      </View>
      <IconButton icon="search" accessibilityLabel="Find friends by User ID" onPress={() => navigation.navigate('Discover')} />
      <IconButton icon="settings" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        {header}
        <Skeleton height={150} rounded={radius.xl} style={styles.mbLg} />
        <Skeleton height={76} rounded={radius.lg} style={styles.mbSm} />
        <Skeleton height={76} rounded={radius.lg} />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        {header}
        <ErrorState message={getErrorMessage(error, 'Could not load your home screen.')} onRetry={refetch} />
      </Screen>
    );
  }

  const { streak } = data;
  const today = streak.today;
  const todayKey = today.date;

  return (
    <Screen
      onRefresh={() => {
        refetch();
        tracks.refetch();
      }}
      refreshing={isFetching && !isLoading}
    >
      {header}

      {satyaOn ? (
        <View style={styles.tip}>
          <View style={styles.tipOrb}>
            <SatyaOrb size={26} />
          </View>
          <Text style={[t.caption, styles.tipText]}>{satyaMessage(data)}</Text>
        </View>
      ) : null}

      {/* Streak */}
      <FadeIn>
        <Card
          gradient={gradients.streak}
          gradientOpacity={[0.28, 0.1]}
          onPress={() => navigation.navigate('Consistency')}
          accessibilityLabel={`${streak.current_streak} day streak. Today ${today.completed} of ${today.required} done.`}
        >
          <View style={styles.streakRow}>
            <Icon name="flame" size={34} color={colors.streak} />
            <View style={styles.flex}>
              <Text style={styles.streakNum}>
                {streak.current_streak} <Text style={styles.streakUnit}>{streak.current_streak === 1 ? 'day' : 'days'}</Text>
              </Text>
              <Text style={t.caption}>Streak · Best {streak.best_streak}</Text>
            </View>
            {today.required > 0 ? (
              <ProgressRing progress={today.progress} size={64} stroke={6} colorsPair={today.secured ? gradients.success : gradients.primary}>
                <Text style={styles.ringText}>
                  {today.completed}/{today.required}
                </Text>
              </ProgressRing>
            ) : null}
          </View>
          <Text style={[t.caption, styles.streakNote, today.secured && { color: colors.success }]}>
            {today.required === 0 ? 'No tasks today' : today.secured ? 'Today is done ✓' : `${today.remaining} left today`}
          </Text>
        </Card>
      </FadeIn>

      {/* Two tabs */}
      <View style={styles.tabs} accessibilityRole="tablist">
        <Chip label="Categories" selected={tab === 'categories'} onPress={() => setTab('categories')} count={tracks.data?.length} />
        <Chip label="Reminders" selected={tab === 'reminders'} onPress={() => setTab('reminders')} count={data.reminder_count} />
      </View>

      {tab === 'categories' ? (
        !tracks.data ? (
          <Skeleton height={76} rounded={radius.lg} />
        ) : tracks.data.length ? (
          tracks.data.map(track => (
            <CategoryCard key={track.id} track={track} onPress={() => navigation.navigate('TrackDetail', { trackId: track.id })} />
          ))
        ) : (
          <EmptyState compact icon="target" title="No categories yet" actionLabel="New category" onAction={() => navigation.navigate('TrackEditor')} />
        )
      ) : data.upcoming_reminders.length ? (
        <Card padded={false}>
          {data.upcoming_reminders.map((r, i) => {
            const when = new Date(r.remind_at);
            return (
              <Pressable
                key={r.id}
                onPress={() => navigation.navigate('ReminderEditor', { reminderId: r.id })}
                style={({ pressed }) => [styles.reminder, i > 0 && styles.divider, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Icon name="bell" size={18} color={colors.primary} />
                <Text style={[t.bodyStrong, styles.flex]} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={t.caption}>
                  {relativeDayLabel(toDateKey(when), todayKey)}, {formatClock(when)}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <EmptyState compact icon="bell" title="No reminders coming up" actionLabel="Add reminder" onAction={() => navigation.navigate('ReminderEditor')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  mbLg: {
    marginBottom: spacing.lg,
  },
  mbSm: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tipOrb: {
    width: 30,
    height: 30,
  },
  tipText: {
    flex: 1,
    color: colors.textSecondary,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  streakNum: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
  },
  streakUnit: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  ringText: {
    color: colors.text,
    fontWeight: '800',
  },
  streakNote: {
    marginTop: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
