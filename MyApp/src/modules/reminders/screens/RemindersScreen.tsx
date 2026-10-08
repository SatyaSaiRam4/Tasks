import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { brand, colors, font, radius, spacing, type as t, withAlpha } from '../../../theme';
import { useLayout } from '../../../hooks/useLayout';
import { FadeIn } from '../../../components/Feedback';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Fab, IconButton, Medallion, SectionHeader } from '../../../components/Controls';
import { Card } from '../../../components/Card';
import { Glow } from '../../../components/Gradient';
import { Checkbox } from '../../../components/Checkbox';
import { DateStrip, type DayMark } from '../../../components/DateStrip';
import { EmptyState, ErrorState, SkeletonList } from '../../../components/Feedback';
import { ConfirmSheet, Sheet } from '../../../components/Sheet';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatClock, formatDateTime, formatFullDate, fromDateKey, relativeDayLabel, toDateKey } from '../../../utils/date';
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

  const tracks = useListTracksQuery();
  const trackNames = useMemo(() => new Map((tracks.data ?? []).map(tr => [tr.id, tr.name])), [tracks.data]);

  // The assistant's brief: what's left today and what comes next.
  const brief = useMemo(() => {
    const open = (data ?? []).filter(r => !r.completed_at);
    const todayOpen = open.filter(r => dayOf(r) === todayKey);
    const next = open
      .filter(r => new Date(r.remind_at).getTime() > Date.now())
      .sort((a, b) => a.remind_at.localeCompare(b.remind_at))[0];
    return { todayOpen: todayOpen.length, next };
  }, [data, todayKey]);

  const upcoming = useMemo(
    () =>
      (data ?? [])
        .filter(r => !r.completed_at && dayOf(r) > day && new Date(r.remind_at).getTime() > Date.now())
        .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
        .slice(0, 5),
    [data, day],
  );

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
          eyebrow="Your assistant"
          title="Reminders"
          hideNotifications
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

      {data ? (
        <View style={[styles.pad, { paddingHorizontal: gutter }]}>
          <FadeIn style={styles.briefWrap}>
            <Card tone="hero" contentStyle={styles.brief}>
              <Glow color={brand.azure} size={300} intensity={0.16} style={styles.briefGlow} />
              <Medallion icon="bell" size={50} color={brand.champagne} filled />
              <View style={styles.flex}>
                <Text style={styles.briefEyebrow}>Today’s brief</Text>
                <Text style={styles.briefTitle}>
                  {brief.todayOpen === 0
                    ? 'Your day is clear'
                    : `${brief.todayOpen} ${brief.todayOpen === 1 ? 'reminder' : 'reminders'} today`}
                </Text>
                <Text style={styles.briefNext} numberOfLines={2}>
                  {brief.next ? `Next: ${brief.next.title} · ${formatDateTime(brief.next.remind_at)}` : 'Nothing else is scheduled.'}
                </Text>
              </View>
            </Card>
          </FadeIn>
        </View>
      ) : null}

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
                category={r.track_id ? trackNames.get(r.track_id) : undefined}
                last={i === items.length - 1}
                onPress={() => navigation.navigate('ReminderEditor', { reminderId: r.id })}
                onToggle={() => toggleDone(r)}
                onMore={() => setMenuFor(r)}
              />
            </FadeIn>
          ))
        )}

        {!isLoading && !isError && upcoming.length ? (
          <>
            <SectionHeader title="Coming up" />
            <Card padded={false}>
              {upcoming.map((r, i) => (
                <Pressable
                  key={r.id}
                  onPress={() => navigation.navigate('ReminderEditor', { reminderId: r.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.title}, ${formatDateTime(r.remind_at)}`}
                  style={({ pressed }) => [styles.upRow, i < upcoming.length - 1 && styles.upDivider, pressed && styles.pressed]}
                >
                  <View style={styles.upDate}>
                    <Text style={styles.upDay}>{fromDateKey(dayOf(r)).getDate()}</Text>
                    <Text style={styles.upMonth}>{relativeDayLabel(dayOf(r), todayKey).split(',')[0]}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={t.bodyStrong} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={t.caption}>{formatClock(r.remind_at)}</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}
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
          {category || r.whatsapp_number || r.priority === 'HIGH' || late ? (
            <View style={styles.tags}>
              {late ? <Tag label="Overdue" color={colors.danger} /> : null}
              {r.priority === 'HIGH' ? <Tag label="Priority" color={colors.streak} /> : null}
              {category ? <Tag label={category} color={categoryColor(category)} dot /> : null}
              {r.whatsapp_number ? <Tag label="WhatsApp" color={colors.success} icon /> : null}
            </View>
          ) : null}
        </View>
        <IconButton icon="more" variant="plain" size={18} color={colors.textTertiary} accessibilityLabel="More options" onPress={onMore} />
        <Checkbox checked={done} onPress={onToggle} accessibilityLabel={done ? 'Mark as not done' : 'Mark as done'} />
      </Pressable>
    </View>
  );
}

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
  pad: {
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.75,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  briefWrap: {
    marginBottom: spacing.md,
  },
  brief: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  briefGlow: {
    position: 'absolute',
    top: -150,
    right: -120,
  },
  briefEyebrow: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: brand.champagne,
  },
  briefTitle: {
    ...t.heading,
    color: colors.heroText,
    marginTop: 4,
  },
  briefNext: {
    ...font.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.heroTextSecondary,
    marginTop: 4,
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
    maxWidth: 160,
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
  upRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.md + 2,
  },
  upDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  upDate: {
    width: 64,
    alignItems: 'center',
  },
  upDay: {
    ...font.serif,
    fontSize: 26,
    lineHeight: 28,
    color: colors.goldBright,
  },
  upMonth: {
    ...font.bold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
});
