import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from '@ant-design/react-native/lib/toast';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { colors, font, radius, spacing, TAB_BAR_HEIGHT, type as t, withAlpha } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { RealIcon } from '../../../components/RealIcon';
import { Fab, IconButton, Segmented } from '../../../components/Controls';
import { Button } from '../../../components/Button';
import { Checkbox } from '../../../components/Checkbox';
import { DateStrip, type DayMark } from '../../../components/DateStrip';
import { useLayout } from '../../../hooks/useLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { diffDays, formatClock, formatFullDate, fromDateKey, relativeDayLabel, toDateKey } from '../../../utils/date';
import { EmptyState, ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { ConfirmSheet } from '../../../components/Sheet';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { selectVaultUnlocked, vaultLocked } from '../vaultSlice';
import { touchVault } from '../VaultAutoLock';
import { VaultLock } from '../VaultLock';
import {
  useDeleteVaultEntryMutation,
  useFlagVaultEntryMutation,
  useGetVaultStatusQuery,
  useListVaultEntriesQuery,
} from '../vaultApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function VaultScreen() {
  const unlocked = useAppSelector(selectVaultUnlocked);
  const status = useGetVaultStatusQuery();

  if (!unlocked) {
    return (
      <Screen glowColor={colors.violet}>
        <LargeTitle title="Vault" />
        {status.isLoading ? (
          <SkeletonList count={1} height={300} />
        ) : status.isError || !status.data ? (
          <ErrorState message={getErrorMessage(status.error, 'Could not reach your Vault.')} onRetry={status.refetch} />
        ) : (
          <VaultLock status={status.data} onLockedRefresh={status.refetch} />
        )}
      </Screen>
    );
  }
  return <UnlockedVault />;
}

type Mode = 'all' | 'date';
const dayOf = (iso: string) => toDateKey(new Date(iso));

function dayHeading(key: string, todayKey: string) {
  return Math.abs(diffDays(key, todayKey)) <= 1 ? relativeDayLabel(key, todayKey) : formatFullDate(key);
}

/**
 * The open Vault: all notes grouped by the day they were written, or one
 * day at a time (date strip and calendar, like Reminders). The icon beside
 * the search box turns on selection: tick notes, then move them to Deleted
 * notes (or, there, restore them or delete them for good). Nothing is ever
 * deleted in one tap.
 */
