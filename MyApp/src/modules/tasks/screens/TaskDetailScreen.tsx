import React, { useLayoutEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from '@ant-design/react-native/lib/modal';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { ErrorState } from '../../../components/ErrorState';
import { SectionCard } from '../../../components/SectionCard';
import { ChecklistRow } from '../../../components/ChecklistRow';
import { AddRow } from '../../../components/AddRow';
import { AppButton } from '../../../components/AppButton';
import { PriorityTag } from '../../../components/Tags';
import { border, colors, fontSize, radius, spacing, typography } from '../../../theme';
import { formatDateTime } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import { useListCategoriesQuery } from '../../categories/categoriesApi';
import {
  useAddTaskChecklistItemMutation,
  useCompleteTaskMutation,
  useDeleteTaskChecklistItemMutation,
  useDeleteTaskMutation,
  useGetTaskQuery,
  useUncompleteTaskMutation,
  useUpdateTaskChecklistItemMutation,
} from '../tasksApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'TaskDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;

export function TaskDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { taskId } = route.params;

  const { data: task, isLoading, isError, error, refetch } = useGetTaskQuery(taskId);
  const { data: categories } = useListCategoriesQuery({ includeArchived: true });
  const [completeTask, { isLoading: isCompleting }] = useCompleteTaskMutation();
  const [uncompleteTask, { isLoading: isUncompleting }] = useUncompleteTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [addChecklistItem] = useAddTaskChecklistItemMutation();
  const [updateChecklistItem] = useUpdateTaskChecklistItemMutation();
  const [deleteChecklistItem] = useDeleteTaskChecklistItemMutation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: task?.title ?? 'Task',
      headerRight: () =>
        task ? (
          <TouchableOpacity onPress={() => navigation.navigate('CreateEditTask', { taskId: task.id })}>
            <Text style={styles.headerAction}>Edit</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, task]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingView label="Loading task…" />
      </ScreenContainer>
    );
  }

  if (isError || !task) {
    return (
      <ScreenContainer>
        <ErrorState message={getErrorMessage(error, 'Could not load this task.')} onRetry={refetch} />
      </ScreenContainer>
    );
  }

  const category = categories?.find(c => c.id === task.category_id);
  const isCompleted = task.status === 'COMPLETED';

  const handleToggleComplete = async () => {
    try {
      if (isCompleted) {
        await uncompleteTask(taskId).unwrap();
      } else {
        await completeTask(taskId).unwrap();
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not update task.'));
    }
  };

  const handleDelete = () => {
    Modal.alert('Delete task', 'This cannot be undone.', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(taskId).unwrap();
            navigation.goBack();
          } catch (err) {
            Toast.fail(getErrorMessage(err, 'Could not delete task.'));
          }
        },
      },
    ]);
  };

  const handleAddChecklistItem = async (title: string) => {
    try {
      await addChecklistItem({ taskId, title }).unwrap();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not add step.'));
    }
  };

  const handleToggleChecklistItem = async (itemId: string, nextCompleted: boolean) => {
    try {
      await updateChecklistItem({ id: itemId, taskId, is_completed: nextCompleted }).unwrap();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not update step.'));
    }
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    try {
      await deleteChecklistItem({ id: itemId, taskId }).unwrap();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not remove step.'));
    }
  };

  const sortedChecklist = [...task.checklist_items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <ScreenContainer scroll contentStyle={styles.content} edges={[]}>
      <SectionCard>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{task.title}</Text>
          <PriorityTag priority={task.priority} />
        </View>

        <View style={styles.metaRow}>
          {category ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{category.name}</Text>
            </View>
          ) : null}
          {task.scheduled_at ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{formatDateTime(task.scheduled_at)}</Text>
            </View>
          ) : null}
        </View>

        {task.description ? <Text style={styles.description}>{task.description}</Text> : null}

        <AppButton
          label={isCompleted ? '✓ Completed — tap to reopen' : 'Mark as complete'}
          variant={isCompleted ? 'secondary' : 'primary'}
          onPress={handleToggleComplete}
          disabled={isCompleting || isUncompleting}
          style={styles.completeButton}
        />
      </SectionCard>

      <SectionCard title="Checklist" subtitle={`${sortedChecklist.filter(i => i.is_completed).length}/${sortedChecklist.length} done`}>
        {sortedChecklist.length === 0 ? (
          <Text style={styles.emptyChecklist}>No steps yet — break this task down if it helps.</Text>
        ) : (
          sortedChecklist.map(item => (
            <ChecklistRow
              key={item.id}
              title={item.title}
              checked={item.is_completed}
              onToggle={() => handleToggleChecklistItem(item.id, !item.is_completed)}
              onRemove={() => handleRemoveChecklistItem(item.id)}
            />
          ))
        )}
        <AddRow placeholder="Add a step…" onAdd={handleAddChecklistItem} />
      </SectionCard>

      <AppButton label="Delete task" variant="danger" onPress={handleDelete} style={styles.deleteButton} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  headerAction: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: fontSize.md,
    marginRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    ...typography.h1,
    flex: 1,
    fontSize: fontSize.xl,
    marginRight: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  metaPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  metaPillText: {
    fontSize: fontSize.xs,
    color: colors.ink,
    fontWeight: '700',
  },
  description: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 21,
  },
  completeButton: {
    marginTop: spacing.lg,
  },
  emptyChecklist: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    paddingVertical: spacing.sm,
  },
  deleteButton: {
    marginTop: spacing.lg,
  },
});
