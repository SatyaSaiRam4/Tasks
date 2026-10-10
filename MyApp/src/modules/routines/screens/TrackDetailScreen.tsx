import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, gradients, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { IconButton, SectionHeader } from '../../../components/Controls';
import { Card } from '../../../components/Card';
import { Icon } from '../../../components/Icon';
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
import { CategoryTable, TableLegend, stageLabel } from '../components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = TrackGrid['rows'][number];

/** A plan can hold up to this many tasks. */
const MAX_TASKS = 15;

/**
 * One plan: where it is today, then its tasks date by date (tasks down the
 * side, days across, today's column in gold to tick), then a box to add a
 * task, optionally only until a date. Editing and deleting the plan sit
 * behind small icons in the header. A plan just created opens with the add
 * box first, as step 2 of making a plan.
 */
export function TrackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { trackId, created } = useRoute<RouteProp<RootStackParamList, 'TrackDetail'>>().params;
  const track = useGetTrackQuery(trackId);
  const tracks = useListTracksQuery();
  const grid = useTrackGridQuery(trackId);
  const actions = useListTrackActionsQuery(trackId);
  const { request } = useCompletion();
  const [createTask, { isLoading: adding }] = useCreateActionMutation();
  const [updateTask, { isLoading: saving }] = useUpdateActionMutation();
  const [deleteTask, { isLoading: deletingTask }] = useDeleteActionMutation();
  const [deletePlan, { isLoading: deletingPlan }] = useDeleteTrackMutation();

  // One sheet for both adding and editing a task.
  const [sheet, setSheet] = useState<{ mode: 'new' } | { mode: 'edit'; row: Row } | null>(created ? { mode: 'new' } : null);
  const [taskName, setTaskName] = useState('');
  const [taskUntil, setTaskUntil] = useState<string | null>(null);
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

  const openNew = () => {
    if (taskLimitReached) {
      Toast.info(`A plan can have up to ${MAX_TASKS} tasks. Delete one to add another.`, 2.5);
      return;
    }
    setTaskName('');
    setTaskUntil(null);
    setSheet({ mode: 'new' });
  };

  const openTask = (row: Row) => {
    setTaskName(row.title);
    setTaskUntil(untilById.get(row.action_id) ?? null);
    setSheet({ mode: 'edit', row });
  };

  const saveTask = async () => {
    const title = taskName.trim();
    if (!sheet || !title) return;
    try {
      if (sheet.mode === 'new') {
        await createTask({ trackId, title, repeat_type: 'DAILY', end_date: taskUntil }).unwrap();
        // Stay open for the next one: most plans get a few tasks at once.
        setTaskName('');
        setTaskUntil(null);
        Toast.success('Task added.', 1);
        if ((tr?.action_count ?? 0) + 1 >= MAX_TASKS) setSheet(null);
      } else {
        await updateTask({
          id: sheet.row.action_id,
          title,
          ...(taskUntil ? { end_date: taskUntil } : { clear_end_date: true }),
        }).unwrap();
        setSheet(null);
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not save this task.'), 2);
    }
  };

  const removeTask = async () => {
    if (sheet?.mode !== 'edit') return;
    try {
      await deleteTask(sheet.row.action_id).unwrap();
      setSheet(null);
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
  const untilLine = (row: Row) => {
    const until = untilById.get(row.action_id);
    return until ? `until ${formatDayMonth(until)}` : undefined;
  };
  const firstTask = !rows.length && Boolean(grid.data);

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

      <View style={styles.addBar}>
        <Pressable
          onPress={openNew}
          style={({ pressed }) => [styles.addPill, taskLimitReached && styles.addPillOff, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add task"
        >
          <Icon name="plus" size={15} color={taskLimitReached ? colors.textTertiary : colors.onPrimary} strokeWidth={2.4} />
          <Text style={[styles.addPillText, taskLimitReached && styles.addPillTextOff]}>Add task</Text>
        </Pressable>
        {firstTask ? (
          <Text style={[t.caption, styles.flex]}>Step 2: add the daily tasks for this plan.</Text>
        ) : (
          <Text style={[t.caption, styles.flex]} numberOfLines={1}>
            {tr?.action_count ?? rows.length} of {MAX_TASKS} tasks
          </Text>
        )}
      </View>

      {rows.length ? (
        <>
          <SectionHeader title="Tasks by date" style={styles.section} />
          {grid.data ? (
            <CategoryTable grid={grid.data} onToggle={toggle} onTaskPress={openTask} subtitle={untilLine} />
          ) : (
            <Skeleton height={160} rounded={20} />
          )}
          <TableLegend />
          <Text style={styles.hint}>Tick a box in today’s gold column when you finish that task. Tap a task’s name to edit it.</Text>
        </>
      ) : !grid.data ? (
        <Skeleton height={160} rounded={20} style={styles.section} />
      ) : null}

      <Sheet visible={Boolean(sheet)} onClose={() => setSheet(null)} title={sheet?.mode === 'edit' ? 'Edit task' : 'New task'}>
        <TextField
          label="Task"
          value={taskName}
          onChangeText={setTaskName}
          placeholder="e.g. Walk 20 minutes"
          maxLength={200}
          autoFocus={sheet?.mode === 'new'}
          returnKeyType="done"
          onSubmitEditing={saveTask}
          blurOnSubmit={false}
        />
        <DateField
          label="Until (optional)"
          value={taskUntil}
          onChange={setTaskUntil}
          placeholder="Every day until the plan ends"
          minDate={today}
          maxDate={tr?.end_date ?? undefined}
          clearable
        />
        <Button
          label={sheet?.mode === 'edit' ? 'Save' : 'Add task'}
          icon={sheet?.mode === 'edit' ? undefined : 'plus'}
          onPress={saveTask}
          loading={adding || saving}
          disabled={!taskName.trim()}
        />
        {sheet?.mode === 'edit' ? (
          <Button label="Delete task" icon="trash" variant="dangerGhost" onPress={removeTask} loading={deletingTask} style={styles.mtSm} />
        ) : (
          <Button label="Done" variant="ghost" onPress={() => setSheet(null)} style={styles.mtSm} />
        )}
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
  hint: {
    ...t.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  addPillOff: {
    backgroundColor: colors.glassStrong,
  },
  addPillText: {
    ...font.bold,
    fontSize: 13.5,
    color: colors.onPrimary,
  },
  addPillTextOff: {
    color: colors.textTertiary,
  },
});