function UnlockedVault() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { gutter, hasRail } = useLayout();
  const insets = useSafeAreaInsets();
  // The selection actions float above the tab bar, like the + button.
  const barBottom = hasRail ? spacing.xxxl : Math.max(insets.bottom, spacing.md) + TAB_BAR_HEIGHT + spacing.md;
  const todayKey = toDateKey(new Date());
  const [showDeleted, setShowDeleted] = useState(false);
  const [mode, setMode] = useState<Mode>('all');
  const [day, setDay] = useState(todayKey);
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<'trash' | 'forever' | null>(null);
  const [working, setWorking] = useState(false);
  const entries = useListVaultEntriesQuery({ view: showDeleted ? 'trash' : 'all', q: query.trim() || undefined });
  const [flagEntry] = useFlagVaultEntryMutation();
  const [deleteEntry] = useDeleteVaultEntryMutation();

  const all = useMemo(() => entries.data ?? [], [entries.data]);
  // A dot under every day that has notes.
  const marks = useMemo(() => {
    const out: Record<string, DayMark> = {};
    for (const e of all) {
      const key = dayOf(e.created_at);
      const m = out[key] ?? { required: 0, completed: 0, status: 'SUCCESS' };
      m.required += 1;
      m.completed += 1;
      out[key] = m;
    }
    return out;
  }, [all]);
  const shown = mode === 'date' && !showDeleted ? all.filter(e => dayOf(e.created_at) === day) : all;
  const groups = useMemo(() => {
    const out: { day: string; items: typeof shown }[] = [];
    for (const e of [...shown].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const key = dayOf(e.created_at);
      const last = out[out.length - 1];
      if (last && last.day === key) last.items.push(e);
      else out.push({ day: key, items: [e] });
    }
    return out;
  }, [shown]);

  const lock = () => {
    dispatch(vaultLocked());
    Toast.info('Vault locked.', 1);
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async (action: 'trash' | 'restore' | 'forever') => {
    const ids = [...selected];
    if (!ids.length) return;
    setWorking(true);
    try {
      await Promise.all(ids.map(id => (action === 'forever' ? deleteEntry(id).unwrap() : flagEntry({ id, flag: action }).unwrap())));
      Toast.success(
        action === 'restore' ? `Restored ${ids.length}.` : action === 'trash' ? `Moved ${ids.length} to Deleted notes.` : `Deleted ${ids.length} for good.`,
        1.6,
      );
      setConfirm(null);
      stopSelecting();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Some notes could not be changed.'), 2);
    } finally {
      setWorking(false);
    }
  };

  const openDeleted = (value: boolean) => {
    stopSelecting();
    setShowDeleted(value);
  };

  return (
    <View style={styles.flex} onTouchStart={touchVault}>
      <Screen
        glowColor={colors.violet}
        padded={false}
        onRefresh={entries.refetch}
        refreshing={entries.isFetching && !entries.isLoading}
        footer={
          selecting ? (
            <View style={[styles.actionBar, { paddingHorizontal: gutter, bottom: barBottom }]}>
              {showDeleted ? (
                <>
                  <Button label={`Restore (${selected.size})`} variant="secondary" onPress={() => run('restore')} disabled={!selected.size || working} style={styles.flex} />
                  <Button label={`Delete (${selected.size})`} variant="danger" icon="trash" onPress={() => setConfirm('forever')} disabled={!selected.size || working} style={styles.flex} />
                </>
              ) : (
                <Button
                  label={selected.size ? `Delete ${selected.size} selected` : 'Tick notes to delete'}
                  variant="danger"
                  icon="trash"
                  onPress={() => setConfirm('trash')}
                  disabled={!selected.size || working}
                  style={styles.flex}
                />
              )}
            </View>
          ) : showDeleted ? null : (
            <Fab accessibilityLabel="New note" onPress={() => navigation.navigate('VaultEntry')} />
          )
        }
      >
        <View style={{ paddingHorizontal: gutter }}>
          <LargeTitle
            title={showDeleted ? 'Deleted notes' : 'Vault'}
            right={<IconButton icon="lock" accessibilityLabel="Lock Vault" onPress={lock} />}
          />
          {showDeleted ? (
            <Pressable onPress={() => openDeleted(false)} style={styles.back} accessibilityRole="button">
              <Icon name="chevron-left" size={16} color={colors.primary} />
              <Text style={styles.link}>Back to notes</Text>
            </Pressable>
          ) : null}

          <View style={styles.searchRow}>
            {!showDeleted ? (
              <View style={styles.search}>
                <Icon name="search" size={18} color={colors.violet} strokeWidth={1.7} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search notes"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.searchInput}
                  accessibilityLabel="Search notes"
                  autoCorrect={false}
                />
              </View>
            ) : (
              <Text style={[t.caption, styles.flex]}>Deleted notes can be restored, or deleted for good.</Text>
            )}
            {all.length ? (
              <IconButton
                icon={selecting ? 'x' : 'check-circle'}
                color={selecting ? colors.text : colors.violet}
                accessibilityLabel={selecting ? 'Stop selecting' : 'Select notes'}
                onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
              />
            ) : null}
          </View>

          {selecting ? (
            <View style={styles.selectBar}>
              <Text style={t.bodyStrong}>{selected.size} selected</Text>
              <Pressable
                onPress={() => setSelected(selected.size === shown.length ? new Set() : new Set(shown.map(e => e.id)))}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.link}>{selected.size === shown.length ? 'Clear' : 'Select all'}</Text>
              </Pressable>
            </View>
          ) : null}

          {!showDeleted ? (
            <Segmented
              options={[
                { value: 'all', label: 'All notes', count: all.length || undefined },
                { value: 'date', label: 'By date' },
              ]}
              value={mode}
              onChange={v => setMode(v as Mode)}
              style={styles.modes}
            />
          ) : null}
        </View>

        {mode === 'date' && !showDeleted ? (
          <>
            <DateStrip selected={day} today={todayKey} onSelect={setDay} marks={marks} daysBack={30} daysForward={0} />
            <View style={[styles.dayHead, { paddingHorizontal: gutter }]}>
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
                maxDate={new Date()}
                onChange={(d: Date) => setDay(toDateKey(d))}
                title="Pick a day"
              >
                <CalendarButton />
              </DatePicker>
            </View>
          </>
        ) : null}

        <View style={{ paddingHorizontal: gutter }}>
          {entries.isLoading ? (
            <SkeletonList count={4} height={72} />
          ) : entries.isError ? (
            <ErrorState message={getErrorMessage(entries.error, 'Could not open your Vault.')} onRetry={entries.refetch} />
          ) : !shown.length ? (
            <EmptyState
              compact
              icon={showDeleted ? 'trash' : 'lock'}
              title={showDeleted ? 'Nothing deleted' : query ? 'No notes found' : mode === 'date' ? 'No notes this day' : 'No notes yet'}
              message={showDeleted || query ? undefined : 'Only you can open them, with your PIN.'}
              actionLabel={showDeleted || query ? undefined : 'New note'}
              onAction={() => navigation.navigate('VaultEntry')}
            />
          ) : (
            groups.map(g => (
              <View key={g.day}>
                {mode === 'all' || showDeleted ? <Text style={styles.groupTitle}>{dayHeading(g.day, todayKey)}</Text> : null}
                {g.items.map((e, i) => {
                  const ticked = selected.has(e.id);
                  return (
                    <FadeIn key={e.id} index={i}>
                      <Card
                        onPress={() => (selecting ? toggle(e.id) : navigation.navigate('VaultEntry', { entryId: e.id }))}
                        onLongPress={() => {
                          setSelecting(true);
                          toggle(e.id);
                        }}
                        style={[styles.entry, ticked && styles.entryTicked]}
                        accessibilityLabel={`${e.title ?? 'Untitled note'}${selecting ? (ticked ? ', selected' : ', not selected') : ''}`}
                      >
                        <View style={styles.entryRow}>
                          {selecting ? (
                            <Checkbox checked={ticked} onPress={() => toggle(e.id)} accessibilityLabel={ticked ? 'Unselect' : 'Select'} />
                          ) : (
                            <RealIcon name="lock" size={30} />
                          )}
                          <View style={styles.flex}>
                            <Text style={styles.entryTitle} numberOfLines={1}>
                              {e.title || 'Untitled'}
                            </Text>
                            <Text style={[t.caption, styles.preview]} numberOfLines={1}>
                              {formatClock(e.created_at)}
                              {e.preview ? ` · ${e.preview}` : ''}
                            </Text>
                          </View>
                          {selecting ? null : <Icon name="chevron-right" size={17} color={colors.textTertiary} />}
                        </View>
                      </Card>
                    </FadeIn>
                  );
                })}
              </View>
            ))
          )}

          {!showDeleted && !selecting ? (
            <Pressable onPress={() => openDeleted(true)} style={styles.footerLink} accessibilityRole="button">
              <Icon name="trash" size={14} color={colors.textTertiary} />
              <Text style={t.caption}>Deleted notes</Text>
            </Pressable>
          ) : null}
        </View>

        <ConfirmSheet
          visible={confirm === 'trash'}
          icon="trash"
          title={`Delete ${selected.size} ${selected.size === 1 ? 'note' : 'notes'}?`}
          message="They move to Deleted notes, where you can still restore them."
          confirmLabel="Delete"
          loading={working}
          onConfirm={() => run('trash')}
          onCancel={() => setConfirm(null)}
        />
        <ConfirmSheet
          visible={confirm === 'forever'}
          icon="trash"
          destructive
          title={`Delete ${selected.size} ${selected.size === 1 ? 'note' : 'notes'} for good?`}
          message="This can’t be undone."
          confirmLabel="Delete for good"
          loading={working}
          onConfirm={() => run('forever')}
          onCancel={() => setConfirm(null)}
        />
      </Screen>
    </View>
  );
}

/** The calendar button that opens the date picker (it injects onPress). */
function CalendarButton({ onPress }: { onPress?: () => void }) {
  return <IconButton icon="calendar" accessibilityLabel="Pick a day from the calendar" onPress={() => onPress?.()} />;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
  },
  link: {
    ...font.bold,
    color: colors.primary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modes: {
    marginBottom: spacing.md,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dayTitle: {
    ...t.heading,
    flex: 1,
  },
  groupTitle: {
    ...t.micro,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  entryTicked: {
    borderColor: colors.violet,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 50,
    paddingHorizontal: spacing.lg + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.violet, 0.35),
  },
  searchInput: {
    ...font.medium,
    flex: 1,
    color: colors.text,
    paddingVertical: 0,
  },
  entry: {
    marginBottom: spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
  },
  entryTitle: {
    ...t.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  preview: {
    marginTop: 2,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xl,
  },
});
