import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, radius, spacing, type as t } from '../../../theme';
import { useLayout } from '../../../hooks/useLayout';
import { FadeIn } from '../../../components/Feedback';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Fab, IconButton } from '../../../components/Controls';
import { Checkbox } from '../../../components/Checkbox';
import { DateStrip, type DayMark } from '../../../components/DateStrip';
import { EmptyState, ErrorState, SkeletonList } from '../../../components/Feedback';
import { ConfirmSheet, Sheet } from '../../../components/Sheet';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatClock, formatFullDate, fromDateKey, relativeDayLabel, toDateKey } from '../../../utils/date';
import { cancelReminderNotification, scheduleReminderNotification } from '../../../notifications';
import {
  useDeleteReminderMutation,
  useListRemindersQuery,
  useSetReminderCompletedMutation,
  useSnoozeReminderMutation,
  type Reminder,
} from '../remindersApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const dayOf = (r: Reminder) => toDateKey(new Date(r.remind_at));

/** Reminders: pick a day (strip or calendar), see that day's reminders. */
export function RemindersScreen() {
  const navigation = useNavigation<Nav>();
  const { gutter } = useLayout();
  const { data, isLoading, isError, error, refetch, isFetching } = useListRemindersQuery();
  const todayKey = toDateKey(new Date());
  const [day, setDay] = useState(todayKey);
  const [menuFor, setMenuFor] = useState<Reminder | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Reminder | null>(null);
  const [setCompleted] = useSetReminderCompletedMutation();
  const [snooze] = useSnoozeReminderMutation();
  const [remove, { isLoading: deleting }] = useDeleteReminderMutation();

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

  const items = useMemo(
    () => (data ?? []).filter(r => dayOf(r) === day).sort((a, b) => a.remind_at.localeCompare(b.remind_at)),
    [data, day],
  );

  const toggleDone = async (r: Reminder) => {
    try {
      const updated = await setCompleted({ id: r.id, completed: !r.completed_at }).unwrap();
      if (updated.completed_at) cancelReminderNotification(r.id).catch(() => undefined);
      else if (new Date(updated.remind_at).getTime() > Date.now()) {
        scheduleReminderNotification(r.id, r.title, r.note || r.title, new Date(updated.remind_at)).catch(() => undefined);
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const doSnooze = async (r: Reminder, minutes: number) => {
    setMenuFor(null);
    try {
      const updated = await snooze({ id: r.id, minutes }).unwrap();
      await scheduleReminderNotification(r.id, r.title, r.note || r.title, new Date(updated.remind_at));
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

  const dayTitle = Math.abs(fromDateKey(day).getTime() - fromDateKey(todayKey).getTime()) <= 6 * 86400000
    ? relativeDayLabel(day, todayKey)
    : formatFullDate(day);

  return (
    <Screen
      padded={false}
      onRefresh={refetch}
      refreshing={isFetching && !isLoading}
      footer={<Fab accessibilityLabel="Add reminder" onPress={() => navigation.navigate('ReminderEditor', { date: day })} />}
    >
      <View style={[styles.pad, { paddingHorizontal: gutter }]}>
        <LargeTitle
          eyebrow="Your day"
          title="Reminders"
          right={
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
          }
        />
      </View>

      <DateStrip selected={day} today={todayKey} onSelect={setDay} marks={marks} daysBack={3} daysForward={30} />

      <View style={[styles.pad, { paddingHorizontal: gutter }]}>
        <View style={styles.dayHead}>
          <Text style={styles.dayTitle}>{dayTitle}</Text>
          {day !== todayKey ? (
            <Pressable onPress={() => setDay(todayKey)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Today</Text>
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <SkeletonList count={3} height={64} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error, 'Could not load reminders.')} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            compact
            icon="bell"
            title="No reminders this day"
            actionLabel="Add reminder"
            onAction={() => navigation.navigate('ReminderEditor', { date: day })}
          />
        ) : (
          items.map((r, i) => (
            <FadeIn key={r.id} index={i}>
              <ReminderRow
                reminder={r}
                last={i === items.length - 1}
                onPress={() => navigation.navigate('ReminderEditor', { reminderId: r.id })}
                onToggle={() => toggleDone(r)}
                onMore={() => setMenuFor(r)}
              />
            </FadeIn>
          ))
        )}
      </View>

      <Sheet visible={Boolean(menuFor)} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        {menuFor && !menuFor.completed_at ? (
          <>
            <Button label="Remind me in 1 hour" icon="snooze" variant="secondary" onPress={() => doSnooze(menuFor, 60)} />
            <Button label="Remind me tomorrow" icon="snooze" variant="secondary" onPress={() => doSnooze(menuFor, 24 * 60)} style={styles.mtSm} />
          </>
        ) : null}
        <Button
          label="Delete"
          icon="trash"
          variant="ghost"
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
  last,
  onPress,
  onToggle,
  onMore,
}: {
  reminder: Reminder;
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
          {r.whatsapp_number ? (
            <View style={styles.whatsapp}>
              <Icon name="message" size={12} color={colors.gold} strokeWidth={1.8} />
              <Text style={t.caption}>WhatsApp too</Text>
            </View>
          ) : null}
        </View>
        <IconButton icon="more" variant="plain" size={18} color={colors.textTertiary} accessibilityLabel="More options" onPress={onMore} />
        <Checkbox checked={done} onPress={onToggle} accessibilityLabel={done ? 'Mark as not done' : 'Mark as done'} />
      </Pressable>
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
  pressed: {
    opacity: 0.75,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  dayTitle: {
    ...t.title,
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
    width: 62,
    paddingTop: spacing.lg,
    alignItems: 'flex-end',
  },
  time: {
    ...font.serif,
    fontSize: 20,
    lineHeight: 21,
    color: colors.text,
  },
  timeDone: {
    color: colors.textTertiary,
  },
  meridiem: {
    ...font.bold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: colors.textTertiary,
  },
  thread: {
    width: 28,
    alignItems: 'center',
  },
  node: {
    marginTop: spacing.lg + 7,
    width: 11,
    height: 11,
    borderRadius: 6,
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
    marginTop: 4,
    backgroundColor: colors.goldLine,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  rowDone: {
    opacity: 0.55,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
});
