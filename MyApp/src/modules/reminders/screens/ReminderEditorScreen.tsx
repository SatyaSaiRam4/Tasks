import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { DateTimeField } from '../../../components/PickerFields';
import { Chip, Toggle } from '../../../components/Controls';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { Button } from '../../../components/Button';
import { ConfirmSheet, SelectSheet } from '../../../components/Sheet';
import { getErrorMessage } from '../../../utils/apiError';
import {
  cancelReminderNotification,
  hasExactAlarmPermission,
  openExactAlarmSettings,
  scheduleReminderNotification,
} from '../../../notifications';
import { useListTracksQuery } from '../../routines/routinesApi';
import {
  useCreateReminderMutation,
  useDeleteReminderMutation,
  useGetReminderQuery,
  useUpdateReminderMutation,
  type ReminderPriority,
} from '../remindersApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

const PRIORITIES: { value: ReminderPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
];

/** A bare 10-digit number is almost always an Indian mobile number typed without +91. */
function normalizeWhatsapp(raw: string): string {
  const compact = raw.replace(/[\s-]/g, '');
  return /^\d{10}$/.test(compact) ? `+91${compact}` : compact;
}

export function ReminderEditorScreen() {
  const navigation = useNavigation();
  const reminderId = useRoute<RouteProp<RootStackParamList, 'ReminderEditor'>>().params?.reminderId;
  const editing = Boolean(reminderId);
  const existing = useGetReminderQuery(reminderId ?? '', { skip: !reminderId });
  const tracks = useListTracksQuery();
  const [create, { isLoading: creating }] = useCreateReminderMutation();
  const [update, { isLoading: updating }] = useUpdateReminderMutation();
  const [remove, { isLoading: deleting }] = useDeleteReminderMutation();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [at, setAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [priority, setPriority] = useState<ReminderPriority>('NORMAL');
  const [trackId, setTrackId] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState(false);
  const [number, setNumber] = useState('');
  const [trackPicker, setTrackPicker] = useState(false);
  const [alarmPrompt, setAlarmPrompt] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setTitle(r.title);
    setNote(r.note ?? '');
    setAt(new Date(r.remind_at));
    setPriority(r.priority);
    setTrackId(r.track_id);
    setWhatsapp(Boolean(r.whatsapp_number));
    setNumber(r.whatsapp_number ?? '');
  }, [existing.data]);

  const trackOptions = useMemo(
    () => [{ value: '__none__', label: 'No Track' }, ...(tracks.data ?? []).map(tr => ({ value: tr.id, label: tr.name, color: tr.color ?? colors.primary }))],
    [tracks.data],
  );
  const trackName = tracks.data?.find(tr => tr.id === trackId)?.name;

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('Give your reminder a title.');
    const phone = whatsapp ? normalizeWhatsapp(number) : '';
    if (whatsapp && !/^\+\d{8,15}$/.test(phone)) return setError('Enter a WhatsApp number, e.g. +919876543210.');
    const payload = {
      title: title.trim(),
      note: note.trim() || null,
      remind_at: at.toISOString(),
      priority,
      whatsapp_number: whatsapp ? phone : undefined,
      track_id: trackId,
    };
    try {
      const saved = editing
        ? await update({ id: reminderId!, ...payload, clear_whatsapp_number: !whatsapp, clear_track: !trackId }).unwrap()
        : await create(payload).unwrap();
      await scheduleReminderNotification(saved.id, saved.title, saved.note || saved.title, new Date(saved.remind_at));
      Toast.success(editing ? 'Reminder updated.' : 'Reminder set.', 1.2);
      if (!(await hasExactAlarmPermission())) setAlarmPrompt(true);
      else navigation.goBack();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this reminder.'));
    }
  };

  const doDelete = async () => {
    try {
      await remove(reminderId!).unwrap();
      await cancelReminderNotification(reminderId!);
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={editing ? 'Edit reminder' : 'New reminder'} close />

      <TextField label="What to remember" value={title} onChangeText={setTitle} placeholder="Go to the market" maxLength={200} />
      <DateTimeField label="When" value={at} onChange={setAt} />
      <Text style={[t.caption, styles.hint]}>Anything time-based works, later today or months away.</Text>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.wrap}>
        {PRIORITIES.map(p => (
          <Chip key={p.value} label={p.label} selected={priority === p.value} onPress={() => setPriority(p.value)} />
        ))}
      </View>

      <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Any extra detail" multiline minHeight={80} />

      <ListGroup>
        <ListRow icon="target" title="Track" subtitle={trackName ?? 'Optional, link this to a goal'} onPress={() => setTrackPicker(true)} />
        <ListRow
          icon="message"
          iconColor={colors.success}
          title="Also send on WhatsApp"
          subtitle="Delivered at the same time as the push notification"
          right={<Toggle value={whatsapp} onChange={setWhatsapp} accessibilityLabel="Also send on WhatsApp" />}
          last
        />
      </ListGroup>
      {whatsapp ? (
        <View style={styles.mtLg}>
          <TextField label="WhatsApp number" value={number} onChangeText={setNumber} placeholder="+919876543210" keyboardType="phone-pad" hint="10-digit Indian numbers get +91 added automatically." />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={editing ? 'Save changes' : 'Set reminder'} onPress={save} loading={creating || updating} size="lg" icon="bell" style={styles.mtLg} />
      {editing ? <Button label="Delete reminder" variant="danger" icon="trash" onPress={() => setConfirmDelete(true)} style={styles.mtMd} /> : null}

      <SelectSheet
        visible={trackPicker}
        title="Link to a Track"
        options={trackOptions}
        value={trackId ?? '__none__'}
        onSelect={v => setTrackId(v === '__none__' ? null : v)}
        onClose={() => setTrackPicker(false)}
      />
      <ConfirmSheet
        visible={alarmPrompt}
        icon="clock"
        title="For on-time reminders"
        message="Without 'Alarms & reminders' access, Android may deliver this a few minutes late. Enable it for exact timing."
        confirmLabel="Open settings"
        cancelLabel="Not now"
        onConfirm={() => {
          setAlarmPrompt(false);
          openExactAlarmSettings().finally(() => navigation.goBack());
        }}
        onCancel={() => {
          setAlarmPrompt(false);
          navigation.goBack();
        }}
      />
      <ConfirmSheet
        visible={confirmDelete}
        icon="trash"
        destructive
        title="Delete this reminder?"
        message="This permanently removes it. This can’t be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...t.micro,
    marginBottom: spacing.sm,
  },
  hint: {
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  wrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  mtMd: {
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
});
