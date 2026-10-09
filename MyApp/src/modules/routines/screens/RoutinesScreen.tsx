import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../../components/Screen';
import { TopBar } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Fab } from '../../../components/Controls';
import { ProgressRing } from '../../../components/Progress';
import { ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { getErrorMessage } from '../../../utils/apiError';
import { useLayout } from '../../../hooks/useLayout';
import { colors, font, gradients, spacing, type as t } from '../../../theme';
import { useListTracksQuery, type Track } from '../routinesApi';
import { CategoryCard, HowItWorks } from '../components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Active plans first, then upcoming, then finished. */
const ORDER: Record<Track['status'], number> = { ACTIVE: 0, UPCOMING: 1, ENDED: 2, ARCHIVED: 3 };

/**
 * The Plans tab: today's progress across every plan, then one list of plans
 * (each card says if it is running, starting soon or finished). New users
 * see how plans work first.
 */
export function RoutinesScreen() {
  const navigation = useNavigation<Nav>();
  const tracks = useListTracksQuery();
  const newPlan = () => navigation.navigate('TrackEditor');
  const { columns, wideWidth } = useLayout();
  const cell = columns > 1 ? { width: (wideWidth - (columns - 1) * spacing.lg) / columns } : null;
  const plans = [...(tracks.data ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return (
    <Screen
      wide
      onRefresh={tracks.refetch}
      refreshing={tracks.isFetching}
      footer={plans.length ? <Fab accessibilityLabel="New plan" onPress={newPlan} /> : null}
    >
      <TopBar />
      {tracks.isLoading ? (
        <SkeletonList count={3} height={96} />
      ) : tracks.isError ? (
        <ErrorState message={getErrorMessage(tracks.error, 'Could not load your plans.')} onRetry={tracks.refetch} />
      ) : !plans.length ? (
        <FadeIn>
          <HowItWorks />
          <Button label="Create your first plan" icon="plus" size="lg" onPress={newPlan} style={styles.start} />
        </FadeIn>
      ) : (
        <>
          <FadeIn>
            <TodaySummary plans={plans} />
          </FadeIn>
          <View style={[styles.list, columns > 1 && styles.grid]}>
            {plans.map((track, i) => (
              <FadeIn key={track.id} index={i + 1} style={cell}>
                <CategoryCard track={track} onPress={() => navigation.navigate('TrackDetail', { trackId: track.id })} />
              </FadeIn>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

/** One glance at today: how many of today's tasks are done across all plans. */
function TodaySummary({ plans }: { plans: Track[] }) {
  const active = plans.filter(tr => tr.status === 'ACTIVE');
  const required = active.reduce((n, tr) => n + tr.today_required, 0);
  const done = active.reduce((n, tr) => n + Math.min(tr.today_completed, tr.today_required), 0);
  const allDone = required > 0 && done >= required;
  const headline = !active.length
    ? 'No plan is running today'
    : required === 0
      ? 'Nothing due today'
      : allDone
        ? 'Today is complete'
        : `${required - done} ${required - done === 1 ? 'task' : 'tasks'} left today`;
  return (
    <Card tone="hero" contentStyle={styles.summary} accessibilityLabel={`${headline}. ${done} of ${required} done.`}>
      <ProgressRing progress={required ? done / required : 0} size={72} stroke={6} colorsPair={allDone ? gradients.success : gradients.primary}>
        <Text style={styles.ringText}>{required ? `${Math.round((100 * done) / required)}%` : '–'}</Text>
      </ProgressRing>
      <View style={styles.flex}>
        <Text style={styles.summaryEyebrow}>Today</Text>
        <Text style={styles.summaryTitle}>{headline}</Text>
        <Text style={styles.summaryMeta}>
          {done} of {required} done · {active.length} active {active.length === 1 ? 'plan' : 'plans'}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  start: {
    marginTop: spacing.xl,
  },
  list: {
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  ringText: {
    ...font.bold,
    fontSize: 15,
    color: colors.heroText,
  },
  summaryEyebrow: {
    ...t.micro,
  },
  summaryTitle: {
    ...font.serif,
    fontSize: 22,
    lineHeight: 26,
    color: colors.heroText,
    marginTop: 2,
  },
  summaryMeta: {
    ...t.caption,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
});
