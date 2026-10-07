import React, { useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing, type as t } from '../../../theme';
import { Glow } from '../../../components/Gradient';
import { useLoop } from '../../../animations';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { SectionHeader } from '../../../components/Controls';
import { Heatmap, HeatmapLegend } from '../../../components/Heatmap';
import { AnimatedNumber } from '../../../components/Progress';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { addDays, fromDateKey, toDateKey } from '../../../utils/date';
import { useGetHistoryQuery, useGetStreakQuery, useGetTrackCompletionsQuery } from '../streaksApi';

export function ConsistencyScreen() {
  const streak = useGetStreakQuery();
  const today = streak.data?.today.date;
  const from = today ? toDateKey(addDays(fromDateKey(today), -181)) : undefined;
  const history = useGetHistoryQuery(today ? { from, to: today } : undefined, { skip: !today });
  const completions = useGetTrackCompletionsQuery();
  const heatmapScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const s = streak.data;
  return (
    <Screen onRefresh={() => { streak.refetch(); history.refetch(); completions.refetch(); }} refreshing={streak.isFetching}>
      <ScreenHeader title="Streak history" />
      {streak.isError ? (
        <ErrorState message={getErrorMessage(streak.error)} onRetry={streak.refetch} />
      ) : !s ? (
        <Skeleton height={160} rounded={radius.xl} />
      ) : (
        <>
          <FadeIn style={styles.hero}>
            <StreakFlame lit={s.today.secured} />
            <AnimatedNumber value={s.current_streak} style={styles.big} />
            <Text style={styles.unit}>day streak</Text>
            <Text style={[styles.status, s.today.secured && { color: colors.success }]}>
              {s.today.secured ? 'Today is done ✓' : s.today.required ? `${s.today.remaining} left today` : 'No tasks today'}
            </Text>
          </FadeIn>

          <FadeIn index={1}>
            <Card padded={false}>
              <View style={styles.strip}>
                <Tile icon="trophy" label="Best" value={s.best_streak} color={colors.goldBright} />
                <View style={styles.stripDivider} />
                <Tile icon="check-circle" label="Days done" value={s.total_success_days} color={colors.success} />
                <View style={styles.stripDivider} />
                <Tile icon="x" label="Days missed" value={s.total_failed_days} color={colors.danger} />
              </View>
            </Card>
          </FadeIn>

          <SectionHeader title="Calendar" />
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
          </Card>

          {completions.data?.length ? <SectionHeader title="Finished categories" /> : null}
          {!completions.data?.length ? null : (
            completions.data.map(c => (
              <Card key={c.id} style={styles.mbMd}>
                <View style={styles.compRow}>
                  <View style={[styles.compIcon, c.is_perfect && styles.compIconPerfect]}>
                    <Icon name={c.is_perfect ? 'trophy' : 'flag'} size={19} color={c.is_perfect ? colors.goldBright : colors.textSecondary} strokeWidth={1.7} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={t.bodyStrong}>{c.track_name}</Text>
                    <Text style={t.caption}>
                      {c.duration_days} days · {c.completed_total}/{c.required_total} tasks done
                    </Text>
                  </View>
                  {c.bonus_points ? <Text style={styles.bonus}>+{c.bonus_points}</Text> : <Text style={t.caption}>{c.is_perfect ? 'Perfect' : 'Finished'}</Text>}
                </View>
              </Card>
            ))
          )}

          <Text style={styles.footnote}>Tick all of a day’s tasks to keep your streak going.</Text>
        </>
      )}
      {history.isError ? <ErrorState message={getErrorMessage(history.error)} onRetry={history.refetch} /> : null}
    </Screen>
  );
}

function Tile({ icon, label, value, color }: { icon: 'trophy' | 'check-circle' | 'x'; label: string; value: number; color: string }) {
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={15} color={color} strokeWidth={1.8} />
      <AnimatedNumber value={value} style={styles.tileValue} />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

/** The flame emblem: a gold-ringed medallion over a breathing ember glow. */
function StreakFlame({ lit }: { lit: boolean }) {
  const breathe = useLoop(3600);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  return (
    <View style={styles.flameWrap}>
      <Animated.View style={[styles.flameGlow, { opacity, transform: [{ scale }] }]}>
        <Glow color={colors.streak} size={200} intensity={lit ? 0.55 : 0.32} />
      </Animated.View>
      <View style={styles.flameMedal}>
        <Icon name="flame" size={34} color={colors.streakGold} fill={lit ? colors.streak : 'none'} strokeWidth={1.6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mbMd: {
    marginBottom: spacing.md,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  flameWrap: {
    width: 200,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
  },
  flameMedal: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,13,24,0.8)',
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  big: {
    ...t.hero,
    fontSize: 92,
    lineHeight: 95,
    color: colors.goldBright,
    marginTop: spacing.sm,
  },
  unit: {
    ...font.serifItalic,
    fontSize: 20,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  status: {
    ...t.micro,
    marginTop: spacing.lg,
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
    gap: 2,
  },
  tileValue: {
    ...font.serif,
    fontSize: 26,
    lineHeight: 31,
    color: colors.text,
  },
  tileLabel: {
    ...t.caption,
    fontSize: 12,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  compIconPerfect: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldLine,
  },
  bonus: {
    ...font.serif,
    color: colors.goldBright,
    fontSize: 20,
  },
  footnote: {
    ...t.aside,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
