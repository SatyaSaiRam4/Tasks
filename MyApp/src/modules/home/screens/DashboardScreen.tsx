import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { brand, colors, font, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { Medallion, SectionHeader } from '../../../components/Controls';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Glow } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { AnimatedNumber, ProgressBar, ProgressRing } from '../../../components/Progress';
import { Eyebrow, TopBar } from '../../../components/ScreenHeader';
import { useLayout } from '../../../hooks/useLayout';
import { useLoop } from '../../../animations';
import { useCelebration } from '../../../components/Celebration';
import { getErrorMessage } from '../../../utils/apiError';
import { addDays, formatClock, formatDateTime, fromDateKey, toDateKey, WEEKDAY_LONG, MONTH_LONG } from '../../../utils/date';
import { useGetDashboardQuery, useGetHistoryQuery, useGetTrackCompletionsQuery, type Dashboard, type HistoryDay } from '../../streaks/streaksApi';
import { useListTracksQuery } from '../../routines/routinesApi';
import { categoryColor, Monogram } from '../../routines/components';
import { greeting, satyaMessage } from '../../satya/messages';
import type { MainTabParamList, RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
const SEEN_COMPLETIONS_KEY = '@rememberly/seen_track_completions';

/**
 * Home: an editorial overview of the day — greeting, the streak and today's
 * progress, where to continue, Satya's note, today's goals, the week so far
 * and upcoming reminders. Every block leads into the screen that owns it.
 */
export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const tracks = useListTracksQuery();
  const completions = useGetTrackCompletionsQuery();
  const today = data?.streak.today.date;
  const week = useGetHistoryQuery(today ? { from: toDateKey(addDays(fromDateKey(today), -6)), to: today } : undefined, { skip: !today });
  const { celebrate } = useCelebration();
  const celebrated = useRef(false);
  const { columns } = useLayout();
  const twoColumn = columns > 1;

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
      <Screen wide>
        <TopBar />
        <Skeleton width="45%" height={14} style={styles.skelEyebrow} />
        <Skeleton width="80%" height={40} style={styles.skelTitle} />
        <Skeleton height={260} rounded={radius.xl} />
        <Skeleton height={110} rounded={radius.lg} style={styles.skelGap} />
        <Skeleton height={110} rounded={radius.lg} style={styles.skelGap} />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen wide>
        <TopBar />
        <ErrorState message={getErrorMessage(error, 'Could not load your home screen.')} onRetry={refetch} />
      </Screen>
    );
  }

  const openCategory = (trackId: string) => navigation.navigate('TrackDetail', { trackId });

  const primary = (
    <>
      <FadeIn index={1}>
        <StreakHero data={data} onPress={() => navigation.navigate('Consistency')} />
      </FadeIn>
      <FadeIn index={2}>
        <ContinueCard data={data} onOpen={openCategory} onCategories={() => navigation.navigate('RoutinesTab')} />
      </FadeIn>
      <GoalsSection data={data} onOpen={openCategory} onAll={() => navigation.navigate('RoutinesTab')} />
    </>
  );

  const secondary = (
    <>
      {data.satya_enabled ? (
        <FadeIn index={3} style={twoColumn ? null : styles.mtLg}>
          <InsightCard text={satyaMessage(data)} />
        </FadeIn>
      ) : null}
      <SectionHeader title="This week" action="History" onAction={() => navigation.navigate('Consistency')} style={twoColumn && !data.satya_enabled ? styles.firstSection : undefined} />
      <FadeIn index={4}>
        <WeekCard days={week.data} today={data.streak.today.date} loading={week.isLoading} onPress={() => navigation.navigate('Consistency')} />
      </FadeIn>
      <SectionHeader title="Upcoming reminders" action="All" onAction={() => navigation.navigate('RemindersTab')} />
      <FadeIn index={5}>
        <RemindersCard
          data={data}
          onOpen={id => navigation.navigate('ReminderEditor', { reminderId: id })}
          onAll={() => navigation.navigate('RemindersTab')}
        />
      </FadeIn>
    </>
  );

  return (
    <Screen
      wide
      onRefresh={() => {
        refetch();
        tracks.refetch();
        week.refetch();
      }}
      refreshing={isFetching && !isLoading}
    >
      <TopBar />
      <FadeIn style={styles.greeting}>
        <Eyebrow label={longDate(data.streak.today.date)} />
        <Text style={[t.display, styles.greetingTitle]} accessibilityRole="header">
          {greeting(data)}
        </Text>
        <Text style={styles.greetingAside}>{dayLine(data)}</Text>
      </FadeIn>

      {twoColumn ? (
        <View style={styles.columns}>
          <View style={styles.mainCol}>{primary}</View>
          <View style={styles.sideCol}>{secondary}</View>
        </View>
      ) : (
        <>
          {primary}
          {secondary}
        </>
      )}
    </Screen>
  );
}

