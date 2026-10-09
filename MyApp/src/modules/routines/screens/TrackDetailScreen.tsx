import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, gradients, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { IconButton, SectionHeader } from '../../../components/Controls';
import { Card } from '../../../components/Card';
import { ProgressRing } from '../../../components/Progress';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { DateField } from '../../../components/PickerFields';
import { ErrorState, Skeleton } from '../../../components/Feedback';
import { ConfirmSheet, Sheet } from '../../../components/Sheet';
import { getErrorMessage } from '../../../utils/apiError';
import { formatDayMonth, toDateKey } from '../../../utils/date';
import {
  useCreateActionMutation,
  useDeleteActionMutation,
  useDeleteTrackMutation,
  useGetTrackQuery,
  useListTrackActionsQuery,
  useListTracksQuery,
  useTrackGridQuery,
  useUpdateActionMutation,
  type TrackGrid,
} from '../routinesApi';
import { useCompletion } from '../CompletionProvider';
import { CategoryTable, TableLegend, TodayChecklist, stageLabel } from '../components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = TrackGrid['rows'][number];

/** A plan can hold up to this many tasks. */
const MAX_TASKS = 15;

/**
 * One plan, kept to what matters today: where the plan is, today's tasks to
 * tick, and a box to add a task (optionally only until a date). The history
 * table, editing and deleting sit behind small icons in the header.
 */
