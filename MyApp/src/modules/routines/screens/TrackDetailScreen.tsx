import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { IconButton, Pill, SectionHeader } from '../../../components/Controls';
import { Button } from '../../../components/Button';
import { DateStrip, type DayMark } from '../../../components/DateStrip';
import { EmptyState, ErrorState, FadeIn, Skeleton, SkeletonList } from '../../../components/Feedback';
import { ProgressBar, ProgressRing } from '../../../components/Progress';
import { ConfirmSheet } from '../../../components/Sheet';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatClock, formatFullDate, relativeDayLabel } from '../../../utils/date';
import {
  useArchiveTrackMutation,
  useDeleteTrackMutation,
  useGetAgendaQuery,
  useGetTrackQuery,
  useListTrackActionsQuery,
  useTrackDaysQuery,
} from '../routinesApi';
import { ActionRow, repeatLabel, trackColor } from '../components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TrackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { trackId } = useRoute<RouteProp<RootStackParamList, 'TrackDetail'>>().params;
  const track = useGetTrackQuery(trackId);
  const actions = useListTrackActionsQuery(trackId);
  const days = useTrackDaysQuery({ id: trackId });
  const [selected, setSelected] = useState<string | null>(null);
  const todayKey = useMemo(() => days.data?.find(d => d.status === 'PENDING' || d.status === 'SUCCESS' || d.status === 'NO_ACTIONS')?.date, [days.data]);
  const today = days.data?.filter(d => d.status !== 'FUTURE').slice(-1)[0]?.date ?? todayKey;
  const day = selected ?? today;
  const agenda = useGetAgendaQuery(day ? { day } : undefined, { skip: !day });
  const [archive, { isLoading: archiving }] = useArchiveTrackMutation();
  const [remove, { isLoading: deleting }] = useDeleteTrackMutation();
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);

  const marks = useMemo(() => {
    const out: Record<string, DayMark> = {};
    for (const d of days.data ?? []) out[d.date] = d;
    return out;
  }, [days.data]);

  if (track.isError) {
    return (
      <Screen>
        <ScreenHeader />
        <ErrorState message={getErrorMessage(track.error, 'Could not load this Track.')} onRetry={track.refetch} />
      </Screen>
    );
  }

  const tr = track.data;
  const color = trackColor(tr?.color);
  const group = agenda.data?.groups.find(g => g.track.id === trackId);
  const progress = tr?.total_days && tr.day_number ? tr.day_number / tr.total_days : 0;

  const doArchive = async () => {
    try {
      await archive({ id: trackId, archived: !tr?.is_archived }).unwrap();
      setConfirm(null);
      Toast.success(tr?.is_archived ? 'Track restored.' : 'Track archived.', 1.2);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };
  const doDelete = async () => {
    try {
      await remove(trackId).unwrap();
      setConfirm(null);
      navigation.goBack();
      Toast.success('Track deleted. Your past streak history is kept.', 2);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return (
    <Screen
      padded={false}
      onRefresh={() => {
        track.refetch();
        actions.refetch();
        days.refetch();
        agenda.refetch();
      }}
      refreshing={track.isFetching}
    >
      <View style={styles.pad}>
        <ScreenHeader
          title={tr?.name}
          right={<IconButton icon="edit" accessibilityLabel="Edit Track" onPress={() => navigation.navigate('TrackEditor', { trackId })} />}
        />
        {!tr ? (
          <Skeleton height={180} rounded={radius.xl} />
        ) : (
          <FadeIn>
            <Card gradient={[`${color}`, colors.surface]} gradientOpacity={[0.28, 1]}>
              <View style={styles.heroRow}>
                <View style={styles.flex}>
                  <Text style={styles.heroIcon}>{tr.icon || tr.name.slice(0, 1).toUpperCase()}</Text>
                  <Text style={[t.title, styles.mtSm]}>{tr.name}</Text>
                  {tr.description ? <Text style={[t.caption, styles.mtXs]}>{tr.description}</Text> : null}
                  <Text style={[t.caption, styles.mtSm]}>
                    {formatFullDate(tr.start_date)} → {tr.end_date ? formatFullDate(tr.end_date) : 'Ongoing'}
                  </Text>
                </View>
                <ProgressRing progress={tr.completion_rate} size={84} stroke={8} colorsPair={[color, colors.primarySecondary]}>
                  <Text style={styles.ringText}>{Math.round(tr.completion_rate * 100)}%</Text>
                </ProgressRing>
              </View>
              <View style={styles.statRow}>
                <Stat label={tr.total_days ? `of ${tr.total_days} days` : 'days in'} value={tr.day_number ? `Day ${tr.day_number}` : '—'} />
                <Stat label="Track streak" value={String(tr.streak)} accent={colors.streak} />
                <Stat label="Remaining" value={tr.days_remaining != null ? `${tr.days_remaining}d` : '∞'} />
              </View>
              {tr.total_days ? <ProgressBar progress={progress} colorsPair={[color, colors.primarySecondary]} style={styles.mtLg} /> : null}
              <View style={styles.pills}>
                {tr.status !== 'ACTIVE' ? <Pill label={tr.status} /> : null}
                {tr.end_date ? <Pill icon="trophy" label="Bonus eligible when perfect" color={colors.streakGold} background={colors.warningSoft} /> : null}
              </View>
            </Card>
          </FadeIn>
        )}
      </View>

      {today ? <DateStrip selected={day!} today={today} onSelect={setSelected} marks={marks} daysBack={14} daysForward={7} /> : null}

      <View style={styles.pad}>
        <SectionHeader title={day && today ? relativeDayLabel(day, today) : 'Today'} />
        {agenda.isLoading ? (
          <SkeletonList count={3} height={64} />
        ) : !group ? (
          <Text style={[t.caption, styles.emptyDay]}>No actions from this Track on this day.</Text>
        ) : (
          group.items.map(item => (
            <ActionRow
              key={item.action.id}
              item={item}
              trackName={tr?.name ?? ''}
              trackColorValue={color}
              editable={Boolean(agenda.data?.editable)}
              onLongPress={() => navigation.navigate('ActionEditor', { trackId, actionId: item.action.id })}
            />
          ))
        )}

        <SectionHeader title={`Actions · ${actions.data?.length ?? 0}`} action="Add action" onAction={() => navigation.navigate('ActionEditor', { trackId })} />
        {actions.isLoading ? (
          <SkeletonList count={2} height={60} />
        ) : !actions.data?.length ? (
          <EmptyState
            compact
            icon="plus"
            title="No actions yet"
            message="Add the things you'll do for this Track, like 07:00 AM Morning Workout."
            actionLabel="Add action"
            onAction={() => navigation.navigate('ActionEditor', { trackId })}
          />
        ) : (
          <Card padded={false}>
            {actions.data.map((a, i) => (
              <View key={a.id} style={[styles.defRow, i > 0 && styles.divider]}>
                <View style={styles.defTime}>
                  <Text style={styles.defClock}>{a.time_of_day ? formatClock(a.time_of_day) : 'Any time'}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[t.bodyStrong, !a.is_active && { color: colors.textTertiary }]}>{a.title}</Text>
                  <Text style={t.caption}>
                    {repeatLabel(a)}
                    {a.is_required ? '' : ' · Optional'}
                    {a.is_active ? '' : ' · Paused'}
                    {a.reminder_enabled ? ' · Reminder on' : ''}
                  </Text>
                </View>
                <IconButton
                  icon="edit"
                  variant="plain"
                  size={18}
                  color={colors.textSecondary}
                  accessibilityLabel={`Edit ${a.title}`}
                  onPress={() => navigation.navigate('ActionEditor', { trackId, actionId: a.id })}
                />
              </View>
            ))}
          </Card>
        )}

        <View style={styles.dangerZone}>
          <Button
            label={tr?.is_archived ? 'Restore Track' : 'Archive Track'}
            icon="archive"
            variant="secondary"
            onPress={() => (tr?.is_archived ? doArchive() : setConfirm('archive'))}
            loading={archiving}
          />
          <Button label="Delete Track" icon="trash" variant="danger" onPress={() => setConfirm('delete')} />
        </View>
      </View>

      <ConfirmSheet
        visible={confirm === 'archive'}
        icon="archive"
        title="Archive this Track?"
        message="Its actions stop appearing in your day. Your streak history stays exactly as it is, and you can restore it anytime."
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={doArchive}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        visible={confirm === 'delete'}
        icon="trash"
        destructive
        title="Delete this Track?"
        message="Its actions will be removed from today onward. Days you've already completed keep counting in your streak history."
        confirmLabel="Delete Track"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {accent ? <Icon name="flame" size={14} color={accent} /> : null}
        <Text style={[t.heading, accent ? { color: accent } : null]}>{value}</Text>
      </View>
      <Text style={t.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 20,
  },
  mtXs: {
    marginTop: 4,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroIcon: {
    fontSize: 30,
    color: colors.text,
    fontWeight: '800',
  },
  ringText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
  stat: {
    flex: 1,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyDay: {
    paddingVertical: spacing.lg,
  },
  defRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  defTime: {
    width: 64,
  },
  defClock: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  dangerZone: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
});
