import React from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../../app/hooks';
import { brand, colors, font, gradients, radius, spacing, type as t, withAlpha } from '../../../theme';
import { Glow, Gradient } from '../../../components/Gradient';
import { useLoop } from '../../../animations';
import { useLayout } from '../../../hooks/useLayout';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Medallion, SectionHeader } from '../../../components/Controls';
import { Heatmap, HeatmapLegend } from '../../../components/Heatmap';
import { AnimatedNumber, ProgressBar } from '../../../components/Progress';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { addDays, fromDateKey, MONTH_LONG, toDateKey } from '../../../utils/date';
import {
  useGetHistoryQuery,
  useGetStreakQuery,
  useGetTrackCompletionsQuery,
  type HistoryDay,
  type StreakSummary,
} from '../streaksApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Streak lengths worth marking along the way. */
const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

/**
 * The streak experience: the current streak as a cinematic hero with the
 * next milestone, the record, this week and this month, milestones,
 * streak protection, the long calendar and finished categories.
 */
export function ConsistencyScreen() {
  const navigation = useNavigation<Nav>();
  const streak = useGetStreakQuery();
  const today = streak.data?.today.date;
  const from = today ? toDateKey(addDays(fromDateKey(today), -181)) : undefined;
  const history = useGetHistoryQuery(today ? { from, to: today } : undefined, { skip: !today });
  const completions = useGetTrackCompletionsQuery();
  const warningsOn = useAppSelector(s => s.preferences.notifyStreakWarnings);
  const { columns } = useLayout();

  const s = streak.data;

  return (
    <Screen
      wide={columns > 1}
      onRefresh={() => {
        streak.refetch();
        history.refetch();
        completions.refetch();
      }}
      refreshing={streak.isFetching}
    >
      <ScreenHeader title="Your streak" subtitle="Consistency" />
      {streak.isError ? (
        <ErrorState message={getErrorMessage(streak.error)} onRetry={streak.refetch} />
      ) : !s ? (
        <>
          <Skeleton height={330} rounded={radius.xl} />
          <Skeleton height={96} rounded={radius.lg} style={styles.mtLg} />
        </>
      ) : (
        <>
          <FadeIn>
            <StreakHero s={s} />
          </FadeIn>

          <FadeIn index={1} style={styles.mtLg}>
            <Card padded={false}>
              <View style={styles.strip}>
                <Tile icon="trophy" label="Longest" value={s.best_streak} color={colors.goldBright} />
                <View style={styles.stripDivider} />
                <Tile icon="check-circle" label="Days kept" value={s.total_success_days} color={colors.success} />
                <View style={styles.stripDivider} />
                <Tile icon="x" label="Missed" value={s.total_failed_days} color={colors.danger} />
                <View style={styles.stripDivider} />
                <Tile icon="target" label="Consistency" value={Math.round(s.consistency_pct)} suffix="%" color={colors.azure} />
              </View>
            </Card>
          </FadeIn>

          <View style={columns > 1 ? styles.pair : null}>
            <View style={columns > 1 ? styles.pairItem : null}>
              <SectionHeader title="This week" />
              <WeekActivity days={history.data} today={s.today.date} />
            </View>
            <View style={columns > 1 ? styles.pairItem : null}>
              <SectionHeader title="This month" />
              <MonthActivity days={history.data} today={s.today.date} />
            </View>
          </View>

          <SectionHeader title="Milestones" />
          <Milestones best={s.best_streak} current={s.current_streak} />

          <View style={columns > 1 ? styles.pair : null}>
            <View style={columns > 1 ? styles.pairItem : null}>
              <SectionHeader title="Streak protection" action="Manage" onAction={() => navigation.navigate('Settings')} />
              <Card onPress={() => navigation.navigate('Settings')} accessibilityLabel={`Streak warnings are ${warningsOn ? 'on' : 'off'}. Manage in Settings.`}>
                <View style={styles.row}>
                  <Medallion icon="shield" size={48} color={warningsOn ? colors.success : colors.textTertiary} filled={warningsOn} />
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{!warningsOn ? 'Protection is off' : s.today.secured ? 'Today is safe' : 'Guarded tonight'}</Text>
                    <Text style={t.caption}>
                      {warningsOn
                        ? s.at_risk
                          ? `Your streak is at risk — we’ll remind you at 8 PM if ${s.today.remaining} ${s.today.remaining === 1 ? 'task is' : 'tasks are'} still open.`
                          : 'A gentle warning arrives at 8 PM whenever today’s tasks are still open.'
                        : 'Turn on streak warnings to get an 8 PM nudge before a day slips.'}
                    </Text>
                  </View>
                </View>
              </Card>
            </View>
          </View>

          <SectionHeader title="Six-month calendar" />
          <Card>
            {history.data ? (
              // Only the weeks scroll sideways; Monday to Sunday stay in place.
              <Heatmap days={history.data} cell={14} legend={false} scrollable />
            ) : (
              <Skeleton height={130} />
            )}
            <HeatmapLegend />
          </Card>

          {completions.data?.length ? <SectionHeader title="Finished plans" /> : null}
          {!completions.data?.length
            ? null
            : completions.data.map(c => (
                <Card key={c.id} style={styles.mbMd}>
                  <View style={styles.row}>
                    <Medallion icon={c.is_perfect ? 'trophy' : 'flag'} size={44} color={c.is_perfect ? colors.gold : colors.textSecondary} filled={c.is_perfect} />
                    <View style={styles.flex}>
                      <Text style={t.bodyStrong}>{c.track_name}</Text>
                      <Text style={t.caption}>
                        {c.duration_days} days · {c.completed_total}/{c.required_total} tasks done
                      </Text>
                    </View>
                    {c.bonus_points ? <Text style={styles.bonus}>+{c.bonus_points}</Text> : <Text style={t.caption}>{c.is_perfect ? 'Perfect' : 'Finished'}</Text>}
                  </View>
                </Card>
              ))}

          <Text style={styles.footnote}>Each plan you finish in a day adds 1 to your streak. Each plan you miss takes 1 away.</Text>
        </>
      )}
      {history.isError ? <ErrorState message={getErrorMessage(history.error)} onRetry={history.refetch} /> : null}
    </Screen>
  );
}

