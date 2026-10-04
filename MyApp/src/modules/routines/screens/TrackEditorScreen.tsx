import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, TRACK_COLORS, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { DateField } from '../../../components/PickerFields';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ConfirmSheet } from '../../../components/Sheet';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { addDays, diffDays, fromDateKey, toDateKey } from '../../../utils/date';
import { useGetStreakQuery } from '../../streaks/streaksApi';
import { useCreateTrackMutation, useGetTrackQuery, useUpdateTrackMutation } from '../routinesApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICONS = ['🏋️', '🥗', '📚', '🧘', '💻', '🏃', '😴', '💧', '🎯', '✍️', '🎸', '🌱'];
const TEMPLATES = [
  { name: 'Gym', icon: '🏋️', days: 30 },
  { name: 'Diet', icon: '🥗', days: 30 },
  { name: 'Study', icon: '📚', days: 21 },
  { name: 'Meditation', icon: '🧘', days: 14 },
];

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
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(ICONS[0]);
  const [color, setColor] = useState(TRACK_COLORS[0]);
  const [start, setStart] = useState<string>(today);
  const [end, setEnd] = useState<string | null>(toDateKey(addDays(fromDateKey(today), 29)));
  const [error, setError] = useState<string | null>(null);
  const [confirmDates, setConfirmDates] = useState(false);

  useEffect(() => {
    const tr = existing.data;
    if (!tr) return;
    setName(tr.name);
    setDescription(tr.description ?? '');
    setIcon(tr.icon);
    setColor(tr.color ?? TRACK_COLORS[0]);
    setStart(tr.start_date);
    setEnd(tr.end_date);
  }, [existing.data]);

  const duration = end ? diffDays(end, start) + 1 : null;
  const busy = creating || updating;
  const datesChanged = editing && existing.data && (existing.data.start_date !== start || existing.data.end_date !== end);
  const hasHistory = Boolean(existing.data && existing.data.start_date < today);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Give your Track a name.');
    if (end && end < start) return setError('The end date must be on or after the start date.');
    if (datesChanged && hasHistory && !confirmDates) return setConfirmDates(true);
    setConfirmDates(false);
    const body = { name: name.trim(), description: description.trim() || null, icon, color, start_date: start, end_date: end };
    try {
      if (editing) {
        await update({ id: trackId!, ...body, clear_end_date: !end }).unwrap();
        Toast.success('Track updated.', 1.2);
        navigation.goBack();
      } else {
        const tr = await create(body).unwrap();
        navigation.replace('TrackDetail', { trackId: tr.id });
        navigation.navigate('ActionEditor', { trackId: tr.id });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this Track.'));
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={editing ? 'Edit Track' : 'New Track'} close />

      {!editing ? (
        <View style={styles.templates}>
          {TEMPLATES.map(tpl => (
            <Pressable
              key={tpl.name}
              onPress={() => {
                setName(tpl.name);
                setIcon(tpl.icon);
                setEnd(toDateKey(addDays(fromDateKey(start), tpl.days - 1)));
              }}
              style={({ pressed }) => [styles.template, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${tpl.name} template`}
            >
              <Text style={styles.templateIcon}>{tpl.icon}</Text>
              <Text style={t.caption}>{tpl.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextField label="Track name" value={name} onChangeText={setName} placeholder="Gym" maxLength={80} />
      <TextField label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Why this matters to you" multiline minHeight={90} />

      <Text style={styles.label}>Icon</Text>
      <View style={styles.wrap}>
        {ICONS.map(i => (
          <Pressable
            key={i}
            onPress={() => setIcon(i)}
            accessibilityRole="radio"
            accessibilityState={{ selected: icon === i }}
            style={[styles.iconChoice, icon === i && { borderColor: color, backgroundColor: `${color}22` }]}
          >
            <Text style={styles.iconChoiceText}>{i}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Color</Text>
      <View style={styles.wrap}>
        {TRACK_COLORS.map(c => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            accessibilityRole="radio"
            accessibilityState={{ selected: color === c }}
            accessibilityLabel={`Color ${c}`}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
          >
            {color === c ? <Icon name="check" size={16} color={colors.white} strokeWidth={3} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.dates}>
        <View style={styles.flex}>
          <DateField label="Start" value={start} onChange={v => v && setStart(v)} />
        </View>
        <View style={styles.flex}>
          <DateField label="End" value={end} onChange={setEnd} placeholder="Ongoing" minDate={start} clearable />
        </View>
      </View>

      <Card style={styles.commitment}>
        <View style={styles.commitRow}>
          <Icon name="flame" size={20} color={colors.streak} />
          <Text style={[t.bodyStrong, styles.flex]}>{duration ? `${duration}-day commitment` : 'Ongoing commitment'}</Text>
        </View>
        <Text style={[t.caption, styles.commitText]}>
          Each day, confirm every required action to keep your streak. Missing one ends the streak, and you can start again
          the next day.
          {duration && duration >= 7 ? ' Complete every day perfectly to earn a duration-based bonus.' : ''}
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={editing ? 'Save changes' : 'Create Track'} onPress={save} loading={busy} size="lg" icon={editing ? 'check' : 'plus'} />

      <ConfirmSheet
        visible={confirmDates}
        icon="calendar"
        title="Change this Track's dates?"
        message="New dates apply from today onward. Days you've already finished stay exactly as they are in your streak history."
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
  label: {
    ...t.micro,
    marginBottom: spacing.sm,
  },
  templates: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  template: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  templateIcon: {
    fontSize: 22,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  iconChoice: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  iconChoiceText: {
    fontSize: 22,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.white,
  },
  dates: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  commitment: {
    marginBottom: spacing.xl,
  },
  commitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  commitText: {
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
