import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Chip, ChipRow, Fab, IconButton, Pill } from '../../../components/Controls';
import { Checkbox } from '../../../components/Checkbox';
import { EmptyState, ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { ConfirmSheet, Sheet } from '../../../components/Sheet';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { DateField } from '../../../components/PickerFields';
import { getErrorMessage } from '../../../utils/apiError';
import { diffDays, formatClock, relativeDayLabel, toDateKey } from '../../../utils/date';
import { cancelReminderNotification, scheduleReminderNotification } from '../../../notifications';
import {
  useCancelReminderMutation,
  useDeleteReminderMutation,
  useListRemindersQuery,
  useSetReminderCompletedMutation,
  useSnoozeReminderMutation,
  type Reminder,
} from '../remindersApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | 'today' | 'tomorrow' | 'week' | 'upcoming' | 'overdue' | 'completed' | 'cancelled' | 'whatsapp' | 'push' | 'date';
type Sort = 'asc' | 'desc' | 'created';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'push', label: 'Push only' },
  { key: 'date', label: 'Pick a date' },
];

function isOpen(r: Reminder) {
  return r.status === 'ACTIVE' && !r.completed_at;
}

function matches(r: Reminder, filter: Filter, todayKey: string, now: number, customDay: string | null): boolean {
  const key = toDateKey(new Date(r.remind_at));
  const at = new Date(r.remind_at).getTime();
  const d = diffDays(key, todayKey);
  switch (filter) {
    case 'today':
      return d === 0 && r.status === 'ACTIVE';
    case 'tomorrow':
      return d === 1 && r.status === 'ACTIVE';
    case 'week':
      return d >= 0 && d < 7 && r.status === 'ACTIVE';
    case 'upcoming':
      return isOpen(r) && at >= now;
    case 'overdue':
      return isOpen(r) && at < now;
    case 'completed':
      return Boolean(r.completed_at);
    case 'cancelled':
      return r.status === 'CANCELLED';
    case 'whatsapp':
      return Boolean(r.whatsapp_number) && r.status === 'ACTIVE';
    case 'push':
      return !r.whatsapp_number && r.status === 'ACTIVE';
    case 'date':
      return customDay ? key === customDay : true;
    default:
      return r.status === 'ACTIVE';
  }
}

function sectionLabel(key: string, todayKey: string): string {
  const d = diffDays(key, todayKey);
  if (d < 0) return d === -1 ? 'Yesterday' : 'Earlier';
  if (d > 30) return 'Later';
  return relativeDayLabel(key, todayKey);
}