// ---- Hero -------------------------------------------------------------------------------

function StreakHero({ s }: { s: StreakSummary }) {
  const next = MILESTONES.find(m => m > s.current_streak) ?? null;
  const prev = [...MILESTONES].reverse().find(m => m <= s.current_streak) ?? 0;
  const toNext = next ? (s.current_streak - prev) / (next - prev) : 1;
  const statusText = s.today.secured
    ? 'Today is secured'
    : s.today.required
      ? `${s.today.remaining} ${s.today.remaining === 1 ? 'task' : 'tasks'} left today`
      : 'No tasks today';
  return (
    <Card tone="hero" contentStyle={styles.heroContent}>
      <Glow color={brand.ember} size={420} intensity={0.16} style={styles.heroGlow} />
      <StreakFlame lit={s.today.secured} />
      <AnimatedNumber value={s.current_streak} style={styles.big} />
      <Text style={styles.unit}>streak</Text>
      <View style={[styles.status, { borderColor: s.today.secured ? brand.jade : colors.heroLine }]}>
        <Icon name={s.today.secured ? 'check-circle' : 'clock'} size={13} color={s.today.secured ? brand.jade : brand.champagneLight} strokeWidth={2} />
        <Text style={[styles.statusText, { color: s.today.secured ? brand.jade : brand.champagneLight }]}>{statusText}</Text>
      </View>
      <View style={styles.nextWrap}>
        <View style={styles.nextHead}>
          <Text style={styles.nextLabel}>{next ? `Next milestone · ${next} days` : 'Every milestone reached'}</Text>
          {next ? <Text style={styles.nextLeft}>{next - s.current_streak} to go</Text> : null}
        </View>
        <ProgressBar progress={toNext} height={4} colorsPair={[brand.ember, brand.champagne]} style={styles.nextBar} />
      </View>
    </Card>
  );
}