function longDate(key: string) {
  const d = fromDateKey(key);
  return `${WEEKDAY_LONG[d.getDay()]} · ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
}

function dayLine(d: Dashboard) {
  const { today } = d.streak;
  if (d.total_tracks === 0) return 'A quiet beginning. Let’s set your first goal.';
  if (today.required === 0) return 'Nothing is due today. A day to rest well.';
  if (today.secured) return 'Every task is done. Beautifully kept.';
  return `${today.completed} of ${today.required} tasks complete today.`;
}

// ---- Streak hero --------------------------------------------------------------------

function StreakHero({ data, onPress }: { data: Dashboard; onPress: () => void }) {
  const { streak } = data;
  const { today } = streak;
  const progress = today.required > 0 ? today.completed / today.required : today.secured ? 1 : 0;
  const status = today.secured
    ? { text: 'Today secured', color: brand.jade, icon: 'check-circle' as const }
    : today.required === 0
      ? { text: 'Rest day', color: colors.heroTextSecondary, icon: 'sun' as const }
      : streak.at_risk
        ? { text: `${today.remaining} left to keep it`, color: brand.ember, icon: 'flame' as const }
        : { text: `${today.remaining} left today`, color: brand.champagneLight, icon: 'clock' as const };

  return (
    <Card tone="hero" onPress={onPress} contentStyle={styles.heroContent} accessibilityLabel={`${streak.current_streak} day streak. ${status.text}. Open streak history.`}>
      <Glow color={brand.champagne} size={360} intensity={0.14} style={styles.heroGlow} />
      <View style={styles.heroTop}>
        <View style={styles.flex}>
          <Eyebrow label="Current streak" color={brand.champagne} />
          <View style={styles.heroNumberRow}>
            <AnimatedNumber value={streak.current_streak} style={styles.heroNumber} />
            <Text style={styles.heroUnit}>{streak.current_streak === 1 ? 'day' : 'days'}</Text>
          </View>
          <View style={[styles.heroStatus, { borderColor: status.color }]}>
            <Icon name={status.icon} size={13} color={status.color} strokeWidth={2} />
            <Text style={[styles.heroStatusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>
        <ProgressRing progress={progress} size={118} stroke={7} colorsPair={gradients.gold} trackColor="rgba(239,233,220,0.08)">
          <FlameMark lit={today.secured} />
          <Text style={styles.ringValue}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.ringLabel}>Today</Text>
        </ProgressRing>
      </View>
      <View style={styles.heroDivider} />
      <View style={styles.heroStats}>
        <HeroStat label="Best streak" value={streak.best_streak} />
        <View style={styles.heroStatRule} />
        <HeroStat label="Days kept" value={streak.total_success_days} />
        <View style={styles.heroStatRule} />
        <HeroStat label="Consistency" value={Math.round(streak.consistency_pct)} suffix="%" />
      </View>
    </Card>
  );
}

function HeroStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <View style={styles.heroStat}>
      <AnimatedNumber value={value} suffix={suffix} style={styles.heroStatValue} />
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

/** The streak flame with a slow breathing halo; brighter once today is secured. */
function FlameMark({ lit }: { lit: boolean }) {
  const breathe = useLoop(3200);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <View style={styles.flame}>
      <Animated.View style={[styles.flameGlow, { transform: [{ scale }] }]}>
        <Glow color={brand.ember} size={46} intensity={lit ? 0.75 : 0.45} />
      </Animated.View>
      <Icon name="flame" size={17} color={brand.ember} fill={lit ? brand.emberDeep : 'none'} strokeWidth={1.8} />
    </View>
  );
}

// ---- Continue ------------------------------------------------------------------------

function ContinueCard({ data, onOpen, onCategories }: { data: Dashboard; onOpen: (id: string) => void; onCategories: () => void }) {
  const groups = data.agenda.groups;
  const next = groups.find(g => g.required > g.completed);

  if (data.total_tracks === 0 || !groups.length) {
    return (
      <Card onPress={onCategories} style={styles.mtLg} accessibilityLabel="Open categories">
        <View style={styles.continueRow}>
          <Medallion icon="target" size={48} />
          <View style={styles.flex}>
            <Text style={t.micro}>{data.total_tracks === 0 ? 'Begin' : 'Today'}</Text>
            <Text style={styles.continueTitle}>{data.total_tracks === 0 ? 'Create your first category' : 'No tasks due today'}</Text>
            <Text style={t.caption}>{data.total_tracks === 0 ? 'Goals like Gym or Study, with daily tasks.' : 'Your categories are resting today.'}</Text>
          </View>
          <Icon name="arrow-right" size={18} color={colors.gold} />
        </View>
      </Card>
    );
  }

  if (!next) {
    return (
      <Card style={styles.mtLg} accessibilityLabel="All of today's tasks are done">
        <View style={styles.continueRow}>
          <Medallion icon="check-circle" size={48} color={colors.success} filled />
          <View style={styles.flex}>
            <Text style={[t.micro, { color: colors.success }]}>Complete</Text>
            <Text style={styles.continueTitle}>Every goal kept today</Text>
            <Text style={t.caption}>Come back tomorrow to extend your streak.</Text>
          </View>
        </View>
      </Card>
    );
  }

  const color = categoryColor(next.track.name, next.track.color);
  const pct = next.required ? next.completed / next.required : 0;
  return (
    <Card onPress={() => onOpen(next.track.id)} style={styles.mtLg} accessibilityLabel={`Continue ${next.track.name}`}>
      <View style={styles.continueRow}>
        <Monogram name={next.track.name} color={color} size={52} />
        <View style={styles.flex}>
          <Text style={t.micro}>Continue</Text>
          <Text style={styles.continueTitle} numberOfLines={1}>
            {next.track.name}
          </Text>
          <Text style={t.caption}>
            {next.required - next.completed} of {next.required} tasks still open
          </Text>
        </View>
        <View style={styles.continueGo}>
          <Icon name="arrow-right" size={18} color={colors.onPrimary} strokeWidth={2} />
        </View>
      </View>
      <ProgressBar progress={pct} height={4} colorsPair={gradients.gold} style={styles.continueBar} />
    </Card>
  );
}

// ---- Goals -----------------------------------------------------------------------------

function GoalsSection({ data, onOpen, onAll }: { data: Dashboard; onOpen: (id: string) => void; onAll: () => void }) {
  const groups = data.agenda.groups;
  if (!groups.length) return null;
  return (
    <>
      <SectionHeader title="Today’s goals" action="All categories" onAction={onAll} />
      <Card padded={false}>
        {groups.map((g, i) => {
          const color = categoryColor(g.track.name, g.track.color);
          const done = g.required > 0 && g.completed >= g.required;
          return (
            <Pressable
              key={g.track.id}
              onPress={() => onOpen(g.track.id)}
              accessibilityRole="button"
              accessibilityLabel={`${g.track.name}, ${g.completed} of ${g.required} done`}
              style={({ pressed }) => [styles.goalRow, i < groups.length - 1 && styles.goalDivider, pressed && styles.pressed]}
            >
              <Monogram name={g.track.name} color={color} size={40} done={done} />
              <View style={styles.flex}>
                <View style={styles.goalTop}>
                  <Text style={styles.goalName} numberOfLines={1}>
                    {g.track.name}
                  </Text>
                  <Text style={[styles.goalCount, done && { color: colors.success }]}>
                    {g.completed}
                    <Text style={styles.goalOf}>/{g.required}</Text>
                  </Text>
                </View>
                <ProgressBar
                  progress={g.required ? g.completed / g.required : 0}
                  height={3}
                  colorsPair={done ? gradients.success : [color, color]}
                  style={styles.goalBar}
                />
              </View>
            </Pressable>
          );
        })}
      </Card>
    </>
  );
}

// ---- Insight ---------------------------------------------------------------------------

function InsightCard({ text }: { text: string }) {
  return (
    <Card tone="glass" contentStyle={styles.insight}>
      <Medallion icon="sparkles" size={42} color={colors.violet} />
      <View style={styles.flex}>
        <Text style={[t.micro, { color: colors.violet }]}>Satya’s note</Text>
        <Text style={styles.insightText}>{text}</Text>
      </View>
    </Card>
  );
}

// ---- Week ------------------------------------------------------------------------------

const WEEK_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function WeekCard({ days, today, loading, onPress }: { days?: HistoryDay[]; today: string; loading: boolean; onPress: () => void }) {
  if (loading && !days) return <Skeleton height={124} rounded={radius.lg} />;
  const byDate = new Map((days ?? []).map(d => [d.date, d]));
  const base = fromDateKey(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(base, i - 6);
    return { date, day: byDate.get(toDateKey(date)) };
  });
  const kept = week.filter(w => w.day?.status === 'SUCCESS').length;
  return (
    <Card onPress={onPress} accessibilityLabel={`${kept} of the last 7 days kept. Open streak history.`}>
      <View style={styles.weekHead}>
        <Text style={styles.weekKept}>
          {kept}
          <Text style={styles.weekOf}> / 7 days kept</Text>
        </Text>
        <Icon name="arrow-right" size={16} color={colors.textTertiary} />
      </View>
      <View style={styles.weekRow}>
        {week.map(({ date, day }, i) => {
          const status = day?.status ?? 'UNTRACKED';
          const isToday = i === 6;
          const fill =
            status === 'SUCCESS'
              ? colors.success
              : status === 'FAILED'
                ? colors.danger
                : status === 'PENDING'
                  ? colors.gold
                  : 'transparent';
          const h = day && day.required > 0 ? 14 + 30 * Math.min(1, day.completed / day.required) : 10;
          return (
            <View key={i} style={styles.weekDay}>
              <View style={styles.weekBarTrack}>
                <View style={[styles.weekBar, { height: h, backgroundColor: fill === 'transparent' ? colors.surfaceHigh : fill }]} />
              </View>
              <Text style={[styles.weekLabel, isToday && styles.weekLabelToday]}>{WEEK_INITIAL[date.getDay()]}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ---- Reminders ---------------------------------------------------------------------------

function RemindersCard({ data, onOpen, onAll }: { data: Dashboard; onOpen: (id: string) => void; onAll: () => void }) {
  const upcoming = data.upcoming_reminders.slice(0, 3);
  if (!upcoming.length) {
    return (
      <Card onPress={onAll} accessibilityLabel="Open reminders">
        <View style={styles.continueRow}>
          <Medallion icon="bell" size={42} color={colors.azure} />
          <View style={styles.flex}>
            <Text style={t.bodyStrong}>Nothing scheduled</Text>
            <Text style={t.caption}>Add a reminder for anything worth remembering.</Text>
          </View>
          <Icon name="arrow-right" size={16} color={colors.textTertiary} />
        </View>
      </Card>
    );
  }
  return (
    <Card padded={false}>
      {upcoming.map((r, i) => {
        const [clock, meridiem] = formatClock(r.remind_at).split(' ');
        return (
          <Pressable
            key={r.id}
            onPress={() => onOpen(r.id)}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}, ${formatDateTime(r.remind_at)}`}
            style={({ pressed }) => [styles.reminderRow, i < upcoming.length - 1 && styles.goalDivider, pressed && styles.pressed]}
          >
            <View style={styles.reminderTime}>
              <Text style={styles.reminderClock}>{clock}</Text>
              {meridiem ? <Text style={styles.reminderMeridiem}>{meridiem}</Text> : null}
            </View>
            <View style={styles.reminderThread} />
            <View style={styles.flex}>
              <Text style={t.bodyStrong} numberOfLines={1}>
                {r.title}
              </Text>
              <Text style={t.caption} numberOfLines={1}>
                {formatDateTime(r.remind_at).split(',')[0]}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {data.reminder_count > upcoming.length ? (
        <Pressable onPress={onAll} accessibilityRole="button" style={styles.moreRow}>
          <Text style={styles.moreText}>{data.reminder_count - upcoming.length} more scheduled</Text>
          <Icon name="arrow-right" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.65,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  firstSection: {
    marginTop: 0,
  },
  skelEyebrow: {
    marginTop: spacing.xxl,
  },
  skelTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  skelGap: {
    marginTop: spacing.lg,
  },
  greeting: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  greetingTitle: {
    marginTop: spacing.md,
  },
  greetingAside: {
    ...t.aside,
    marginTop: spacing.xs,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.xxl,
    alignItems: 'flex-start',
  },
  mainCol: {
    flex: 1.55,
  },
  sideCol: {
    flex: 1,
  },
  heroContent: {
    padding: spacing.xxl,
  },
  heroGlow: {
    position: 'absolute',
    top: -170,
    right: -150,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroNumber: {
    ...t.hero,
    fontSize: 80,
    lineHeight: 84,
    color: brand.champagneLight,
  },
  heroUnit: {
    ...font.serifItalic,
    fontSize: 22,
    color: colors.heroTextSecondary,
  },
  heroStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroStatusText: {
    ...font.bold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  ringValue: {
    ...font.serif,
    fontSize: 22,
    lineHeight: 24,
    color: colors.heroText,
  },
  ringLabel: {
    ...font.bold,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.heroTextTertiary,
  },
  flame: {
    width: 26,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.heroLine,
    marginVertical: spacing.xl,
  },
  heroStats: {
    flexDirection: 'row',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.heroLine,
  },
  heroStatValue: {
    ...font.serif,
    fontSize: 26,
    lineHeight: 30,
    color: colors.heroText,
  },
  heroStatLabel: {
    ...font.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  continueTitle: {
    ...t.heading,
    fontSize: 22,
    lineHeight: 26,
    marginTop: 3,
    marginBottom: 2,
  },
  continueGo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFill,
  },
  continueBar: {
    marginTop: spacing.lg,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.lg,
  },
  goalDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  goalTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalName: {
    ...t.bodyStrong,
    flex: 1,
  },
  goalCount: {
    ...font.serif,
    fontSize: 19,
    color: colors.goldBright,
  },
  goalOf: {
    fontSize: 15,
    color: colors.textTertiary,
  },
  goalBar: {
    marginTop: spacing.sm,
  },
  insight: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  insightText: {
    ...t.aside,
    color: colors.text,
    marginTop: spacing.xs,
  },
  weekHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  weekKept: {
    ...font.serif,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
  },
  weekOf: {
    ...font.serifItalic,
    fontSize: 17,
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  weekBarTrack: {
    height: 46,
    justifyContent: 'flex-end',
  },
  weekBar: {
    width: 10,
    borderRadius: 5,
  },
  weekLabel: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  weekLabelToday: {
    color: colors.gold,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.md + 2,
  },
  reminderTime: {
    width: 54,
    alignItems: 'flex-end',
  },
  reminderClock: {
    ...font.serif,
    fontSize: 20,
    lineHeight: 22,
    color: colors.text,
  },
  reminderMeridiem: {
    ...font.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textTertiary,
  },
  reminderThread: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.goldLine,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  moreText: {
    ...font.bold,
    fontSize: 12.5,
    color: colors.primary,
    letterSpacing: 0.4,
  },
});