export function RemindersScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch, isFetching } = useListRemindersQuery({ include_cancelled: true });
  const [filter, setFilter] = useState<Filter>('all');
  const [customDay, setCustomDay] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('asc');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [menuFor, setMenuFor] = useState<Reminder | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'cancel' | 'delete'; reminder: Reminder } | null>(null);
  const [setCompleted] = useSetReminderCompletedMutation();
  const [snooze, { isLoading: snoozing }] = useSnoozeReminderMutation();
  const [cancel, { isLoading: cancelling }] = useCancelReminderMutation();
  const [remove, { isLoading: deleting }] = useDeleteReminderMutation();

  const todayKey = toDateKey(new Date());
  const now = Date.now();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data ?? [])
      .filter(r => matches(r, filter, todayKey, now, customDay))
      .filter(r => !q || r.title.toLowerCase().includes(q) || (r.note ?? '').toLowerCase().includes(q))
      .sort((a, b) =>
        sort === 'created'
          ? b.created_at.localeCompare(a.created_at)
          : sort === 'desc'
            ? b.remind_at.localeCompare(a.remind_at)
            : a.remind_at.localeCompare(b.remind_at),
      );
    const out: { title: string; items: Reminder[] }[] = [];
    for (const r of list) {
      const label = sort === 'created' ? 'Recently created' : sectionLabel(toDateKey(new Date(r.remind_at)), todayKey);
      const last = out[out.length - 1];
      if (last && last.title === label) last.items.push(r);
      else out.push({ title: label, items: [r] });
    }
    return out;
    // `now` intentionally re-evaluated each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, sort, query, todayKey, customDay]);

  const counts = useMemo(() => {
    const c: Partial<Record<Filter, number>> = {};
    for (const f of FILTERS) c[f.key] = (data ?? []).filter(r => matches(r, f.key, todayKey, now, null)).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, todayKey]);

  const toggleDone = async (r: Reminder) => {
    try {
      const updated = await setCompleted({ id: r.id, completed: !r.completed_at }).unwrap();
      if (updated.completed_at) {
        cancelReminderNotification(r.id).catch(() => undefined);
        Toast.success('Reminder completed.', 1);
      } else if (new Date(updated.remind_at).getTime() > Date.now()) {
        scheduleReminderNotification(r.id, r.title, r.note || r.title, new Date(updated.remind_at)).catch(() => undefined);
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const doSnooze = async (r: Reminder, minutes: number) => {
    try {
      const updated = await snooze({ id: r.id, minutes }).unwrap();
      await scheduleReminderNotification(r.id, r.title, r.note || r.title, new Date(updated.remind_at));
      setMenuFor(null);
      Toast.success(`Snoozed to ${formatClock(updated.remind_at)}.`, 1.4);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const doConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === 'cancel') await cancel(confirm.reminder.id).unwrap();
      else await remove(confirm.reminder.id).unwrap();
      await cancelReminderNotification(confirm.reminder.id);
      setConfirm(null);
      Toast.success(confirm.kind === 'cancel' ? 'Reminder cancelled.' : 'Reminder deleted.', 1.2);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return (
    <Screen
      padded={false}
      onRefresh={refetch}
      refreshing={isFetching && !isLoading}
      footer={<Fab accessibilityLabel="Add reminder" onPress={() => navigation.navigate('ReminderEditor')} />}
    >
      <View style={styles.pad}>
        <LargeTitle
          eyebrow="Never forget what matters"
          title="Reminders"
          right={
            <>
              <IconButton icon="search" accessibilityLabel="Search reminders" onPress={() => setSearching(s => !s)} />
              <IconButton
                icon="sliders"
                accessibilityLabel={`Sort: ${sort === 'asc' ? 'soonest first' : sort === 'desc' ? 'latest first' : 'recently created'}`}
                onPress={() => setSort(s => (s === 'asc' ? 'desc' : s === 'desc' ? 'created' : 'asc'))}
              />
            </>
          }
        />
        {searching ? (
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search reminders"
              placeholderTextColor={colors.textTertiary}
              style={styles.searchInput}
              autoFocus
              accessibilityLabel="Search reminders"
            />
            {query ? <IconButton icon="x" variant="plain" size={16} accessibilityLabel="Clear search" onPress={() => setQuery('')} /> : null}
          </View>
        ) : null}
      </View>
      <ChipRow style={styles.chips}>
        {FILTERS.map(f => (
          <Chip
            key={f.key}
            label={f.label}
            count={f.key !== 'date' && f.key !== 'all' ? counts[f.key] : undefined}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ChipRow>
      <View style={styles.pad}>
        {filter === 'date' ? <DateField value={customDay} onChange={setCustomDay} placeholder="Choose a day" /> : null}
        <Text style={[t.caption, styles.sortHint]}>
          {sort === 'asc' ? 'Soonest first' : sort === 'desc' ? 'Latest first' : 'Recently created'}
        </Text>

        {isLoading ? (
          <SkeletonList count={4} height={72} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error, 'Could not load reminders.')} onRetry={refetch} />
        ) : sections.length === 0 ? (
          <EmptyState
            icon="bell"
            title={filter === 'all' && !query ? 'Your schedule is clear' : 'Nothing matches'}
            message={filter === 'all' && !query ? "Add a reminder so you don't have to remember everything." : 'Try a different filter or search.'}
            actionLabel={filter === 'all' && !query ? 'Add reminder' : undefined}
            onAction={() => navigation.navigate('ReminderEditor')}
          />
        ) : (
          sections.map((section, si) => (
            <FadeIn key={section.title} index={si}>
              <View style={styles.sectionHead}>
                <Text style={[t.micro, { color: section.title === 'Today' ? colors.primary : colors.textTertiary }]}>{section.title}</Text>
                <View style={styles.sectionRule} />
              </View>
              {section.items.map(r => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  onPress={() => navigation.navigate('ReminderEditor', { reminderId: r.id })}
                  onToggle={() => toggleDone(r)}
                  onMore={() => setMenuFor(r)}
                />
              ))}
            </FadeIn>
          ))
        )}
      </View>

      <Sheet visible={Boolean(menuFor)} onClose={() => setMenuFor(null)} title={menuFor?.title} subtitle={menuFor ? `${relativeDayLabel(toDateKey(new Date(menuFor.remind_at)), todayKey)}, ${formatClock(menuFor.remind_at)}` : undefined}>
        {menuFor && menuFor.status === 'ACTIVE' ? (
          <>
            <Text style={styles.menuLabel}>Snooze</Text>
            <View style={styles.snoozeRow}>
              {[
                [10, '10 min'],
                [60, '1 hour'],
                [180, '3 hours'],
                [24 * 60, 'Tomorrow'],
              ].map(([m, label]) => (
                <Chip key={label} label={String(label)} icon="snooze" onPress={() => doSnooze(menuFor, Number(m))} />
              ))}
            </View>
            {snoozing ? <Text style={t.caption}>Snoozing…</Text> : null}
          </>
        ) : null}
        <View style={styles.menuActions}>
          <Button label="Reschedule or edit" icon="edit" variant="secondary" onPress={() => { const r = menuFor; setMenuFor(null); if (r) navigation.navigate('ReminderEditor', { reminderId: r.id }); }} />
          {menuFor?.status === 'ACTIVE' ? (
            <Button label="Cancel reminder" icon="x" variant="secondary" onPress={() => { const r = menuFor!; setMenuFor(null); setConfirm({ kind: 'cancel', reminder: r }); }} />
          ) : null}
          <Button label="Delete" icon="trash" variant="danger" onPress={() => { const r = menuFor!; setMenuFor(null); setConfirm({ kind: 'delete', reminder: r }); }} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={Boolean(confirm)}
        icon={confirm?.kind === 'delete' ? 'trash' : 'x'}
        destructive={confirm?.kind === 'delete'}
        title={confirm?.kind === 'delete' ? 'Delete this reminder?' : 'Cancel this reminder?'}
        message={
          confirm?.kind === 'delete'
            ? 'This permanently removes it. This can’t be undone.'
            : 'It won’t notify you, but you’ll still see it under Cancelled.'
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : 'Cancel reminder'}
        cancelLabel="Keep it"
        loading={cancelling || deleting}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

function ReminderRow({ reminder: r, onPress, onToggle, onMore }: { reminder: Reminder; onPress: () => void; onToggle: () => void; onMore: () => void }) {
  const overdue = isOpen(r) && new Date(r.remind_at).getTime() < Date.now();
  const done = Boolean(r.completed_at);
  const cancelled = r.status === 'CANCELLED';
  const whatsapp =
    r.whatsapp_status === 'SENT' ? { label: 'WhatsApp sent', color: colors.success } :
    r.whatsapp_status === 'FAILED' ? { label: 'WhatsApp failed', color: colors.danger } :
    r.whatsapp_status === 'PENDING' ? { label: 'WhatsApp queued', color: colors.info } : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${formatClock(r.remind_at)}${done ? ', completed' : ''}${overdue ? ', overdue' : ''}`}
      style={({ pressed }) => [styles.row, (done || cancelled) && styles.rowMuted, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, overdue && { color: colors.danger }]}>{formatClock(r.remind_at)}</Text>
        {r.priority === 'HIGH' ? <View style={styles.priority} /> : null}
      </View>
      <View style={styles.body}>
        <Text style={[t.bodyStrong, (done || cancelled) && styles.strike]} numberOfLines={2}>
          {r.title}
        </Text>
        {r.note ? <Text style={t.caption} numberOfLines={1}>{r.note}</Text> : null}
        <View style={styles.pills}>
          <Pill icon="bell" label="Push" />
          {whatsapp ? <Pill icon="message" label={whatsapp.label} color={whatsapp.color} background={`${whatsapp.color}1F`} /> : null}
          {overdue ? <Pill label="Overdue" color={colors.danger} background={colors.dangerSoft} /> : null}
          {cancelled ? <Pill label="Cancelled" /> : null}
        </View>
      </View>
      {!cancelled ? <Checkbox checked={done} onPress={onToggle} size={24} accessibilityLabel={`Mark ${r.title} ${done ? 'not done' : 'done'}`} /> : null}
      <IconButton icon="more" variant="plain" size={18} color={colors.textTertiary} accessibilityLabel={`More options for ${r.title}`} onPress={onMore} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 20,
  },
  chips: {
    paddingHorizontal: 20,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  sortHint: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.textTertiary,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowMuted: {
    backgroundColor: colors.backgroundRaised,
  },
  timeCol: {
    width: 64,
    gap: 6,
  },
  time: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  priority: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.danger,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  strike: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  menuLabel: {
    ...t.micro,
    marginBottom: spacing.sm,
  },
  snoozeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  menuActions: {
    gap: spacing.sm,
  },
});
