import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, radius, spacing, type as t, withAlpha } from '../../../theme';
import { useLayout } from '../../../hooks/useLayout';
import { FadeIn } from '../../../components/Feedback';
import { Screen } from '../../../components/Screen';
import { TopBar } from '../../../components/ScreenHeader';
import { Fab, IconButton, Segmented } from '../../../components/Controls';
import { Checkbox } from '../../../components/Checkbox';
import { DateStrip, type DayMark } from '../../../components/DateStrip';
import { EmptyState, ErrorState, SkeletonList } from '../../../components/Feedback';
import { ConfirmSheet, Sheet } from '../../../components/Sheet';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatClock, formatFullDate, fromDateKey, relativeDayLabel, toDateKey, diffDays } from '../../../utils/date';
import { cancelReminderNotification, scheduleReminderNotification } from '../../../notifications';
import {
  useDeleteReminderMutation,
  useListRemindersQuery,
  useSetReminderCompletedMutation,
  useSnoozeReminderMutation,
  type Reminder,
} from '../remindersApi';
import { useListTracksQuery } from '../../routines/routinesApi';
import { categoryColor } from '../../routines/components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'all' | 'sent' | 'failed' | 'done';

const dayOf = (r: Reminder) => toDateKey(new Date(r.remind_at));
const isPast = (r: Reminder) => new Date(r.remind_at).getTime() <= Date.now();

/** Which reminders each tab shows. Done ones live only in "Done" (the bin). */
const TABS: { value: Tab; label: string; match: (r: Reminder) => boolean }[] = [
  { value: 'all', label: 'All', match: r => !r.completed_at },
  { value: 'sent', label: 'Sent', match: r => !r.completed_at && isPast(r) && r.whatsapp_status !== 'FAILED' },
  { value: 'failed', label: 'Failed', match: r => !r.completed_at && r.whatsapp_status === 'FAILED' },
  { value: 'done', label: 'Done', match: r => Boolean(r.completed_at) },
];

const EMPTY: Record<Tab, { title: string; message: string }> = {
  all: { title: 'No reminders this day', message: 'Tap + to add one. Pick a time, and Memo reminds you.' },
  sent: { title: 'Nothing sent this day', message: 'Reminders show here once their time has come.' },
  failed: { title: 'Nothing failed', message: 'If a WhatsApp message can’t be sent, it shows here.' },
  done: { title: 'Nothing done this day', message: 'Tick a reminder when it’s done. It stays here for 7 days.' },
};

function dayHeading(key: string, todayKey: string) {
  return Math.abs(diffDays(key, todayKey)) <= 1 ? relativeDayLabel(key, todayKey) : formatFullDate(key);
}

/**
 * Reminders by day: pick a day on the strip (today by default) or from the
 * calendar, then the tabs narrow that day's reminders: All (not done yet),
 * Sent (their time has come), Failed (WhatsApp couldn't send) and Done, the
 * bin, where finished reminders wait 7 days before the daily cleanup.
 */
