import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import Input from '@ant-design/react-native/lib/input';
import Switch from '@ant-design/react-native/lib/switch';
import Toast from '@ant-design/react-native/lib/toast';
import Modal from '@ant-design/react-native/lib/modal';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { LabeledInput } from '../../../components/LabeledInput';
import { AppButton } from '../../../components/AppButton';
import { border, colors, fontSize, radius, spacing, typography } from '../../../theme';
import { formatDateTime } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import {
  cancelReminderNotification,
  hasExactAlarmPermission,
  openExactAlarmSettings,
  scheduleReminderNotification,
} from '../../../notifications';
import {
  useCancelReminderMutation,
  useCreateReminderMutation,
  useDeleteReminderMutation,
  useGetReminderQuery,
  useUpdateReminderMutation,
} from '../remindersApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'CreateEditReminder'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'CreateEditReminder'>;

const DEFAULT_TIME_AHEAD_MS = 60 * 60 * 1000; // an hour from now, a sane default

export function CreateEditReminderScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const reminderId = route.params?.reminderId;
  const isEditing = Boolean(reminderId);

  const { data: existing, isLoading: isLoadingExisting } = useGetReminderQuery(reminderId ?? '', { skip: !reminderId });
  const [createReminder, { isLoading: isCreating }] = useCreateReminderMutation();
  const [updateReminder, { isLoading: isUpdating }] = useUpdateReminderMutation();
  const [cancelReminder, { isLoading: isCancelling }] = useCancelReminderMutation();
  const [deleteReminder] = useDeleteReminderMutation();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [remindAt, setRemindAt] = useState<Date>(new Date(Date.now() + DEFAULT_TIME_AHEAD_MS));
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setNote(existing.note ?? '');
      setRemindAt(new Date(existing.remind_at));
      setWhatsappEnabled(Boolean(existing.whatsapp_number));
      setWhatsappNumber(existing.whatsapp_number ?? '');
    }
  }, [existing]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit reminder' : 'New reminder' });
  }, [navigation, isEditing]);

  const isSaving = isCreating || isUpdating;
  const canSave = title.trim().length > 0 && (!whatsappEnabled || whatsappNumber.trim().length >= 8) && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      // WhatsApp numbers must be in international format (+<country><number>).
      // A bare 10-digit number is almost always a local Indian mobile number
      // typed without its country code, so fill that in rather than bounce
      // the user with a validation error for a very common input pattern.
      const normalizedWhatsapp = whatsappNumber.replace(/[\s-]/g, '');
      const whatsapp = /^\d{10}$/.test(normalizedWhatsapp) ? `+91${normalizedWhatsapp}` : normalizedWhatsapp;

      const payload = {
        title: title.trim(),
        note: note.trim() || undefined,
        remind_at: remindAt.toISOString(),
        whatsapp_number: whatsappEnabled ? whatsapp : undefined,
      };

      let savedId = reminderId;
      if (isEditing && reminderId) {
        await updateReminder({
          id: reminderId,
          ...payload,
          clear_whatsapp_number: !whatsappEnabled,
        }).unwrap();
      } else {
        const created = await createReminder(payload).unwrap();
        savedId = created.id;
      }

      if (savedId) {
        await scheduleReminderNotification(savedId, title.trim(), note.trim() || title.trim(), remindAt);
      }

      if (!(await hasExactAlarmPermission())) {
        Modal.alert(
          'For punctual reminders',
          "Without 'Alarms & reminders' access, Android may delay this notification by a few minutes. Enable it for exact timing.",
          [
            { text: 'Not now', onPress: () => navigation.goBack() },
            { text: 'Open settings', onPress: () => openExactAlarmSettings().finally(() => navigation.goBack()) },
          ],
        );
      } else {
        navigation.goBack();
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not save reminder.'));
    }
  };

  const handleCancelReminder = () => {
    if (!reminderId) return;
    Modal.alert('Cancel reminder', 'This stops the notification but keeps a record of it.', [
      { text: 'Keep it' },
      {
        text: 'Cancel reminder',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelReminder(reminderId).unwrap();
            await cancelReminderNotification(reminderId);
            navigation.goBack();
          } catch (err) {
            Toast.fail(getErrorMessage(err, 'Could not cancel reminder.'));
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!reminderId) return;
    Modal.alert('Delete reminder', 'This cannot be undone.', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(reminderId).unwrap();
            await cancelReminderNotification(reminderId);
            navigation.goBack();
          } catch (err) {
            Toast.fail(getErrorMessage(err, 'Could not delete reminder.'));
          }
        },
      },
    ]);
  };

  if (isEditing && isLoadingExisting) {
    return (
      <ScreenContainer>
        <LoadingView label="Loading reminder…" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentStyle={styles.content} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LabeledInput label="Title" value={title} onChangeText={setTitle} placeholder="Go to market" />

        <Text style={styles.label}>When</Text>
        <DatePicker value={remindAt} onChange={setRemindAt} precision="minute" minDate={new Date(2020, 0, 1)}>
          <TouchableOpacity style={styles.selectRow} activeOpacity={0.75}>
            <Text style={styles.selectValue}>{formatDateTime(remindAt.toISOString())}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </DatePicker>
        <Text style={styles.hint}>Works for anything time-based — later today, or months from now.</Text>

        <Text style={styles.label}>Note (optional)</Text>
        <View style={styles.textAreaWrap}>
          <Input.TextArea
            value={note}
            onChangeText={setNote}
            placeholder="Any extra detail…"
            placeholderTextColor={colors.textFaint}
            rows={3}
          />
        </View>

        <View style={styles.whatsappRow}>
          <View style={styles.whatsappRowText}>
            <Text style={styles.whatsappTitle}>Also send on WhatsApp</Text>
            <Text style={styles.whatsappSubtitle}>Optional — in addition to the push notification.</Text>
          </View>
          <Switch checked={whatsappEnabled} onChange={setWhatsappEnabled} color={colors.primary} />
        </View>

        {whatsappEnabled ? (
          <LabeledInput
            label="WhatsApp number"
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            placeholder="+919876543210"
            keyboardType="phone-pad"
          />
        ) : null}

        <AppButton
          label={isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Create reminder'}
          onPress={handleSave}
          disabled={!canSave}
          loading={isSaving}
          style={styles.saveButton}
        />

        {isEditing ? (
          <View style={styles.secondaryActions}>
            <AppButton
              label={isCancelling ? 'Cancelling…' : 'Cancel reminder'}
              variant="secondary"
              onPress={handleCancelReminder}
              disabled={isCancelling}
              style={styles.secondaryButton}
            />
            <AppButton label="Delete reminder" variant="danger" onPress={handleDelete} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
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
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xs,
  },
  selectValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  chevron: {
    color: colors.textFaint,
    fontSize: fontSize.lg,
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
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  whatsappRowText: {
    flex: 1,
    marginRight: spacing.md,
  },
  whatsappTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.ink,
  },
  whatsappSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  saveButton: {
    marginTop: spacing.md,
  },
  secondaryActions: {
    marginTop: spacing.xl,
  },
  secondaryButton: {
    marginBottom: spacing.sm,
  },
});
