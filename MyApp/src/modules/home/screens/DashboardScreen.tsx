import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { colors, font, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { IconButton, Segmented } from '../../../components/Controls';
import { AnimatedNumber, ProgressRing } from '../../../components/Progress';
import { EmptyState, ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Glow } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { Eyebrow, TopBar } from '../../../components/ScreenHeader';
import { useLayout } from '../../../hooks/useLayout';
import { useLoop } from '../../../animations';
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

/**
 * Home, laid out like an editorial cover: the date and greeting, Satya's
 * line, the streak hero, then two simple lists, Categories and Reminders.
 * Tablets split it into two columns.
 */
export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const satyaOn = useAppSelector(s => s.preferences.satyaEnabled);
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const tracks = useListTracksQuery();
  const completions = useGetTrackCompletionsQuery();
  const { celebrate } = useCelebration();
  const [tab, setTab] = useState<Tab>('categories');
  const celebrated = useRef(false);
  const { isTablet } = useLayout();

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
    <TopBar
      actions={<IconButton icon="search" accessibilityLabel="Find friends by User ID" onPress={() => navigation.navigate('Discover')} />}
    />
  );

  if (isLoading) {
    return (
      <Screen wide>
        {header}
        <Skeleton width={140} height={12} style={styles.skelEyebrow} />
        <Skeleton width="80%" height={40} rounded={radius.sm} style={styles.mbLg} />
        <Skeleton height={190} rounded={radius.xl} style={styles.mbLg} />
        <Skeleton height={50} rounded={radius.pill} style={styles.mbLg} />
        <Skeleton height={84} rounded={radius.lg} style={styles.mbSm} />
        <Skeleton height={84} rounded={radius.lg} />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen wide>
        {header}
        <ErrorState message={getErrorMessage(error, 'Could not load your home screen.')} onRetry={refetch} />
      </Screen>
    );
  }

  const { streak } = data;
  const today = streak.today;
  const todayKey = today.date;

  const intro = (
    <>
      <FadeIn style={styles.cover}>
        <Eyebrow label={formatDayShort(today.date)} />
        <Text style={[t.display, styles.greeting]} numberOfLines={2}>
          {greeting(data)}
        </Text>
        {satyaOn ? (
          <View style={styles.tip}>
            <View style={styles.tipOrb}>
              <SatyaOrb size={28} />
            </View>
            <Text style={[t.aside, styles.tipText]}>{satyaMessage(data)}</Text>
          </View>
        ) : null}
      </FadeIn>

      {/* Streak */}
      <FadeIn index={1}>
        <Card
          tone="feature"
          padded={false}
          onPress={() => navigation.navigate('Consistency')}
          accessibilityLabel={`${streak.current_streak} day streak. Today ${today.completed} of ${today.required} done.`}
        >
          <View style={styles.hero}>
            <View style={styles.flex}>
              <View style={styles.heroLabel}>
                <FlameMark lit={today.secured} />
                <Text style={t.micro}>Current streak</Text>
              </View>
              <View style={styles.heroNumberRow}>
                <AnimatedNumber value={streak.current_streak} style={styles.heroNumber} />
                <Text style={styles.heroUnit}>{streak.current_streak === 1 ? 'day' : 'days'}</Text>
              </View>
              <Text style={styles.best}>
                Best <Text style={styles.bestNum}>{streak.best_streak}</Text>
              </Text>
            </View>
            {today.required > 0 ? (
              <ProgressRing progress={today.progress} size={96} stroke={5} colorsPair={today.secured ? gradients.success : gradients.gold}>
                <Text style={styles.ringNum}>
                  {today.completed}
                  <Text style={styles.ringOf}>/{today.required}</Text>
                </Text>
                <Text style={styles.ringLabel}>today</Text>
              </ProgressRing>
            ) : null}
          </View>
          <View style={styles.heroFoot}>
            <Icon
              name={today.secured ? 'check-circle' : today.required === 0 ? 'moon' : 'clock'}
              size={15}
              color={today.secured ? colors.success : colors.gold}
              strokeWidth={1.8}
            />
            <Text style={[styles.heroNote, today.secured && { color: colors.success }]}>
              {today.required === 0 ? 'No tasks today' : today.secured ? 'Today is done ✓' : `${today.remaining} left today`}
            </Text>
            <Icon name="arrow-right" size={15} color={colors.textTertiary} />
          </View>
        </Card>
      </FadeIn>
    </>
  );

  const lists = (
    <FadeIn index={2}>
      {/* Two tabs */}
      <Segmented
        style={styles.tabs}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'categories', label: 'Categories', count: tracks.data?.length },
          { value: 'reminders', label: 'Reminders', count: data.reminder_count },
        ]}
      />

      {tab === 'categories' ? (
        !tracks.data ? (
          <Skeleton height={84} rounded={radius.lg} />
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
                <View style={styles.reminderIcon}>
                  <Icon name="bell" size={16} color={colors.gold} strokeWidth={1.8} />
                </View>
                <View style={styles.flex}>
                  <Text style={t.bodyStrong} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={[t.caption, styles.reminderWhen]}>
                    {relativeDayLabel(toDateKey(when), todayKey)}, {formatClock(when)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.textTertiary} />
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <EmptyState compact icon="bell" title="No reminders coming up" actionLabel="Add reminder" onAction={() => navigation.navigate('ReminderEditor')} />
      )}
    </FadeIn>
  );

  return (
    <Screen
      wide
      onRefresh={() => {
        refetch();
        tracks.refetch();
      }}
      refreshing={isFetching && !isLoading}
    >
      {header}
      {isTablet ? (
        <View style={styles.columns}>
          <View style={styles.colMain}>{intro}</View>
          <View style={styles.colSide}>{lists}</View>
        </View>
      ) : (
        <>
          {intro}
          {lists}
        </>
      )}
    </Screen>
  );
}

/** The streak flame with a slow breathing halo; brighter once today is secured. */
function FlameMark({ lit }: { lit: boolean }) {
  const breathe = useLoop(3200);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <View style={styles.flame}>
      <Animated.View style={[styles.flameGlow, { transform: [{ scale }] }]}>
        <Glow color={colors.streak} size={44} intensity={lit ? 0.7 : 0.45} />
      </Animated.View>
      <Icon name="flame" size={18} color={colors.streak} fill={lit ? colors.streak : 'none'} strokeWidth={1.8} />
    </View>
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
  skelEyebrow: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.xxl,
    alignItems: 'flex-start',
  },
  colMain: {
    flex: 1.1,
  },
  colSide: {
    flex: 1,
    paddingTop: spacing.xxl + spacing.lg,
  },
  cover: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  greeting: {
    marginTop: spacing.md,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  tipOrb: {
    width: 32,
    height: 32,
  },
  tipText: {
    flex: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flame: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroNumber: {
    ...t.hero,
    fontSize: 62,
    lineHeight: 66,
    color: colors.goldBright,
  },
  heroUnit: {
    ...font.serifItalic,
    fontSize: 20,
    color: colors.textSecondary,
  },
  best: {
    ...font.medium,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  bestNum: {
    ...font.bold,
    color: colors.text,
  },
  ringNum: {
    ...font.serif,
    fontSize: 25,
    lineHeight: 26,
    color: colors.text,
  },
  ringOf: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  ringLabel: {
    ...t.micro,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: 'rgba(5,6,11,0.25)',
  },
  heroNote: {
    ...font.semibold,
    flex: 1,
    fontSize: 13.5,
    color: colors.text,
  },
  tabs: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 68,
  },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  reminderWhen: {
    marginTop: 1,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
