import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Chip, Fab, IconButton } from '../../../components/Controls';
import { DateStrip, type DayMark } from '../../../components/DateStrip';
import { EmptyState, ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { ProgressBar } from '../../../components/Progress';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { relativeDayLabel } from '../../../utils/date';
import { useGetHistoryQuery, useGetStreakQuery } from '../../streaks/streaksApi';
import { useGetAgendaQuery, useListTracksQuery } from '../routinesApi';
import { ActionRow, TrackCard, trackColor } from '../components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'today' | 'tracks';

export function RoutinesScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('today');
  const [showArchived, setShowArchived] = useState(false);
  const streak = useGetStreakQuery();
  const todayKey = streak.data?.today.date;
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected ?? todayKey;

  const agenda = useGetAgendaQuery(day ? { day } : undefined, { skip: !day });
  const tracks = useListTracksQuery({ includeArchived: showArchived });
  const history = useGetHistoryQuery();

  const marks = useMemo(() => {
    const out: Record<string, DayMark> = {};
    for (const d of history.data ?? []) out[d.date] = { required: d.required, completed: d.completed, status: d.status };
    return out;
  }, [history.data]);

  const refresh = () => {
    agenda.refetch();
    tracks.refetch();
    history.refetch();
    streak.refetch();
  };

  return (
    <Screen padded={false} onRefresh={refresh} refreshing={agenda.isFetching || tracks.isFetching} footer={
      <Fab
        accessibilityLabel={tab === 'tracks' ? 'Create Track' : 'Add action'}
        onPress={() => navigation.navigate('TrackEditor')}
      />
    }>
      <View style={styles.pad}>
        <LargeTitle
          eyebrow="Plan · Complete · Verify"
          title="Routines"
          right={<IconButton icon="calendar" accessibilityLabel="Consistency history" onPress={() => navigation.navigate('Consistency')} />}
        />
        <View style={styles.segment} accessibilityRole="tablist">
          {(['today', 'tracks'] as Tab[]).map(key => (
            <Chip key={key} label={key === 'today' ? 'Daily actions' : 'Tracks'} selected={tab === key} onPress={() => setTab(key)} />
          ))}
        </View>
      </View>

      {tab === 'today' ? (
        <>
          {todayKey ? <DateStrip selected={day!} today={todayKey} onSelect={setSelected} marks={marks} /> : null}
          <View style={styles.pad}>
            {agenda.isLoading || !day ? (
              <SkeletonList count={4} height={64} />
            ) : agenda.isError || !agenda.data ? (
              <ErrorState message={getErrorMessage(agenda.error, 'Could not load actions.')} onRetry={agenda.refetch} />
            ) : (
              <>
                <FadeIn style={styles.dayHeader}>
                  <View style={styles.flex}>
                    <Text style={t.heading}>{relativeDayLabel(agenda.data.date, todayKey!)}</Text>
                    <Text style={t.caption}>
                      {agenda.data.is_today
                        ? 'Tap an action to confirm it'
                        : agenda.data.date < todayKey!
                          ? 'Past days are locked to keep streaks honest'
                          : 'Preview, can be completed on the day'}
                    </Text>
                  </View>
                  {agenda.data.required > 0 ? (
                    <View style={styles.dayCount}>
                      <Text style={styles.dayCountText}>
                        {agenda.data.completed}/{agenda.data.required}
                      </Text>
                    </View>
                  ) : null}
                </FadeIn>
                {agenda.data.required > 0 ? (
                  <ProgressBar progress={agenda.data.completed / agenda.data.required} style={styles.dayProgress} />
                ) : null}

                {agenda.data.groups.length === 0 ? (
                  <EmptyState
                    icon="target"
                    title={tracks.data?.length ? 'Your day is clear' : 'Nothing here yet'}
                    message={
                      tracks.data?.length
                        ? 'No actions are planned for this day.'
                        : 'Create your first Track and start building consistency.'
                    }
                    actionLabel={tracks.data?.length ? undefined : 'Create Track'}
                    onAction={() => navigation.navigate('TrackEditor')}
                  />
                ) : (
                  agenda.data.groups.map((group, gi) => (
                    <FadeIn key={group.track.id} index={gi} style={styles.group}>
                      <View style={styles.groupHeader}>
                        <View style={[styles.dot, { backgroundColor: trackColor(group.track.color) }]} />
                        <Text style={[t.micro, styles.flex, { color: colors.text }]}>{group.track.name}</Text>
                        <Text style={t.caption}>
                          {group.completed}/{group.required} done
                        </Text>
                      </View>
                      {group.items.map(item => (
                        <ActionRow
                          key={item.action.id}
                          item={item}
                          trackName={group.track.name}
                          trackColorValue={trackColor(group.track.color)}
                          editable={agenda.data!.editable}
                          onLongPress={() => navigation.navigate('ActionEditor', { trackId: group.track.id, actionId: item.action.id })}
                        />
                      ))}
                    </FadeIn>
                  ))
                )}
              </>
            )}
          </View>
        </>
      ) : (
        <View style={styles.pad}>
          {tracks.isLoading ? (
            <SkeletonList count={3} height={120} />
          ) : tracks.isError ? (
            <ErrorState message={getErrorMessage(tracks.error, 'Could not load Tracks.')} onRetry={tracks.refetch} />
          ) : !tracks.data?.length ? (
            <EmptyState
              icon="target"
              title="Nothing here yet"
              message="Create your first Track and start building consistency. A Track is a goal like Gym, Study or Diet, with a start and end date."
              actionLabel="Create Track"
              onAction={() => navigation.navigate('TrackEditor')}
            />
          ) : (
            <>
              {tracks.data.map((track, i) => (
                <FadeIn key={track.id} index={i}>
                  <TrackCard track={track} onPress={() => navigation.navigate('TrackDetail', { trackId: track.id })} />
                </FadeIn>
              ))}
            </>
          )}
          <View style={styles.archivedToggle}>
            <Chip
              label={showArchived ? 'Hide archived' : 'Show archived'}
              icon="archive"
              selected={showArchived}
              onPress={() => setShowArchived(v => !v)}
            />
          </View>
          <View style={styles.rule}>
            <Icon name="info" size={16} color={colors.textTertiary} />
            <Text style={[t.caption, styles.flex]}>
              A day counts toward your streak when every required action due that day is confirmed. Optional actions never
              break a streak.
            </Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 20,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  dayCount: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  dayCountText: {
    color: colors.primary,
    fontWeight: '800',
  },
  dayProgress: {
    marginBottom: spacing.xl,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  archivedToggle: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  rule: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
