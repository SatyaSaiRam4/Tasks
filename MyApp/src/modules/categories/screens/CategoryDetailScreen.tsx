import React, { useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from '@ant-design/react-native/lib/modal';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { ErrorState } from '../../../components/ErrorState';
import { EmptyState } from '../../../components/EmptyState';
import { Panel } from '../../../components/Panel';
import { AppButton } from '../../../components/AppButton';
import { Fab } from '../../../components/Fab';
import { DateStrip, type DayCompletion } from '../../../components/DateStrip';
import { PriorityTag } from '../../../components/Tags';
import { border, colors, fontSize, radius, spacing } from '../../../theme';
import { isSameDay, parseIso } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import {
  useArchiveCategoryMutation,
  useGetCategoryQuery,
  useRestoreCategoryMutation,
} from '../categoriesApi';
import { useCompleteTaskMutation, useListTasksQuery, useUncompleteTaskMutation, type TaskOut } from '../../tasks/tasksApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'CategoryDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'CategoryDetail'>;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** A task's "day" is its scheduled date, falling back to when it was created if never scheduled. */
function taskDate(task: TaskOut): Date {
  return parseIso(task.scheduled_at) ?? parseIso(task.created_at) ?? new Date();
}

function TaskRow({
  task,
  onPress,
  onToggleComplete,
}: {
  task: TaskOut;
  onPress: () => void;
  onToggleComplete: () => void;
}) {
  const isCompleted = task.status === 'COMPLETED';
  const total = task.checklist_items.length;
  const done = task.checklist_items.filter(i => i.is_completed).length;

  return (
    <TouchableOpacity style={styles.rowWrap} onPress={onPress} activeOpacity={0.85}>
      <Panel contentStyle={styles.row} shadowOffset={4}>
        <TouchableOpacity
          style={[styles.checkCircle, isCompleted && styles.checkCircleDone]}
          onPress={onToggleComplete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isCompleted ? <Text style={styles.checkMark}>✓</Text> : null}
        </TouchableOpacity>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, isCompleted && styles.rowTitleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          {total > 0 ? (
            <Text style={styles.rowMeta}>
              {done}/{total} checklist steps done
            </Text>
          ) : null}
        </View>
        <PriorityTag priority={task.priority} />
      </Panel>
    </TouchableOpacity>
  );
}

export function CategoryDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { categoryId, categoryName } = route.params;

  const { data: category, isLoading, isError, error, refetch } = useGetCategoryQuery(categoryId);
  const {
    data: tasks,
    isLoading: isLoadingTasks,
    isError: isTasksError,
    error: tasksError,
    refetch: refetchTasks,
  } = useListTasksQuery({ category_id: categoryId });
  const [completeTask] = useCompleteTaskMutation();
  const [uncompleteTask] = useUncompleteTaskMutation();
  const [archiveCategory] = useArchiveCategoryMutation();
  const [restoreCategory] = useRestoreCategoryMutation();

  const [selectedDate, setSelectedDate] = useState(() => new Date());

  useLayoutEffect(() => {
    navigation.setOptions({ title: category?.name ?? categoryName ?? 'Category' });
  }, [navigation, category?.name, categoryName]);

  const completionByDate = useMemo(() => {
    const map: Record<string, DayCompletion> = {};
    for (const task of tasks ?? []) {
      const key = dateKey(taskDate(task));
      const entry = map[key] ?? { total: 0, done: 0 };
      entry.total += 1;
      if (task.status === 'COMPLETED') entry.done += 1;
      map[key] = entry;
    }
    return map;
  }, [tasks]);

  const tasksForSelectedDay = useMemo(
    () => (tasks ?? []).filter(t => isSameDay(taskDate(t), selectedDate)).sort((a, b) => a.title.localeCompare(b.title)),
    [tasks, selectedDate],
  );

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingView label="Loading category…" />
      </ScreenContainer>
    );
  }

  if (isError || !category) {
    return (
      <ScreenContainer>
        <ErrorState message={getErrorMessage(error, 'Could not load this category.')} onRetry={refetch} />
      </ScreenContainer>
    );
  }

  const isArchived = category.is_archived;

  const handleToggleComplete = async (task: TaskOut) => {
    try {
      if (task.status === 'COMPLETED') {
        await uncompleteTask(task.id).unwrap();
      } else {
        await completeTask(task.id).unwrap();
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not update task.'));
    }
  };

  const handleArchiveToggle = () => {
    const action = isArchived ? 'restore' : 'archive';
    Modal.alert(
      isArchived ? 'Restore category' : 'Archive category',
      isArchived
        ? 'This category will show up in your active list again.'
        : 'Archived categories are hidden from your main list but not deleted.',
      [
        { text: 'Cancel' },
        {
          text: isArchived ? 'Restore' : 'Archive',
          onPress: async () => {
            try {
              if (isArchived) {
                await restoreCategory(categoryId).unwrap();
              } else {
                await archiveCategory(categoryId).unwrap();
              }
            } catch (err) {
              Toast.fail(getErrorMessage(err, `Could not ${action} category.`));
            }
          },
        },
      ],
    );
  };

  const handleAddTask = () => {
    navigation.navigate('CreateEditTask', { categoryId, date: selectedDate.toISOString() });
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content} edges={[]}>
      {isArchived ? (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedBannerText}>This category is archived.</Text>
        </View>
      ) : null}

      <DateStrip selectedDate={selectedDate} onSelect={setSelectedDate} completionByDate={completionByDate} />

      <View style={styles.list}>
        {isLoadingTasks ? (
          <LoadingView label="Loading tasks…" fullscreen={false} />
        ) : isTasksError ? (
          <ErrorState message={getErrorMessage(tasksError, 'Could not load tasks.')} onRetry={refetchTasks} />
        ) : tasksForSelectedDay.length === 0 ? (
          <EmptyState
            glyph="🗓️"
            title="Nothing for this day"
            subtitle="Add a task with its own checklist to get started."
            actionLabel="Add task"
            onAction={handleAddTask}
          />
        ) : (
          tasksForSelectedDay.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              onToggleComplete={() => handleToggleComplete(task)}
            />
          ))
        )}
      </View>

      <AppButton
        label={isArchived ? 'Restore category' : 'Archive category'}
        variant="secondary"
        onPress={handleArchiveToggle}
        style={styles.archiveButton}
      />

      <Fab onPress={handleAddTask} accessibilityLabel="Add task" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 100,
  },
  archivedBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    padding: spacing.md,
  },
  archivedBannerText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  rowWrap: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: border.thick,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkCircleDone: {
    backgroundColor: colors.success,
  },
  checkMark: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 15,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  rowTitleDone: {
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  rowMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  archiveButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
});
