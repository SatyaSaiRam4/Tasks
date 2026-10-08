import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, spacing, type as t } from '../../../theme';
import { useLayout } from '../../../hooks/useLayout';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { TimeField } from '../../../components/PickerFields';
import { DateStrip } from '../../../components/DateStrip';
import { IconButton, Toggle } from '../../../components/Controls';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { Button } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/Sheet';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate, fromDateKey, toDateKey } from '../../../utils/date';
import {
  cancelReminderNotification,
  hasExactAlarmPermission,
  openExactAlarmSettings,
  scheduleReminderNotification,
} from '../../../notifications';
import {
  useCreateReminderMutation,
  useDeleteReminderMutation,
  useGetReminderQuery,
  useUpdateReminderMutation,
} from '../remindersApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

/** A bare 10-digit number is almost always an Indian mobile number typed without +91. */
function normalizeWhatsapp(raw: string): string {
  const compact = raw.replace(/[\s-]/g, '');
  return /^\d{10}$/.test(compact) ? `+91${compact}` : compact;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** One hour from now, rounded up to the next 5 minutes, as "HH:MM:00". */
function defaultTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const m = Math.ceil(d.getMinutes() / 5) * 5;
  d.setMinutes(m, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** Add or edit a reminder: what, which day, what time, and optional WhatsApp. */
export function ReminderEditorScreen() {
  const navigation = useNavigation();
  const { gutter } = useLayout();
  const padStyle = { paddingHorizontal: gutter };
  const params = useRoute<RouteProp<RootStackParamList, 'ReminderEditor'>>().params;
  const reminderId = params?.reminderId;
  const editing = Boolean(reminderId);
  const existing = useGetReminderQuery(reminderId ?? '', { skip: !reminderId });
  const [create, { isLoading: creating }] = useCreateReminderMutation();
  const [update, { isLoading: updating }] = useUpdateReminderMutation();
  const [remove, { isLoading: deleting }] = useDeleteReminderMutation();

  const todayKey = toDateKey(new Date());
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(params?.date && params.date >= todayKey ? params.date : todayKey);
  const [time, setTime] = useState<string | null>(params?.date && params.date > todayKey ? '09:00:00' : defaultTime());
  const [whatsapp, setWhatsapp] = useState(false);
  const [number, setNumber] = useState('');
  const [alarmPrompt, setAlarmPrompt] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    const when = new Date(r.remind_at);
    setTitle(r.title);
    setDay(toDateKey(when));
    setTime(`${pad(when.getHours())}:${pad(when.getMinutes())}:00`);
    setWhatsapp(Boolean(r.whatsapp_number));
    setNumber(r.whatsapp_number ?? '');
  }, [existing.data]);

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('What should we remind you about?');
    if (!time) return setError('Pick a time.');
    const [hh, mm] = time.split(':').map(Number);
    const at = fromDateKey(day);
    at.setHours(hh, mm, 0, 0);
    if (at.getTime() <= Date.now()) return setError('That time has already passed. Pick a later time.');
    const phone = whatsapp ? normalizeWhatsapp(number) : '';
    if (whatsapp && !/^\+\d{8,15}$/.test(phone)) return setError('Enter a WhatsApp number, e.g. 9876543210.');

    const payload = { title: title.trim(), remind_at: at.toISOString(), whatsapp_number: whatsapp ? phone : undefined };
    try {
      const saved = editing
        ? await update({ id: reminderId!, ...payload, clear_whatsapp_number: !whatsapp }).unwrap()
        : await create(payload).unwrap();
      await scheduleReminderNotification(saved.id, saved.title, saved.note || saved.title, new Date(saved.remind_at));
      Toast.success(editing ? 'Saved.' : 'Reminder set.', 1.2);
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
    <Screen edges={['top', 'bottom']} padded={false}>
      <View style={padStyle}>
        <ScreenHeader title={editing ? 'Edit reminder' : 'New reminder'} subtitle="Reminder" close />
        <TextField label="Remind me to" value={title} onChangeText={setTitle} placeholder="e.g. Call mom" maxLength={200} autoFocus={!editing} />

        <View style={styles.dayHead}>
          <Text style={styles.label}>Day · {formatFullDate(day)}</Text>
          <DatePicker
            value={fromDateKey(day)}
            precision="day"
            minDate={fromDateKey(todayKey)}
            maxDate={new Date(2035, 11, 31)}
            onChange={(d: Date) => setDay(toDateKey(d))}
            title="Pick a day"
          >
            <CalendarButton />
          </DatePicker>
        </View>
      </View>
      <DateStrip selected={day} today={todayKey} onSelect={setDay} daysBack={0} daysForward={30} />

      <View style={padStyle}>
        <View style={styles.mtLg}>
          <TimeField label="Time" value={time} onChange={setTime} placeholder="Pick a time" />
        </View>

        <Text style={[styles.label, styles.section]}>Delivery</Text>
        <ListGroup>
          <ListRow
            icon="message"
            subtitle="In addition to the notification on this device"
            iconColor={colors.success}
            title="Also send on WhatsApp"
            right={<Toggle value={whatsapp} onChange={setWhatsapp} accessibilityLabel="Also send on WhatsApp" />}
            last
          />
        </ListGroup>
        {whatsapp ? (
          <View style={styles.mtLg}>
            <TextField label="WhatsApp number" value={number} onChangeText={setNumber} placeholder="9876543210" keyboardType="phone-pad" />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={editing ? 'Save' : 'Set reminder'} onPress={save} loading={creating || updating} size="lg" style={styles.mtLg} />
        {editing ? <Button label="Delete reminder" icon="trash" variant="dangerGhost" onPress={() => setConfirmDelete(true)} style={styles.mtSm} /> : null}
      </View>

      <ConfirmSheet
        visible={alarmPrompt}
        icon="clock"
        title="For on-time reminders"
        message="Allow 'Alarms & reminders' so Android doesn't deliver your reminders late."
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
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

/** The calendar button that opens the date picker (the picker injects onPress). */
function CalendarButton({ onPress }: { onPress?: () => void }) {
  return <IconButton icon="calendar" accessibilityLabel="Pick another day from the calendar" onPress={() => onPress?.()} />;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  label: {
    ...t.micro,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  error: {
    ...t.caption,
    color: colors.danger,
    marginTop: spacing.md,
  },
});
