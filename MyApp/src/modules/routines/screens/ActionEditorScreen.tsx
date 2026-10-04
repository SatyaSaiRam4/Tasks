import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { DateField, TimeField } from '../../../components/PickerFields';
import { Chip, IconButton, Toggle } from '../../../components/Controls';
import { Button } from '../../../components/Button';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { ConfirmSheet } from '../../../components/Sheet';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { WEEKDAYS_MON_FIRST } from '../../../utils/date';
import {
  useCreateActionMutation,
  useDeleteActionMutation,
  useGetActionQuery,
  useGetTrackQuery,
  useUpdateActionMutation,
  type Priority,
  type RepeatType,
} from '../routinesApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

const REPEATS: { value: RepeatType; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'CUSTOM', label: 'Every few days' },
  { value: 'ONCE', label: 'One time' },
];
const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH'];

export function ActionEditorScreen() {
  const navigation = useNavigation();
  const { trackId, actionId } = useRoute<RouteProp<RootStackParamList, 'ActionEditor'>>().params;
  const editing = Boolean(actionId);
  const track = useGetTrackQuery(trackId);
  const existing = useGetActionQuery(actionId ?? '', { skip: !actionId });
  const [create, { isLoading: creating }] = useCreateActionMutation();
  const [update, { isLoading: updating }] = useUpdateActionMutation();
  const [remove, { isLoading: deleting }] = useDeleteActionMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState<string | null>('07:00:00');
  const [repeat, setRepeat] = useState<RepeatType>('DAILY');
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [interval, setInterval] = useState('2');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [required, setRequired] = useState(true);
  const [reminder, setReminder] = useState(false);
  const [active, setActive] = useState(true);
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [steps, setSteps] = useState<string[]>([]);
  const [stepDraft, setStepDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const a = existing.data;
    if (!a) return;
    setTitle(a.title);
    setDescription(a.description ?? '');
    setTime(a.time_of_day);
    setRepeat(a.repeat_type);
    setWeekdays(a.repeat_weekdays ?? [0, 1, 2, 3, 4]);
    setInterval(String(a.repeat_interval_days ?? 2));
    setStart(a.start_date);
    setEnd(a.end_date);
    setRequired(a.is_required);
    setReminder(a.reminder_enabled);
    setActive(a.is_active);
    setPriority(a.priority);
    setSteps(a.steps.map(s => s.title));
  }, [existing.data]);

  const toggleDay = (d: number) => setWeekdays(w => (w.includes(d) ? w.filter(x => x !== d) : [...w, d].sort()));
  const addStep = () => {
    const s = stepDraft.trim();
    if (!s) return;
    setSteps(prev => [...prev, s].slice(0, 30));
    setStepDraft('');
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('Give this action a name.');
    if (repeat === 'WEEKLY' && weekdays.length === 0) return setError('Pick at least one weekday.');
    const every = Number(interval);
    if (repeat === 'CUSTOM' && (!Number.isInteger(every) || every < 2 || every > 365)) return setError('Repeat every 2–365 days.');
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      time_of_day: time,
      clear_time: !time,
      repeat_type: repeat,
      repeat_weekdays: repeat === 'WEEKLY' ? weekdays : null,
      repeat_interval_days: repeat === 'CUSTOM' ? every : null,
      start_date: start,
      end_date: end,
      clear_end_date: !end,
      is_required: required,
      reminder_enabled: reminder,
      priority,
      steps: stepDraft.trim() ? [...steps, stepDraft.trim()] : steps,
    };
    try {
      if (editing) {
        await update({ id: actionId!, ...body, is_active: active }).unwrap();
        Toast.success('Action updated. Changes apply from today.', 1.4);
      } else {
        const { clear_time, clear_end_date, ...createBody } = body;
        void clear_time;
        void clear_end_date;
        await create({ trackId, ...createBody }).unwrap();
        Toast.success('Action added.', 1.2);
      }
      navigation.goBack();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this action.'));
    }
  };

  const doDelete = async () => {
    try {
      await remove(actionId!).unwrap();
      setConfirmDelete(false);
      navigation.goBack();
      Toast.success('Action deleted. Past completions are kept.', 1.6);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={editing ? 'Edit action' : 'New action'} subtitle={track.data?.name} close />

      <TextField label="Action" value={title} onChangeText={setTitle} placeholder="Morning Workout" maxLength={200} />
      <TimeField label="Time" value={time} onChange={setTime} placeholder="Any time of day" />

      <Text style={styles.label}>Repeat</Text>
      <View style={styles.wrap}>
        {REPEATS.map(r => (
          <Chip key={r.value} label={r.label} selected={repeat === r.value} onPress={() => setRepeat(r.value)} />
        ))}
      </View>
      {repeat === 'WEEKLY' ? (
        <View style={styles.wrap}>
          {WEEKDAYS_MON_FIRST.map((d, i) => (
            <Pressable
              key={d}
              onPress={() => toggleDay(i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: weekdays.includes(i) }}
              accessibilityLabel={d}
              style={[styles.dayChoice, weekdays.includes(i) && styles.dayChoiceOn]}
            >
              <Text style={[styles.dayText, weekdays.includes(i) && styles.dayTextOn]}>{d.slice(0, 2)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {repeat === 'CUSTOM' ? (
        <TextField
          label="Repeat every (days)"
          value={interval}
          onChangeText={v => setInterval(v.replace(/\D/g, '').slice(0, 3))}
          keyboardType="number-pad"
          placeholder="2"
        />
      ) : null}

      <View style={styles.dates}>
        <View style={styles.flex}>
          <DateField label={repeat === 'ONCE' ? 'Date' : 'Starts'} value={start} onChange={setStart} placeholder="Today" />
        </View>
        {repeat !== 'ONCE' ? (
          <View style={styles.flex}>
            <DateField label="Ends" value={end} onChange={setEnd} placeholder="With Track" minDate={start ?? undefined} clearable />
          </View>
        ) : null}
      </View>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.wrap}>
        {PRIORITIES.map(p => (
          <Chip key={p} label={p === 'NORMAL' ? 'Normal' : p === 'LOW' ? 'Low' : 'High'} selected={priority === p} onPress={() => setPriority(p)} />
        ))}
      </View>

      <ListGroup>
        <ListRow
          icon="flame"
          iconColor={colors.streak}
          title="Required for streak"
          subtitle={required ? 'Must be confirmed each day it’s due' : 'Optional, never breaks a streak'}
          right={<Toggle value={required} onChange={setRequired} accessibilityLabel="Required for streak" />}
        />
        <ListRow
          icon="bell"
          title="Remind me"
          subtitle={time ? 'A notification at the action’s time' : 'Set a time to get a reminder'}
          right={<Toggle value={reminder} onChange={setReminder} disabled={!time} accessibilityLabel="Remind me" />}
          last={!editing}
        />
        {editing ? (
          <ListRow
            icon="zap"
            title="Active"
            subtitle={active ? 'Showing in your days' : 'Paused from today onward'}
            right={<Toggle value={active} onChange={setActive} accessibilityLabel="Active" />}
            last
          />
        ) : null}
      </ListGroup>

      <Text style={[styles.label, styles.mtXl]}>Steps (optional)</Text>
      {steps.map((s, i) => (
        <View key={`${s}-${i}`} style={styles.step}>
          <Icon name="check" size={16} color={colors.textTertiary} />
          <Text style={[t.body, styles.flex]}>{s}</Text>
          <IconButton icon="x" variant="plain" size={16} color={colors.textTertiary} accessibilityLabel={`Remove ${s}`} onPress={() => setSteps(prev => prev.filter((_, j) => j !== i))} />
        </View>
      ))}
      <View style={styles.stepInputRow}>
        <TextInput
          value={stepDraft}
          onChangeText={setStepDraft}
          placeholder="Add a step, e.g. Stretch"
          placeholderTextColor={colors.textTertiary}
          onSubmitEditing={addStep}
          returnKeyType="done"
          style={styles.stepInput}
          accessibilityLabel="New step"
        />
        <IconButton icon="plus" accessibilityLabel="Add step" onPress={addStep} />
      </View>

      <TextField label="Notes (optional)" value={description} onChangeText={setDescription} multiline minHeight={80} placeholder="Anything that helps you do it" />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={editing ? 'Save changes' : 'Add action'} onPress={save} loading={creating || updating} size="lg" icon="check" />
      {editing ? <Button label="Delete action" variant="danger" icon="trash" onPress={() => setConfirmDelete(true)} style={styles.mtMd} /> : null}

      <ConfirmSheet
        visible={confirmDelete}
        icon="trash"
        destructive
        title="Delete this action?"
        message="It won't appear from today onward. Days you already completed stay in your history."
        confirmLabel="Delete action"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  label: {
    ...t.micro,
    marginBottom: spacing.sm,
  },
  mtXl: {
    marginTop: spacing.xl,
  },
  mtMd: {
    marginTop: spacing.md,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dayChoice: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChoiceOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  dayTextOn: {
    color: colors.white,
  },
  dates: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  stepInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stepInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
