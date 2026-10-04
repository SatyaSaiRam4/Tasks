import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type as t } from '../../theme';
import { Card } from '../../components/Card';
import { Checkbox } from '../../components/Checkbox';
import { Pill } from '../../components/Controls';
import { Icon } from '../../components/Icon';
import { ProgressBar } from '../../components/Progress';
import { formatClock, formatDayMonth, WEEKDAYS_MON_FIRST } from '../../utils/date';
import type { Action, AgendaItem, Track } from './routinesApi';
import { useCompletion } from './CompletionProvider';

export function trackColor(color: string | null | undefined): string {
  return color || colors.primary;
}

export function repeatLabel(a: Pick<Action, 'repeat_type' | 'repeat_weekdays' | 'repeat_interval_days'>): string {
  switch (a.repeat_type) {
    case 'DAILY':
      return 'Every day';
    case 'WEEKLY':
      return (a.repeat_weekdays ?? []).map(d => WEEKDAYS_MON_FIRST[d]).join(', ') || 'Weekly';
    case 'CUSTOM':
      return `Every ${a.repeat_interval_days} days`;
    default:
      return 'Once';
  }
}

/**
 * One Action on a given day. Today's items open the confirmation flow;
 * past and future days are read-only.
 */
export function ActionRow({
  item,
  trackName,
  trackColorValue,
  editable,
  onLongPress,
  showTrack = false,
}: {
  item: AgendaItem;
  trackName: string;
  trackColorValue: string;
  editable: boolean;
  onLongPress?: () => void;
  showTrack?: boolean;
}) {
  const { request } = useCompletion();
  const { action, is_completed } = item;
  const time = action.time_of_day ? formatClock(action.time_of_day) : 'Any time';
  const open = () => editable && request({ action, trackName, isCompleted: is_completed });

  return (
    <Pressable
      onPress={open}
      onLongPress={onLongPress}
      disabled={!editable && !onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${action.title}, ${time}, ${is_completed ? 'completed' : 'not completed'}${action.is_required ? '' : ', optional'}`}
      accessibilityHint={editable ? (is_completed ? 'Opens undo' : 'Opens completion confirmation') : undefined}
      style={({ pressed }) => [styles.row, is_completed && styles.rowDone, pressed && styles.pressed]}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, is_completed && styles.textDone]}>{time}</Text>
      </View>
      <View style={[styles.rail, { backgroundColor: is_completed ? colors.success : trackColorValue }]} />
      <View style={styles.body}>
        <Text style={[t.bodyStrong, is_completed && styles.textDone]} numberOfLines={2}>
          {action.title}
        </Text>
        <View style={styles.metaRow}>
          {showTrack ? <Text style={[t.caption, { color: trackColorValue }]}>{trackName}</Text> : null}
          {!action.is_required ? <Pill label="Optional" /> : null}
          {action.priority === 'HIGH' ? <Pill label="High" color={colors.danger} background={colors.dangerSoft} /> : null}
          {action.steps.length ? <Text style={t.caption}>{action.steps.length} steps</Text> : null}
        </View>
      </View>
      <Checkbox
        checked={is_completed}
        onPress={editable ? open : undefined}
        disabled={!editable}
        color={trackColorValue}
        accessibilityLabel={`Complete ${action.title}`}
      />
    </Pressable>
  );
}

export function TrackCard({ track, onPress }: { track: Track; onPress: () => void }) {
  const color = trackColor(track.color);
  const range = `${formatDayMonth(track.start_date)} → ${track.end_date ? formatDayMonth(track.end_date) : 'Ongoing'}`;
  const progress = track.total_days && track.day_number ? track.day_number / track.total_days : track.completion_rate;
  const statusLabel =
    track.status === 'UPCOMING' ? 'Starts soon' : track.status === 'ENDED' ? 'Completed period' : track.status === 'ARCHIVED' ? 'Archived' : null;

  return (
    <Card onPress={onPress} accent={color} accessibilityLabel={`${track.name} track`} style={styles.trackCard}>
      <View style={styles.trackHeader}>
        <View style={[styles.trackIcon, { backgroundColor: `${color}22` }]}>
          <Text style={styles.trackEmoji}>{track.icon || track.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={t.subtitle} numberOfLines={1}>
            {track.name}
          </Text>
          <Text style={t.caption}>{range}</Text>
        </View>
        {track.streak > 0 ? (
          <View style={styles.streakBadge}>
            <Icon name="flame" size={14} color={colors.streak} />
            <Text style={styles.streakText}>{track.streak}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.trackStats}>
        <Text style={t.caption}>
          {track.day_number && track.total_days
            ? `Day ${track.day_number} of ${track.total_days}`
            : track.day_number
              ? `Day ${track.day_number}`
              : statusLabel ?? 'Not started'}
        </Text>
        <Text style={t.caption}>
          {track.today_required > 0 ? `${track.today_completed}/${track.today_required} today` : `${track.action_count} ${track.action_count === 1 ? 'action' : 'actions'}`}
        </Text>
      </View>
      <ProgressBar progress={progress} height={6} colorsPair={[color, color]} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    minHeight: 64,
  },
  rowDone: {
    backgroundColor: colors.backgroundRaised,
  },
  timeCol: {
    width: 62,
  },
  time: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  rail: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  body: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  textDone: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  trackCard: {
    marginBottom: spacing.md,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trackIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackEmoji: {
    fontSize: 20,
    color: colors.text,
    fontWeight: '800',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.streakSoft,
  },
  streakText: {
    color: colors.streak,
    fontWeight: '800',
    fontSize: 13,
  },
  trackStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
