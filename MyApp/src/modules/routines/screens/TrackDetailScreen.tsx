import React, { useState } from 'react';
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
import { ErrorState, Skeleton } from '../../../components/Feedback';
import { ConfirmSheet, Sheet } from '../../../components/Sheet';
import { getErrorMessage } from '../../../utils/apiError';
import {
  useCreateActionMutation,
  useDeleteActionMutation,
  useDeleteTrackMutation,
  useGetTrackQuery,
  useListTracksQuery,
  useTrackGridQuery,
  useUpdateActionMutation,
  type TrackGrid,
} from '../routinesApi';
import { useCompletion } from '../CompletionProvider';
import { CategoryTable, TableLegend, TodayChecklist, stageLabel } from '../components';
import { formatDayMonth } from '../../../utils/date';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = TrackGrid['rows'][number];

/**
 * One plan, top to bottom in the order a user needs it: where the plan is
 * and today's progress, today's tasks to tick, a box to add tasks, then the
 * day-by-day history.
 */
export function TrackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { trackId } = useRoute<RouteProp<RootStackParamList, 'TrackDetail'>>().params;
  const track = useGetTrackQuery(trackId);
  const tracks = useListTracksQuery({ includeArchived: true });
  const grid = useTrackGridQuery(trackId);
  const { request } = useCompletion();
  const [createTask, { isLoading: adding }] = useCreateActionMutation();
  const [updateTask, { isLoading: renaming }] = useUpdateActionMutation();
  const [deleteTask, { isLoading: deletingTask }] = useDeleteActionMutation();
  const [deleteCategory, { isLoading: deletingCategory }] = useDeleteTrackMutation();

  const [newTask, setNewTask] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (track.isError) {
    return (
      <Screen>
        <ScreenHeader />
        <ErrorState message={getErrorMessage(track.error, 'Could not load this plan.')} onRetry={track.refetch} />
      </Screen>
    );
  }

  const add = async () => {
    const title = newTask.trim();
    if (!title) return;
    try {
      await createTask({ trackId, title, repeat_type: 'DAILY' }).unwrap();
      setNewTask('');
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not add this task.'), 2);
    }
  };

  const rename = async () => {
    if (!editing || !editName.trim()) return;
    try {
      await updateTask({ id: editing.action_id, title: editName.trim() }).unwrap();
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

  const removeCategory = async () => {
    try {
      await deleteCategory(trackId).unwrap();
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const toggle = (row: Row, isDone: boolean) => request({ actionId: row.action_id, title: row.title, isCompleted: isDone });
  const openTask = (row: Row) => {
    setEditing(row);
    setEditName(row.title);
  };

  // The plans list already holds this plan, so the header shows at once.
  const tr = track.data ?? tracks.data?.find(item => item.id === trackId);
  const rows = grid.data?.rows ?? [];
  const accountTaskCount = tracks.data?.reduce((total, plan) => total + plan.action_count, 0) ?? 0;
  const taskLimitReached = (tr?.action_count ?? 0) >= 15 || accountTaskCount >= 150;

  return (
    <Screen
      onRefresh={() => {
        track.refetch();
        grid.refetch();
      }}
      refreshing={track.isFetching || grid.isFetching}
    >
      <ScreenHeader
        title={tr?.name}
        subtitle="Plan"
        right={<IconButton icon="edit" accessibilityLabel="Edit plan" onPress={() => navigation.navigate('TrackEditor', { trackId })} />}
      />
      {tr ? <Overview required={tr.today_required} completed={tr.today_completed} stage={stageLabel(tr)} dates={dateRange(tr.start_date, tr.end_date)} daysLeft={tr.days_remaining} /> : <Skeleton height={112} />}

      <SectionHeader title="Today’s tasks" style={styles.section} />
      {!grid.data ? (
        <Skeleton height={140} />
      ) : rows.length ? (
        <TodayChecklist grid={grid.data} onToggle={toggle} onTaskPress={openTask} />
      ) : (
        <Text style={styles.empty}>No tasks yet. Add something small you will do every day, like “Read 10 pages”.</Text>
      )}

      {/* The add box sits under the list, so new tasks appear right above it. */}
      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TextField
            value={newTask}
            onChangeText={setNewTask}
            placeholder={taskLimitReached ? 'Task limit reached' : rows.length ? 'Add another daily task' : 'Add a daily task, e.g. Workout'}
            onSubmitEditing={() => {
              if (!adding && !taskLimitReached) add();
            }}
            returnKeyType="done"
            blurOnSubmit={false}
            maxLength={200}
            editable={!adding && !taskLimitReached}
          />
        </View>
        <IconButton
          icon="plus"
          size={22}
          color={colors.gold}
          style={styles.addButton}
          accessibilityLabel={taskLimitReached ? 'Task limit reached' : 'Add task'}
          onPress={() => {
            if (taskLimitReached) {
              Toast.info('Task limit reached. Remove a task to add another.', 2);
            } else if (!adding) {
              add();
            }
          }}
        />
      </View>
      {taskLimitReached ? <Text style={styles.limit}>A plan can have up to 15 tasks, with 150 across your account.</Text> : null}

      {grid.data && rows.length ? (
        <>
          <SectionHeader title="History" style={styles.section} />
          <CategoryTable grid={grid.data} onToggle={toggle} onTaskPress={openTask} />
          <TableLegend />
        </>
      ) : null}

      <Button label="Delete plan" icon="trash" variant="dangerGhost" onPress={() => setConfirmDelete(true)} style={styles.delete} />

      <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title="Edit task">
        <TextField value={editName} onChangeText={setEditName} placeholder="Task name" maxLength={200} />
        <Button label="Save" onPress={rename} loading={renaming} />
        <Button label="Delete task" icon="trash" variant="dangerGhost" onPress={removeTask} loading={deletingTask} style={styles.mtSm} />
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        destructive
        icon="trash"
        title={`Delete “${tr?.name ?? ''}”?`}
        message="Its tasks will be removed. Your streak history stays."
        confirmLabel="Delete"
        loading={deletingCategory}
        onConfirm={removeCategory}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

function dateRange(start: string, end: string | null) {
  return `${formatDayMonth(start)} – ${end ? formatDayMonth(end) : 'ongoing'}`;
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
        <Text style={styles.overviewTitle}>{required === 0 ? 'Nothing due today' : allDone ? 'All done today' : `${required - done} left today`}</Text>
        <Text style={styles.overviewMeta}>
          {dates}
          {daysLeft ? ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : ''}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
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
  flex: {
    flex: 1,
  },
  limit: {
    ...t.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  empty: {
    ...t.caption,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  addRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  delete: {
    marginTop: spacing.xl,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
});
