import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { IconButton } from '../../../components/Controls';
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
  useTrackGridQuery,
  useUpdateActionMutation,
  type TrackGrid,
} from '../routinesApi';
import { useCompletion } from '../CompletionProvider';
import { CategoryTable, periodLabel } from '../components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = TrackGrid['rows'][number];

/** One category: its table of tasks × days, and a box to add tasks. */
export function TrackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { trackId } = useRoute<RouteProp<RootStackParamList, 'TrackDetail'>>().params;
  const track = useGetTrackQuery(trackId);
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
        <ErrorState message={getErrorMessage(track.error, 'Could not load this category.')} onRetry={track.refetch} />
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

  const tr = track.data;
  const rows = grid.data?.rows ?? [];

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
        right={<IconButton icon="edit" accessibilityLabel="Edit category" onPress={() => navigation.navigate('TrackEditor', { trackId })} />}
      />
      {tr ? <Text style={styles.period}>{periodLabel(tr)}</Text> : null}

      {!grid.data ? (
        <Skeleton height={160} />
      ) : rows.length ? (
        <>
          <CategoryTable
            grid={grid.data}
            onToggle={(row, isDone) => request({ actionId: row.action_id, title: row.title, isCompleted: isDone })}
            onTaskPress={row => {
              setEditing(row);
              setEditName(row.title);
            }}
          />
          <Text style={styles.hint}>Tick today’s box when you finish a task.</Text>
        </>
      ) : (
        <Text style={styles.empty}>Add your tasks below. Each task gets a box to tick every day.</Text>
      )}

      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TextField
            value={newTask}
            onChangeText={setNewTask}
            placeholder={rows.length ? 'Add another task' : 'Task name, e.g. Workout'}
            onSubmitEditing={add}
            returnKeyType="done"
            maxLength={200}
          />
        </View>
        <IconButton icon="plus" accessibilityLabel="Add task" onPress={() => !adding && add()} />
      </View>

      <Button label="Delete category" variant="ghost" onPress={() => setConfirmDelete(true)} style={styles.delete} />

      <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title="Edit task">
        <TextField value={editName} onChangeText={setEditName} placeholder="Task name" maxLength={200} />
        <Button label="Save" onPress={rename} loading={renaming} />
        <Button label="Delete task" variant="ghost" onPress={removeTask} loading={deletingTask} style={styles.mtSm} />
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  period: {
    ...t.caption,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  hint: {
    ...t.caption,
    marginTop: spacing.sm,
  },
  empty: {
    ...t.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  delete: {
    marginTop: spacing.xl,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
});