/** The flame emblem: a champagne-rimmed medallion over a breathing ember glow. */
function StreakFlame({ lit }: { lit: boolean }) {
  const breathe = useLoop(3600);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.14] });
  const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  return (
    <View style={styles.flameWrap}>
      <Animated.View style={[styles.flameGlow, { opacity, transform: [{ scale }] }]}>
        <Glow color={brand.emberDeep} size={200} intensity={lit ? 0.6 : 0.34} />
      </Animated.View>
      <Gradient colors={gradients.gold} borderRadius={42} style={styles.flameRing}>
        <View style={styles.flameMedal}>
          <Icon name="flame" size={34} color={brand.ember} fill={lit ? brand.emberDeep : 'none'} strokeWidth={1.5} />
        </View>
      </Gradient>
    </View>
  );
}

function Tile({ icon, label, value, color, suffix }: { icon: 'trophy' | 'check-circle' | 'x' | 'target'; label: string; value: number; color: string; suffix?: string }) {
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={15} color={color} strokeWidth={1.8} />
      <AnimatedNumber value={value} suffix={suffix} style={styles.tileValue} />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

// ---- Week & month ----------------------------------------------------------------------------

const WEEK_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function statusColor(status: string) {
  return status === 'SUCCESS' ? colors.success : status === 'FAILED' ? colors.danger : status === 'PENDING' ? colors.gold : colors.surfaceHigh;
}

function WeekActivity({ days, today }: { days?: HistoryDay[]; today: string }) {
  if (!days) return <Skeleton height={150} rounded={radius.lg} />;
  const byDate = new Map(days.map(d => [d.date, d]));
  const base = fromDateKey(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(base, i - 6);
    return { date, day: byDate.get(toDateKey(date)) };
  });
  const kept = week.filter(w => w.day?.status === 'SUCCESS').length;
  return (
    <Card>
      <Text style={styles.cardTitle}>
        {kept}
        <Text style={styles.cardTitleOf}> of 7 days kept</Text>
      </Text>
      <View style={styles.weekRow}>
        {week.map(({ date, day }, i) => {
          const ratio = day && day.required > 0 ? Math.min(1, day.completed / day.required) : 0;
          return (
            <View key={i} style={styles.weekDay} accessible accessibilityLabel={`${toDateKey(date)}: ${day ? `${day.completed} of ${day.required}` : 'no data'}`}>
              <View style={styles.weekTrack}>
                <View style={[styles.weekFill, { height: `${Math.max(12, ratio * 100)}%`, backgroundColor: statusColor(day?.status ?? '') }]} />
              </View>
              <Text style={[styles.weekLabel, i === 6 && { color: colors.gold }]}>{WEEK_INITIAL[date.getDay()]}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function MonthActivity({ days, today }: { days?: HistoryDay[]; today: string }) {
  if (!days) return <Skeleton height={150} rounded={radius.lg} />;
  const t0 = fromDateKey(today);
  const prefix = today.slice(0, 7);
  const month = days.filter(d => d.date.startsWith(prefix));
  const kept = month.filter(d => d.status === 'SUCCESS').length;
  const missed = month.filter(d => d.status === 'FAILED').length;
  const tracked = kept + missed;
  return (
    <Card>
      <Text style={styles.cardTitle}>
        {MONTH_LONG[t0.getMonth()]}
        <Text style={styles.cardTitleOf}> · day {t0.getDate()}</Text>
      </Text>
      <View style={styles.monthStats}>
        <View style={styles.monthStat}>
          <Text style={[styles.monthNum, { color: colors.success }]}>{kept}</Text>
          <Text style={styles.tileLabel}>Kept</Text>
        </View>
        <View style={styles.monthStat}>
          <Text style={[styles.monthNum, { color: colors.danger }]}>{missed}</Text>
          <Text style={styles.tileLabel}>Missed</Text>
        </View>
        <View style={styles.monthStat}>
          <Text style={styles.monthNum}>{tracked ? Math.round((100 * kept) / tracked) : 0}%</Text>
          <Text style={styles.tileLabel}>Success</Text>
        </View>
      </View>
      <View style={styles.monthDots}>
        {month.map(d => (
          <View key={d.date} style={[styles.monthDot, { backgroundColor: statusColor(d.status) }]} />
        ))}
      </View>
    </Card>
  );
}

// ---- Milestones -------------------------------------------------------------------------------

function Milestones({ best, current }: { best: number; current: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.milestones}>
      {MILESTONES.map(m => {
        const reached = best >= m;
        const live = current >= m;
        return (
          <View key={m} style={styles.milestone} accessible accessibilityLabel={`${m} day milestone, ${reached ? 'reached' : 'not yet reached'}`}>
            {reached ? (
              <Gradient colors={gradients.gold} borderRadius={34} style={styles.milestoneRing}>
                <View style={styles.milestoneInner}>
                  {live ? <Glow color={brand.champagne} size={68} intensity={0.35} style={styles.milestoneGlow} /> : null}
                  <Text style={styles.milestoneNum}>{m}</Text>
                </View>
              </Gradient>
            ) : (
              <View style={[styles.milestoneRing, styles.milestoneLocked]}>
                <Text style={[styles.milestoneNum, styles.milestoneNumLocked]}>{m}</Text>
              </View>
            )}
            <Text style={[styles.milestoneLabel, reached && { color: colors.gold }]}>{reached ? 'Reached' : 'days'}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  mbMd: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  pair: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  pairItem: {
    flex: 1,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  heroGlow: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
  },
  flameWrap: {
    width: 200,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
  },
  flameRing: {
    width: 84,
    height: 84,
    padding: 1.5,
  },
  flameMedal: {
    flex: 1,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.midnight,
  },
  big: {
    ...t.hero,
    fontSize: 104,
    lineHeight: 108,
    color: brand.champagneLight,
    marginTop: spacing.sm,
  },
  unit: {
    ...font.serifItalic,
    fontSize: 22,
    color: colors.heroTextSecondary,
    marginTop: -spacing.xs,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusText: {
    ...font.bold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  nextWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.heroLine,
  },
  nextHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  nextLabel: {
    ...font.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: brand.champagne,
  },
  nextLeft: {
    ...font.serifItalic,
    fontSize: 16,
    color: colors.heroTextSecondary,
  },
  nextBar: {
    marginTop: spacing.md,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.lg,
  },
  stripDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tileValue: {
    ...font.serif,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
  },
  tileLabel: {
    ...t.caption,
    fontSize: 11.5,
  },
  cardTitle: {
    ...font.serif,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
  },
  cardTitleOf: {
    ...font.serifItalic,
    fontSize: 17,
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekTrack: {
    width: 12,
    height: 64,
    borderRadius: 6,
    backgroundColor: withAlpha(colors.gold, 0.08),
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekFill: {
    width: '100%',
    borderRadius: 6,
  },
  weekLabel: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  monthStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  monthStat: {
    flex: 1,
  },
  monthNum: {
    ...font.serif,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
  },
  monthDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: spacing.lg,
  },
  monthDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  milestones: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  milestone: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  milestoneRing: {
    width: 68,
    height: 68,
    padding: 1.5,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.midnight,
    overflow: 'hidden',
  },
  milestoneGlow: {
    position: 'absolute',
  },
  milestoneLocked: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  milestoneNum: {
    ...font.serif,
    fontSize: 24,
    lineHeight: 28,
    color: brand.champagneLight,
  },
  milestoneNumLocked: {
    color: colors.textTertiary,
  },
  milestoneLabel: {
    ...font.bold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  bonus: {
    ...font.serif,
    color: colors.goldBright,
    fontSize: 22,
  },
  footnote: {
    ...t.aside,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
