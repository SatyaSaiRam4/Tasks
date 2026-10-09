import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { DateField } from '../../../components/PickerFields';
import { Button } from '../../../components/Button';
import { IconButton } from '../../../components/Controls';
import { Icon } from '../../../components/Icon';
import { ConfirmSheet } from '../../../components/Sheet';
import { Skeleton } from '../../../components/Feedback';
import { getErrorMessage } from '../../../utils/apiError';
import { addDays, diffDays, fromDateKey, toDateKey } from '../../../utils/date';
import { useGetStreakQuery } from '../../streaks/streaksApi';
import { useCreateActionMutation, useCreateTrackMutation, useGetTrackQuery, useUpdateTrackMutation } from '../routinesApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** A category can hold up to this many active tasks. */
const MAX_TASKS = 15;

/** Create a category with its tasks in one go, or edit a category's name and period. */
export function TrackEditorScreen() {
  const navigation = useNavigation<Nav>();
  const trackId = useRoute<RouteProp<RootStackParamList, 'TrackEditor'>>().params?.trackId;
  const editing = Boolean(trackId);
  const existing = useGetTrackQuery(trackId ?? '', { skip: !trackId });
  const streak = useGetStreakQuery();
  const today = streak.data?.today.date ?? toDateKey(new Date());
  const [create, { isLoading: creating }] = useCreateTrackMutation();
  const [update, { isLoading: updating }] = useUpdateTrackMutation();
  const [createTask, { isLoading: addingTasks }] = useCreateActionMutation();

  const [name, setName] = useState('');
  const [start, setStart] = useState<string>(today);
  const [end, setEnd] = useState<string>(toDateKey(addDays(fromDateKey(today), 29)));
  const [error, setError] = useState<string | null>(null);
  const [confirmDates, setConfirmDates] = useState(false);
  const [tasks, setTasks] = useState<string[]>([]);
  const [taskName, setTaskName] = useState('');

  useEffect(() => {
    const tr = existing.data;
    if (!tr) return;
    setName(tr.name);
    setStart(tr.start_date);
    setEnd(tr.end_date ?? toDateKey(addDays(fromDateKey(tr.start_date), 29)));
  }, [existing.data]);

  const days = diffDays(end, start) + 1;
  const datesChanged = editing && existing.data && (existing.data.start_date !== start || existing.data.end_date !== end);
  const hasHistory = Boolean(existing.data && existing.data.start_date < today);

  const addTask = () => {
    const title = taskName.trim();
    if (!title || tasks.length >= MAX_TASKS) return;
    setTasks(list => [...list, title]);
    setTaskName('');
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Give your category a name.');
    if (end < start) return setError('The end date must be on or after the start date.');
    if (datesChanged && hasHistory && !confirmDates) return setConfirmDates(true);
    setConfirmDates(false);
    const body = { name: name.trim(), start_date: start, end_date: end };
    try {
      if (editing) {
        await update({ id: trackId!, ...body }).unwrap();
        Toast.success('Saved.', 1);
        navigation.goBack();
      } else {
        const tr = await create(body).unwrap();
        // A task still in the box counts too, so nothing typed is lost.
        const titles = taskName.trim() && tasks.length < MAX_TASKS ? [...tasks, taskName.trim()] : tasks;
        try {
          for (const title of titles) {
            await createTask({ trackId: tr.id, title, repeat_type: 'DAILY' }).unwrap();
          }
        } catch (err) {
          // The category exists now, so go there rather than risk creating it twice.
          Toast.fail(getErrorMessage(err, 'Some tasks were not added. Add them here.'), 2);
        }
        navigation.replace('TrackDetail', { trackId: tr.id });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this category.'));
    }
  };

  if (editing && existing.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Edit category" subtitle="Category" close />
        <Skeleton height={56} rounded={14} style={styles.skelGap} />
        <Skeleton height={56} rounded={14} style={styles.skelGap} />
        <Skeleton height={56} rounded={28} style={styles.skelGap} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={editing ? 'Edit category' : 'New category'} subtitle="Category" close />
      <Text style={styles.intro}>{editing ? 'Refine the name or the period of this goal.' : 'Name a goal, pick the dates and add its tasks.'}</Text>

      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Gym" maxLength={80} autoFocus={!editing} />

      <View style={styles.dates}>
        <View style={styles.flex}>
          <DateField label="From" value={start} onChange={v => v && setStart(v)} />
        </View>
        <View style={styles.flex}>
          <DateField label="To" value={end} onChange={v => v && setEnd(v)} minDate={start} />
        </View>
      </View>
      {days > 0 ? <Text style={styles.duration}>{days === 1 ? '1 day' : `${days} days`}</Text> : null}

      {editing ? null : (
        <View style={styles.tasks}>
          <Text style={styles.label}>Tasks</Text>
          {tasks.length < MAX_TASKS ? (
            <View style={styles.addRow}>
              <View style={styles.flex}>
                <TextField
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholder={tasks.length ? 'Add another task' : 'e.g. Workout'}
                  onSubmitEditing={addTask}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  maxLength={200}
                />
              </View>
              <IconButton icon="plus" size={22} color={colors.gold} style={styles.addButton} accessibilityLabel="Add task" onPress={addTask} />
            </View>
          ) : null}
          {tasks.map((title, i) => (
            <View key={`${title}-${i}`} style={styles.taskRow}>
              <Icon name="check-circle" size={18} color={colors.gold} strokeWidth={1.7} />
              <Text style={styles.taskTitle} numberOfLines={1}>
                {title}
              </Text>
              <Pressable
                onPress={() => setTasks(list => list.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${title}`}
                hitSlop={10}
              >
                <Icon name="x" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={editing ? 'Save' : 'Create'} onPress={save} loading={creating || updating || addingTasks} size="lg" />

      <ConfirmSheet
        visible={confirmDates}
        icon="calendar"
        title="Change the dates?"
        message="Days you've already finished stay as they are."
        confirmLabel="Change dates"
        onConfirm={save}
        onCancel={() => setConfirmDates(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  skelGap: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  dates: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  intro: {
    ...t.aside,
    marginBottom: spacing.xxl,
  },
  duration: {
    ...t.caption,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  tasks: {
    marginBottom: spacing.md,
  },
  label: {
    ...t.micro,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  taskTitle: {
    ...t.body,
    flex: 1,
  },
  addRow: {
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
  error: {
    ...font.medium,
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
