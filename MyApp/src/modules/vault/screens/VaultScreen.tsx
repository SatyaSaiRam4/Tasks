import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from '@ant-design/react-native/lib/toast';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { colors, font, radius, spacing, type as t, withAlpha } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { RealIcon } from '../../../components/RealIcon';
import { Fab, IconButton, Segmented } from '../../../components/Controls';
import { DateStrip, type DayMark } from '../../../components/DateStrip';
import { useLayout } from '../../../hooks/useLayout';
import { diffDays, formatClock, formatFullDate, fromDateKey, relativeDayLabel, toDateKey } from '../../../utils/date';
import { EmptyState, ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { selectVaultUnlocked, vaultLocked } from '../vaultSlice';
import { touchVault } from '../VaultAutoLock';
import { VaultLock } from '../VaultLock';
import {
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
 * day at a time (date strip and calendar, like Reminders). The search icon
 * at the end of the All notes / By date row turns that row into the search
 * box, so search adds no row of its own. The bin icon by
 * the lock opens the bin: deleted notes wait there for 30 days (open one to
 * restore it or delete it for good), then the daily cleanup removes them.
 */
function UnlockedVault() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { gutter } = useLayout();
  const todayKey = toDateKey(new Date());
  const [showDeleted, setShowDeleted] = useState(false);
  const [mode, setMode] = useState<Mode>('all');
  const [day, setDay] = useState(todayKey);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const entries = useListVaultEntriesQuery({ view: showDeleted ? 'trash' : 'all', q: query.trim() || undefined });

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

  const openDeleted = (value: boolean) => setShowDeleted(value);

  return (
    <View style={styles.flex} onTouchStart={touchVault}>
      <Screen
        glowColor={colors.violet}
        padded={false}
        onRefresh={entries.refetch}
        refreshing={entries.isFetching && !entries.isLoading}
        footer={showDeleted ? null : <Fab accessibilityLabel="New note" onPress={() => navigation.navigate('VaultEntry')} />}
      >
        <View style={{ paddingHorizontal: gutter }}>
          <LargeTitle
            title={showDeleted ? 'Bin' : 'Vault'}
            right={
              <View style={styles.titleIcons}>
                {showDeleted ? null : <IconButton icon="trash" accessibilityLabel="Open the bin" onPress={() => openDeleted(true)} />}
                <IconButton icon="lock" accessibilityLabel="Lock Vault" onPress={lock} />
              </View>
            }
          />
          {showDeleted ? (
            <Pressable onPress={() => openDeleted(false)} style={styles.back} accessibilityRole="button">
              <Icon name="chevron-left" size={16} color={colors.primary} />
              <Text style={styles.link}>Back to notes</Text>
            </Pressable>
          ) : null}

          {showDeleted ? (
            <View style={[styles.binNote, styles.modes]}>
              <Icon name="clock" size={15} color={colors.textSecondary} />
              <Text style={[t.caption, styles.flex]}>
                Deleted notes stay here for 30 days, then they’re deleted for good. Open one to restore it.
              </Text>
            </View>
          ) : (
            // One row: the All notes / By date switch with a search icon; the icon
            // turns the same row into the search box.
            <View style={[styles.searchRow, styles.modes]}>
              {searching ? (
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
                    autoFocus
                  />
                </View>
              ) : (
                <Segmented
                  options={[
                    { value: 'all', label: 'All notes', count: all.length || undefined },
                    { value: 'date', label: 'By date' },
                  ]}
                  value={mode}
                  onChange={v => setMode(v as Mode)}
                  style={styles.flex}
                />
              )}
              <IconButton
                icon={searching ? 'x' : 'search'}
                color={searching ? colors.text : colors.violet}
                accessibilityLabel={searching ? 'Close search' : 'Search notes'}
                onPress={() => {
                  if (searching) setQuery('');
                  setSearching(v => !v);
                }}
              />
            </View>
          )}
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
                title="Notes from which day?"
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
                {g.items.map((e, i) => (
                    <FadeIn key={e.id} index={i}>
                      <Card
                        onPress={() => navigation.navigate('VaultEntry', { entryId: e.id })}
                        style={styles.entry}
                        accessibilityLabel={e.title ?? 'Untitled note'}
                      >
                        <View style={styles.entryRow}>
                          <RealIcon name="lock" size={30} />
                          <View style={styles.flex}>
                            <Text style={styles.entryTitle} numberOfLines={1}>
                              {e.title || 'Untitled'}
                            </Text>
                            <Text style={[t.caption, styles.preview]} numberOfLines={1}>
                              {formatClock(e.created_at)}
                              {e.has_audio ? ` · 🎙 ${Math.floor((e.audio_seconds ?? 0) / 60)}:${String((e.audio_seconds ?? 0) % 60).padStart(2, '0')}` : ''}
                              {e.preview ? ` · ${e.preview}` : ''}
                            </Text>
                          </View>
                          <Icon name="chevron-right" size={17} color={colors.textTertiary} />
                        </View>
                      </Card>
                    </FadeIn>
                ))}
              </View>
            ))
          )}

        </View>

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
  titleIcons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  binNote: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
});
