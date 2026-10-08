import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { DateField } from '../../../components/PickerFields';
import { Button } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/Sheet';
import { getErrorMessage } from '../../../utils/apiError';
import { addDays, diffDays, fromDateKey, toDateKey } from '../../../utils/date';
import { useGetStreakQuery } from '../../streaks/streaksApi';
import { useCreateTrackMutation, useGetTrackQuery, useUpdateTrackMutation } from '../routinesApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Create or edit a category: just a name and a period. */
export function TrackEditorScreen() {
  const navigation = useNavigation<Nav>();
  const trackId = useRoute<RouteProp<RootStackParamList, 'TrackEditor'>>().params?.trackId;
  const editing = Boolean(trackId);
  const existing = useGetTrackQuery(trackId ?? '', { skip: !trackId });
  const streak = useGetStreakQuery();
  const today = streak.data?.today.date ?? toDateKey(new Date());
  const [create, { isLoading: creating }] = useCreateTrackMutation();
  const [update, { isLoading: updating }] = useUpdateTrackMutation();

  const [name, setName] = useState('');
  const [start, setStart] = useState<string>(today);
  const [end, setEnd] = useState<string>(toDateKey(addDays(fromDateKey(today), 29)));
  const [error, setError] = useState<string | null>(null);
  const [confirmDates, setConfirmDates] = useState(false);

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
        // Straight to the category, where tasks are added.
        navigation.replace('TrackDetail', { trackId: tr.id });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this category.'));
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={editing ? 'Edit category' : 'New category'} subtitle="Category" close />
      <Text style={styles.intro}>{editing ? 'Refine the name or the period of this goal.' : 'Name a goal and choose how long you’ll keep it.'}</Text>

      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Gym" maxLength={80} autoFocus={!editing} />

      <View style={styles.dates}>
        <View style={styles.flex}>
          <DateField label="From" value={start} onChange={v => v && setStart(v)} />
        </View>
        <View style={styles.flex}>
          <DateField label="To" value={end} onChange={v => v && setEnd(v)} minDate={start} />
        </View>
      </View>
      {days > 0 ? (
        <View style={styles.duration}>
          <View style={styles.durationRule} />
          <View style={styles.durationInner}>
            <Text style={styles.durationNum}>{days}</Text>
            <Text style={styles.durationUnit}>{days === 1 ? 'day' : 'days'}</Text>
          </View>
          <View style={styles.durationRule} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={editing ? 'Save' : 'Create'} onPress={save} loading={creating || updating} size="lg" />

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  durationRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.goldLine,
  },
  durationInner: {
    alignItems: 'center',
  },
  durationNum: {
    ...font.serif,
    fontSize: 54,
    lineHeight: 58,
    color: colors.goldBright,
  },
  durationUnit: {
    ...t.micro,
    color: colors.textSecondary,
  },
  error: {
    ...font.medium,
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