export function TrackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { trackId } = useRoute<RouteProp<RootStackParamList, 'TrackDetail'>>().params;
  const track = useGetTrackQuery(trackId);
  const tracks = useListTracksQuery();
  const grid = useTrackGridQuery(trackId);
  const actions = useListTrackActionsQuery(trackId);
  const { request } = useCompletion();
  const [createTask, { isLoading: adding }] = useCreateActionMutation();
  const [updateTask, { isLoading: saving }] = useUpdateActionMutation();
  const [deleteTask, { isLoading: deletingTask }] = useDeleteActionMutation();
  const [deletePlan, { isLoading: deletingPlan }] = useDeleteTrackMutation();

  const [newTask, setNewTask] = useState('');
  const [newUntil, setNewUntil] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState('');
  const [editUntil, setEditUntil] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const untilById = useMemo(() => new Map((actions.data ?? []).map(a => [a.id, a.end_date])), [actions.data]);

  if (track.isError) {
    return (
      <Screen>
        <ScreenHeader />
        <ErrorState message={getErrorMessage(track.error, 'Could not load this plan.')} onRetry={track.refetch} />
      </Screen>
    );
  }

  // The plans list already holds this plan, so the header shows at once.
  const tr = track.data ?? tracks.data?.find(item => item.id === trackId);
  const rows = grid.data?.rows ?? [];
  const today = toDateKey(new Date());
  const taskLimitReached = (tr?.action_count ?? 0) >= MAX_TASKS;

  const add = async () => {
    const title = newTask.trim();
    if (!title) return;
    try {
      await createTask({ trackId, title, repeat_type: 'DAILY', end_date: newUntil }).unwrap();
      setNewTask('');
      setNewUntil(null);
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not add this task.'), 2);
    }
  };

  const openTask = (row: Row) => {
    setEditing(row);
    setEditName(row.title);
    setEditUntil(untilById.get(row.action_id) ?? null);
  };

  const saveTask = async () => {
    if (!editing || !editName.trim()) return;
    try {
      await updateTask({
        id: editing.action_id,
        title: editName.trim(),
        ...(editUntil ? { end_date: editUntil } : { clear_end_date: true }),
      }).unwrap();
      setEditing(null);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const removeTask = async () => {
    if (!editing) return;
    try {
      await deleteTask(editing.action_id).unwrap();
      setEditing(null);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const removePlan = async () => {
    try {
      await deletePlan(trackId).unwrap();
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const toggle = (row: Row, isDone: boolean) => request({ actionId: row.action_id, title: row.title, isCompleted: isDone });
  const taskLine = (row: Row) => {
    const until = untilById.get(row.action_id);
    return until ? `Every day until ${formatDayMonth(until)}` : 'Every day';
  };

  return (
    <Screen
      onRefresh={() => {
        track.refetch();
        grid.refetch();
        actions.refetch();
      }}
      refreshing={track.isFetching || grid.isFetching}
    >
      <ScreenHeader
        title={tr?.name}
        right={
          <View style={styles.headerIcons}>
            <IconButton icon="calendar" accessibilityLabel="History" onPress={() => setShowHistory(true)} />
            <IconButton icon="edit" accessibilityLabel="Edit plan" onPress={() => navigation.navigate('TrackEditor', { trackId })} />
            <IconButton icon="trash" color={colors.danger} accessibilityLabel="Delete plan" onPress={() => setConfirmDelete(true)} />
          </View>
        }
      />
      {tr ? (
        <Overview
          required={tr.today_required}
          completed={tr.today_completed}
          stage={stageLabel(tr)}
          dates={`${formatDayMonth(tr.start_date)} – ${tr.end_date ? formatDayMonth(tr.end_date) : 'ongoing'}`}
          daysLeft={tr.days_remaining}
        />
      ) : (
        <Skeleton height={112} rounded={20} />
      )}

      <SectionHeader title="Today’s tasks" style={styles.section} />
      {!grid.data ? (
        <Skeleton height={140} rounded={20} />
      ) : rows.length ? (
        <TodayChecklist grid={grid.data} onToggle={toggle} onTaskPress={openTask} subtitle={taskLine} />
      ) : (
        <Text style={styles.empty}>No tasks yet. Add something small you will do every day, like “Read 10 pages”.</Text>
      )}

      <Card style={styles.addCard} contentStyle={styles.addContent}>
        <Text style={t.bodyStrong}>{taskLimitReached ? 'This plan is full' : 'Add a task'}</Text>
        {taskLimitReached ? (
          <Text style={[t.caption, styles.mtXs]}>A plan can have up to {MAX_TASKS} tasks. Delete one to add another.</Text>
        ) : (
          <>
            <View style={styles.addRow}>
              <View style={styles.flex}>
                <TextField
                  value={newTask}
                  onChangeText={setNewTask}
                  placeholder="e.g. Walk 20 minutes"
                  onSubmitEditing={() => {
                    if (!adding) add();
                  }}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  maxLength={200}
                  editable={!adding}
                />
              </View>
              <IconButton
                icon="plus"
                size={22}
                color={colors.gold}
                style={styles.addButton}
                accessibilityLabel="Add task"
                onPress={() => {
                  if (!adding) add();
                }}
              />
            </View>
            <DateField
              label="Until (optional)"
              value={newUntil}
              onChange={setNewUntil}
              placeholder="Every day until the plan ends"
              minDate={today}
              maxDate={tr?.end_date ?? undefined}
              clearable
            />
          </>
        )}
      </Card>

      <Sheet visible={showHistory} onClose={() => setShowHistory(false)} title="History">
        {grid.data && rows.length ? (
          <>
            <CategoryTable grid={grid.data} onToggle={toggle} onTaskPress={row => {
              setShowHistory(false);
              openTask(row);
            }} />
            <TableLegend />
          </>
        ) : (
          <Text style={styles.empty}>History appears here once you add tasks.</Text>
        )}
      </Sheet>

      <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title="Edit task">
        <TextField label="Task" value={editName} onChangeText={setEditName} placeholder="Task name" maxLength={200} />
        <DateField
          label="Until (optional)"
          value={editUntil}
          onChange={setEditUntil}
          placeholder="Every day until the plan ends"
          minDate={today}
          maxDate={tr?.end_date ?? undefined}
          clearable
        />
        <Button label="Save" onPress={saveTask} loading={saving} />
        <Button label="Delete task" icon="trash" variant="dangerGhost" onPress={removeTask} loading={deletingTask} style={styles.mtSm} />
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        destructive
        icon="trash"
        title={`Delete “${tr?.name ?? ''}”?`}
        message="Its tasks will be removed. Your streak points stay."
        confirmLabel="Delete"
        loading={deletingPlan}
        onConfirm={removePlan}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

/** The plan at a glance: today's ring, where the plan is, and its dates. */
function Overview({
  required,
  completed,
  stage,
  dates,
  daysLeft,
}: {
  required: number;
  completed: number;
  stage: string;
  dates: string;
  daysLeft: number | null;
}) {
  const done = Math.min(completed, required);
  const allDone = required > 0 && done >= required;
  return (
    <Card tone="hero" contentStyle={styles.overview}>
      <ProgressRing progress={required ? done / required : 0} size={76} stroke={6} colorsPair={allDone ? gradients.success : gradients.primary}>
        <Text style={styles.ringText}>{required ? `${done}/${required}` : '–'}</Text>
      </ProgressRing>
      <View style={styles.flex}>
        <Text style={t.micro}>{stage}</Text>
        <Text style={styles.overviewTitle}>
          {required === 0 ? 'Nothing due today' : allDone ? 'Done today · +1 streak' : `${required - done} left today`}
        </Text>
        <Text style={styles.overviewMeta}>
          {dates}
          {daysLeft ? ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : ''}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  overview: {
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
  overviewTitle: {
    ...font.serif,
    fontSize: 22,
    lineHeight: 26,
    color: colors.heroText,
    marginTop: 2,
  },
  overviewMeta: {
    ...t.caption,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  empty: {
    ...t.caption,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  addCard: {
    marginTop: spacing.lg,
  },
  addContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  mtXs: {
    marginTop: 4,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
});
