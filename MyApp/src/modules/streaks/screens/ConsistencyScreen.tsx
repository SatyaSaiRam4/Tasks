import React, { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { SectionHeader } from '../../../components/Controls';
import { Heatmap, HeatmapLegend } from '../../../components/Heatmap';
import { AnimatedNumber } from '../../../components/Progress';
import { EmptyState, ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { addDays, formatDayMonth, fromDateKey, toDateKey } from '../../../utils/date';
import { useGetHistoryQuery, useGetStreakQuery, useGetTrackCompletionsQuery } from '../streaksApi';

export function ConsistencyScreen() {
  const streak = useGetStreakQuery();
  const today = streak.data?.today.date;
  const from = today ? toDateKey(addDays(fromDateKey(today), -181)) : undefined;
  const history = useGetHistoryQuery(today ? { from, to: today } : undefined, { skip: !today });
  const completions = useGetTrackCompletionsQuery();
  const heatmapScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const stats = useMemo(() => {
    const days = history.data ?? [];
    const judged = days.filter(d => d.status === 'SUCCESS' || d.status === 'FAILED');
    const last30 = judged.slice(-30);
    return {
      month: last30.length ? Math.round((100 * last30.filter(d => d.status === 'SUCCESS').length) / last30.length) : 0,
      week: judged.slice(-7).filter(d => d.status === 'SUCCESS').length,
    };
  }, [history.data]);

  const s = streak.data;
  return (
    <Screen onRefresh={() => { streak.refetch(); history.refetch(); completions.refetch(); }} refreshing={streak.isFetching}>
      <ScreenHeader title="Consistency" />
      {streak.isError ? (
        <ErrorState message={getErrorMessage(streak.error)} onRetry={streak.refetch} />
      ) : !s ? (
        <Skeleton height={160} rounded={radius.xl} />
      ) : (
        <>
          <FadeIn>
            <Card gradient={gradients.streak} gradientOpacity={[0.26, 0.06]}>
              <View style={styles.heroRow}>
                <View style={styles.flex}>
                  <Text style={t.micro}>Current streak</Text>
                  <View style={styles.bigRow}>
                    <Icon name="flame" size={30} color={colors.streak} fill={s.today.secured ? colors.streak : 'none'} />
                    <AnimatedNumber value={s.current_streak} style={styles.big} />
                  </View>
                  <Text style={t.caption}>{s.today.secured ? 'Today is secured.' : s.today.required ? `${s.today.remaining} left to secure today` : 'Rest day today'}</Text>
                </View>
                <View style={styles.best}>
                  <Icon name="trophy" size={20} color={colors.streakGold} />
                  <Text style={t.heading}>{s.best_streak}</Text>
                  <Text style={t.caption}>Best</Text>
                </View>
              </View>
            </Card>
          </FadeIn>

          <FadeIn index={1} style={styles.grid}>
            <Tile label="Successful days" value={s.total_success_days} color={colors.success} />
            <Tile label="Missed days" value={s.total_failed_days} color={colors.danger} />
            <Tile label="Consistency" value={Math.round(s.consistency_pct)} suffix="%" color={colors.primary} />
            <Tile label="Last 30 days" value={stats.month} suffix="%" color={colors.info} />
            <Tile label="This week" value={stats.week} suffix="/7" color={colors.streak} />
            <Tile label="Bonus points" value={s.bonus_points} color={colors.streakGold} />
          </FadeIn>

          <SectionHeader title="Last 6 months" />
          <Card>
            {history.data ? (
              <ScrollView
                ref={heatmapScroll}
                horizontal
                showsHorizontalScrollIndicator={false}
                // Start at the newest weeks (today) once the calendar is measured.
                onContentSizeChange={() => heatmapScroll.current?.scrollToEnd({ animated: false })}
              >
                <Heatmap days={history.data} cell={14} legend={false} />
              </ScrollView>
            ) : (
              <Skeleton height={130} />
            )}
            <HeatmapLegend />
            <Text style={[t.caption, styles.mtMd]}>Tracking since {formatDayMonth(s.tracking_started_on)}.</Text>
          </Card>

          <SectionHeader title="Completed tracks" />
          {!completions.data?.length ? (
            <Card>
              <EmptyState compact icon="trophy" title="No finished Tracks yet" message="When a dated Track ends, it's scored here. Perfect Tracks earn a bonus that grows with their length." />
            </Card>
          ) : (
            completions.data.map(c => (
              <Card key={c.id} style={styles.mbMd}>
                <View style={styles.compRow}>
                  <View style={[styles.compIcon, { backgroundColor: c.is_perfect ? colors.streakSoft : colors.surfaceAlt }]}>
                    <Icon name={c.is_perfect ? 'trophy' : 'flag'} size={20} color={c.is_perfect ? colors.streakGold : colors.textSecondary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={t.bodyStrong}>{c.track_name}</Text>
                    <Text style={t.caption}>
                      {c.duration_days} days · {c.completed_total}/{c.required_total} actions
                    </Text>
                  </View>
                  {c.bonus_points ? <Text style={styles.bonus}>+{c.bonus_points}</Text> : <Text style={t.caption}>{c.is_perfect ? 'Perfect' : 'Finished'}</Text>}
                </View>
              </Card>
            ))
          )}

          <SectionHeader title="How streaks work" />
          <Card>
            {[
              ['check-circle', 'A day counts when every required action due that day is confirmed.'],
              ['zap', 'Optional actions and rest days never break your streak.'],
              ['lock', 'Past days are locked, so a streak can only be earned on the day.'],
              ['trophy', 'Finish a dated Track perfectly to earn a bonus that grows with its length.'],
            ].map(([icon, text]) => (
              <View key={text} style={styles.rule}>
                <Icon name={icon as never} size={18} color={colors.primary} />
                <Text style={[t.body, styles.flex, { color: colors.textSecondary }]}>{text}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
      {history.isError ? <ErrorState message={getErrorMessage(history.error)} onRetry={history.refetch} /> : null}
    </Screen>
  );
}

function Tile({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <Card style={styles.tile} contentStyle={styles.tileContent}>
      <AnimatedNumber value={value} suffix={suffix} style={[styles.tileValue, { color }]} />
      <Text style={t.caption}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mtMd: {
    marginTop: spacing.md,
  },
  mbMd: {
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  big: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1.5,
  },
  best: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  tile: {
    width: '30.5%',
    flexGrow: 1,
  },
  tileContent: {
    padding: spacing.md,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonus: {
    color: colors.streakGold,
    fontWeight: '800',
    fontSize: 16,
  },
  rule: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
});