export function RemindersScreen() {
  const navigation = useNavigation<Nav>();
  const { gutter } = useLayout();
  const { data, isLoading, isError, error, refetch, isFetching } = useListRemindersQuery();
  const todayKey = toDateKey(new Date());
  const [tab, setTab] = useState<Tab>('all');
  const [day, setDay] = useState(todayKey);

  // A dot under every day that has a reminder (green once they're all done).
  const marks = useMemo(() => {
    const out: Record<string, DayMark> = {};
    for (const r of data ?? []) {
      const key = dayOf(r);
      const m = out[key] ?? { required: 0, completed: 0, status: 'PENDING' };
      m.required += 1;
      if (r.completed_at) m.completed += 1;
      m.status = m.completed === m.required ? 'SUCCESS' : 'PENDING';
      out[key] = m;
    }
    return out;
  }, [data]);
  const [menuFor, setMenuFor] = useState<Reminder | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Reminder | null>(null);
  const [setCompleted] = useSetReminderCompletedMutation();
  const [snooze] = useSnoozeReminderMutation();
  const [remove, { isLoading: deleting }] = useDeleteReminderMutation();

  const tracks = useListTracksQuery();
  const trackNames = useMemo(() => new Map((tracks.data ?? []).map(tr => [tr.id, tr.name])), [tracks.data]);

  const ofDay = useMemo(() => (data ?? []).filter(r => dayOf(r) === day), [data, day]);
  const counts = useMemo(() => {
    const out = {} as Record<Tab, number>;
    for (const x of TABS) out[x.value] = ofDay.filter(x.match).length;
    return out;
  }, [ofDay]);
  const items = useMemo(() => {
    const match = TABS.find(x => x.value === tab)!.match;
    return ofDay.filter(match).sort((a, b) => a.remind_at.localeCompare(b.remind_at));
  }, [ofDay, tab]);

  const toggleDone = async (r: Reminder) => {
    try {
      const updated = await setCompleted({ id: r.id, completed: !r.completed_at }).unwrap();
      if (updated.completed_at) {
        cancelReminderNotification(r.id).catch(() => undefined);
        Toast.info('Moved to Done.', 1.2);
      } else if (new Date(updated.remind_at).getTime() > Date.now()) {
        scheduleReminderNotification(r.id, r.title, r.note, new Date(updated.remind_at), r.alarm_enabled).catch(() => undefined);
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const doSnooze = async (r: Reminder, minutes: number) => {
    setMenuFor(null);
    try {
      const updated = await snooze({ id: r.id, minutes }).unwrap();
      await scheduleReminderNotification(r.id, r.title, r.note, new Date(updated.remind_at), r.alarm_enabled);
      Toast.success(`Moved to ${formatClock(updated.remind_at)}.`, 1.4);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await remove(confirmDelete.id).unwrap();
      await cancelReminderNotification(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return (
    <Screen
      padded={false}
      onRefresh={refetch}
      refreshing={isFetching && !isLoading}
      footer={<Fab accessibilityLabel="Add reminder" onPress={() => navigation.navigate('ReminderEditor', { date: day })} />}
    >
      <View style={{ paddingHorizontal: gutter }}>
        <TopBar />
      </View>
      <DateStrip selected={day} today={todayKey} onSelect={setDay} marks={marks} daysBack={7} daysForward={30} />
      <View style={{ paddingHorizontal: gutter }}>
        <View style={styles.dayHead}>
          <Text style={styles.dayTitle}>{dayHeading(day, todayKey)}</Text>
          {day !== todayKey ? (
            <Pressable onPress={() => setDay(todayKey)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Today</Text>
            </Pressable>
          ) : null}
          <DatePicker
            value={fromDateKey(day)}
            precision="day"
            minDate={new Date(2020, 0, 1)}
            maxDate={new Date(2035, 11, 31)}
            onChange={(d: Date) => setDay(toDateKey(d))}
            title="Pick a day"
          >
            <CalendarButton />
          </DatePicker>
        </View>
        <Segmented
          options={TABS.map(x => ({ value: x.value, label: x.label, count: counts[x.value] || undefined }))}
          value={tab}
          onChange={setTab}
          style={styles.tabs}
        />

        {isLoading ? (
          <SkeletonList count={3} height={72} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error, 'Could not load reminders.')} onRetry={refetch} />
        ) : !items.length ? (
          <EmptyState
            compact
            icon="bell"
            title={EMPTY[tab].title}
            message={EMPTY[tab].message}
            actionLabel={tab === 'all' && day >= todayKey ? 'Add reminder' : undefined}
            onAction={tab === 'all' && day >= todayKey ? () => navigation.navigate('ReminderEditor', { date: day }) : undefined}
          />
        ) : (
          <>
            {tab === 'done' ? (
              <View style={styles.binNote}>
                <Icon name="trash" size={14} color={colors.textTertiary} />
                <Text style={t.caption}>Done reminders are deleted automatically after 7 days.</Text>
              </View>
            ) : null}
            {items.map((r, i) => (
              <FadeIn key={r.id} index={i}>
                <ReminderRow
                  reminder={r}
                  category={r.track_id ? trackNames.get(r.track_id) : undefined}
                  last={i === items.length - 1}
                  onPress={() => navigation.navigate('ReminderEditor', { reminderId: r.id })}
                  onToggle={() => toggleDone(r)}
                  onMore={() => setMenuFor(r)}
                />
              </FadeIn>
            ))}
          </>
        )}
      </View>

      <Sheet visible={Boolean(menuFor)} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        {menuFor && !menuFor.completed_at ? (
          <>
            <Button label="Edit" icon="edit" variant="secondary" onPress={() => {
              const id = menuFor.id;
              setMenuFor(null);
              navigation.navigate('ReminderEditor', { reminderId: id });
            }} />
            <Button label="Remind me in 1 hour" icon="snooze" variant="secondary" onPress={() => doSnooze(menuFor, 60)} style={styles.mtSm} />
            <Button label="Remind me tomorrow" icon="snooze" variant="secondary" onPress={() => doSnooze(menuFor, 24 * 60)} style={styles.mtSm} />
          </>
        ) : null}
        <Button
          label="Delete"
          icon="trash"
          variant="dangerGhost"
          onPress={() => {
            setConfirmDelete(menuFor);
            setMenuFor(null);
          }}
          style={styles.mtSm}
        />
      </Sheet>

      <ConfirmSheet
        visible={Boolean(confirmDelete)}
        icon="trash"
        destructive
        title="Delete this reminder?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </Screen>
  );
}

/** The calendar button that opens the date picker (it injects onPress). */
function CalendarButton({ onPress }: { onPress?: () => void }) {
  return <IconButton icon="calendar" accessibilityLabel="Pick a day from the calendar" onPress={() => onPress?.()} />;
}

/** One reminder on the day's timeline: serif time, a gold thread, then the card. */
function ReminderRow({
  reminder: r,
  category,
  last,
  onPress,
  onToggle,
  onMore,
}: {
  reminder: Reminder;
  category?: string;
  last: boolean;
  onPress: () => void;
  onToggle: () => void;
  onMore: () => void;
}) {
  const done = Boolean(r.completed_at);
  const late = !done && new Date(r.remind_at).getTime() < Date.now();
  const [clock, meridiem] = formatClock(r.remind_at).split(' ');
  return (
    <View style={styles.line}>
      <View style={styles.timeCol}>
        <Text style={[styles.time, late && { color: colors.danger }, done && styles.timeDone]}>{clock}</Text>
        {meridiem ? <Text style={styles.meridiem}>{meridiem}</Text> : null}
      </View>
      <View style={styles.thread}>
        <View style={[styles.node, done && styles.nodeDone, late && styles.nodeLate]} />
        {last ? null : <View style={styles.threadLine} />}
      </View>
      <Pressable
        onPress={onPress}
        onLongPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={`${r.title}, ${formatClock(r.remind_at)}${done ? ', done' : ''}`}
        style={({ pressed }) => [styles.row, done && styles.rowDone, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text style={[t.bodyStrong, done && styles.strike]} numberOfLines={2}>
            {r.title}
          </Text>
          {r.note ? (
            <Text style={[t.caption, styles.note]} numberOfLines={1}>
              {r.note}
            </Text>
          ) : null}
          {category || r.whatsapp_number || r.alarm_enabled || r.priority === 'HIGH' || late ? (
            <View style={styles.tags}>
              {late ? <Tag label="Time passed" color={colors.warning} /> : null}
              {r.alarm_enabled ? <Tag label="Alarm" color={colors.danger} /> : null}
              {r.priority === 'HIGH' ? <Tag label="Priority" color={colors.streak} /> : null}
              {category ? <Tag label={category} color={categoryColor(category)} dot /> : null}
              {r.whatsapp_number ? <Tag label={WHATSAPP_LABEL[r.whatsapp_status]} color={r.whatsapp_status === 'FAILED' ? colors.danger : colors.success} icon /> : null}
            </View>
          ) : null}
        </View>
        <IconButton icon="more" variant="plain" size={18} color={colors.textTertiary} accessibilityLabel="More options" onPress={onMore} />
        <Checkbox checked={done} onPress={onToggle} accessibilityLabel={done ? 'Mark as not done' : 'Mark as done'} />
      </Pressable>
    </View>
  );
}

const WHATSAPP_LABEL: Record<Reminder['whatsapp_status'], string> = {
  PENDING: 'WhatsApp scheduled',
  SENT: 'WhatsApp sent',
  FAILED: 'WhatsApp failed',
  NOT_REQUESTED: 'WhatsApp',
};

function Tag({ label, color, dot, icon }: { label: string; color: string; dot?: boolean; icon?: boolean }) {
  return (
    <View style={[styles.tag, { borderColor: withAlpha(color, 0.4), backgroundColor: withAlpha(color, 0.1) }]}>
      {dot ? <View style={[styles.tagDot, { backgroundColor: color }]} /> : null}
      {icon ? <Icon name="message" size={10} color={color} strokeWidth={2} /> : null}
      <Text style={[styles.tagText, { color: colors.isDark ? color : colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  tabs: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  binNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dayTitle: {
    ...t.heading,
    flex: 1,
  },
  link: {
    ...font.bold,
    color: colors.primary,
    letterSpacing: 0.4,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeCol: {
    width: 58,
    paddingTop: spacing.lg + 2,
    alignItems: 'flex-end',
  },
  time: {
    ...font.serif,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
  },
  timeDone: {
    color: colors.textTertiary,
  },
  meridiem: {
    ...font.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textTertiary,
  },
  thread: {
    width: 28,
    alignItems: 'center',
  },
  node: {
    marginTop: spacing.lg + 8,
    width: 11,
    height: 11,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.background,
  },
  nodeDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  nodeLate: {
    borderColor: colors.danger,
  },
  threadLine: {
    flex: 1,
    width: 1,
    marginTop: 6,
    backgroundColor: colors.goldLine,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  rowDone: {
    opacity: 0.55,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  note: {
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 180,
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tagText: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
});
