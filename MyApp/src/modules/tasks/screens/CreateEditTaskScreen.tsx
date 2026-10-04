import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import Input from '@ant-design/react-native/lib/input';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { LabeledInput } from '../../../components/LabeledInput';
import { ChecklistRow } from '../../../components/ChecklistRow';
import { AddRow } from '../../../components/AddRow';
import { AppButton } from '../../../components/AppButton';
import { SelectSheet, type SelectOption } from '../../../components/SelectSheet';
import { border, colors, fontSize, priorityColors, priorityLabels, radius, spacing, typography } from '../../../theme';
import { formatDateTime } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import { useListCategoriesQuery } from '../../categories/categoriesApi';
import { useCreateTaskMutation, useGetTaskQuery, useUpdateTaskMutation, type TaskPriority } from '../tasksApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'CreateEditTask'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'CreateEditTask'>;

const PRIORITY_OPTIONS: SelectOption<TaskPriority>[] = (['LOW', 'NORMAL', 'HIGH'] as TaskPriority[]).map(p => ({
  label: priorityLabels[p],
  value: p,
  color: priorityColors[p],
}));

export function CreateEditTaskScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const taskId = route.params?.taskId;
  const isEditing = Boolean(taskId);

  const { data: existingTask, isLoading: isLoadingTask } = useGetTaskQuery(taskId ?? '', { skip: !taskId });
  const { data: categories } = useListCategoriesQuery({ includeArchived: false });
  const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();
  const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(route.params?.categoryId);
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(() =>
    route.params?.date ? new Date(route.params.date) : null,
  );
  const [checklistDrafts, setChecklistDrafts] = useState<string[]>([]);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showPrioritySheet, setShowPrioritySheet] = useState(false);

  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description ?? '');
      setCategoryId(existingTask.category_id ?? undefined);
      setPriority(existingTask.priority);
      setScheduledAt(existingTask.scheduled_at ? new Date(existingTask.scheduled_at) : null);
    }
  }, [existingTask]);

  const categoryOptions: SelectOption<string>[] = (categories ?? []).map(c => ({ label: c.name, value: c.id }));
  const selectedCategory = categories?.find(c => c.id === categoryId);

  const isSaving = isCreating || isUpdating;
  const canSave = title.trim().length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (isEditing && taskId) {
        await updateTask({
          id: taskId,
          title: title.trim(),
          description: description.trim() || null,
          category_id: categoryId ?? null,
          priority,
          scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
        }).unwrap();
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          category_id: categoryId,
          priority,
          scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
          checklist: checklistDrafts.length ? checklistDrafts.map(t => ({ title: t })) : undefined,
        }).unwrap();
      }
      navigation.goBack();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not save task.'));
    }
  };

  if (isEditing && isLoadingTask) {
    return (
      <ScreenContainer>
        <LoadingView label="Loading task…" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentStyle={styles.content} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LabeledInput label="Title" value={title} onChangeText={setTitle} placeholder="What needs to happen?" />

        <Text style={styles.label}>Category</Text>
        <TouchableOpacity style={styles.selectRow} onPress={() => setShowCategorySheet(true)} activeOpacity={0.75}>
          <Text style={selectedCategory ? styles.selectValue : styles.selectPlaceholder}>
            {selectedCategory ? selectedCategory.name : 'None'}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Priority</Text>
        <TouchableOpacity style={styles.selectRow} onPress={() => setShowPrioritySheet(true)} activeOpacity={0.75}>
          <View style={styles.priorityValueRow}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColors[priority] }]} />
            <Text style={styles.selectValue}>{priorityLabels[priority]}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Scheduled</Text>
        <View style={styles.scheduleRow}>
          <DatePicker value={scheduledAt ?? new Date()} onChange={setScheduledAt} precision="minute">
            <TouchableOpacity style={styles.selectRow} activeOpacity={0.75}>
              <Text style={scheduledAt ? styles.selectValue : styles.selectPlaceholder}>
                {scheduledAt ? formatDateTime(scheduledAt.toISOString()) : 'Not scheduled'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </DatePicker>
          {scheduledAt ? (
            <TouchableOpacity style={styles.clearScheduleButton} onPress={() => setScheduledAt(null)}>
              <Text style={styles.clearScheduleText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.label}>Notes / description</Text>
        <View style={styles.textAreaWrap}>
          <Input.TextArea
            value={description}
            onChangeText={setDescription}
            placeholder="Any extra context…"
            placeholderTextColor={colors.textFaint}
            rows={4}
          />
        </View>

        {isEditing ? (
          <Text style={styles.checklistHint}>
            Manage this task&apos;s checklist steps from the task detail screen after saving.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Checklist</Text>
            <View style={styles.checklistCard}>
              {checklistDrafts.map((item, index) => (
                <ChecklistRow
                  key={`${item}-${index}`}
                  title={item}
                  checked={false}
                  onToggle={() => undefined}
                  onRemove={() => setChecklistDrafts(prev => prev.filter((_, i) => i !== index))}
                />
              ))}
              <AddRow
                placeholder="Add a step…"
                onAdd={value => setChecklistDrafts(prev => [...prev, value])}
              />
            </View>
          </>
        )}

        <AppButton
          label={isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Create task'}
          onPress={handleSave}
          disabled={!canSave}
          loading={isSaving}
          style={styles.saveButton}
        />
      </KeyboardAvoidingView>

      <SelectSheet
        visible={showCategorySheet}
        title="Category"
        options={[{ label: 'None', value: '' }, ...categoryOptions]}
        selectedValue={categoryId ?? ''}
        onSelect={value => setCategoryId(value || undefined)}
        onClose={() => setShowCategorySheet(false)}
      />
      <SelectSheet
        visible={showPrioritySheet}
        title="Priority"
        options={PRIORITY_OPTIONS}
        selectedValue={priority}
        onSelect={value => setPriority(value)}
        onClose={() => setShowPrioritySheet(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  label: {
    ...typography.eyebrow,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: border.thick,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.lg,
  },
  selectValue: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  selectPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textFaint,
  },
  chevron: {
    color: colors.textFaint,
    fontSize: fontSize.lg,
  },
  priorityValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
  },
  scheduleRow: {
    marginBottom: spacing.lg,
  },
  clearScheduleButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  clearScheduleText: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  textAreaWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: border.thick,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  checklistHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  checklistCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: border.thick,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  saveButton: {
    marginTop: spacing.md,
  },
});
