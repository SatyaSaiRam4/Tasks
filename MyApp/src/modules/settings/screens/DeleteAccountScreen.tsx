import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { colors, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/Sheet';
import { getErrorMessage } from '../../../utils/apiError';
import { useAppSelector } from '../../../app/hooks';
import {
  useConfirmAccountDeletionMutation,
  useRequestAccountDeletionMutation,
} from '../../auth/authApi';

/**
 * Settings → Account → Delete account. Says plainly what is deleted, emails
 * a 6-digit code to the account's address (so works for Google accounts too),
 * then deletes the account and all its data for good and signs this phone
 * out. The same is possible on the web at /account/delete.
 */
export function DeleteAccountScreen() {
  const email = useAppSelector(s => s.auth.user?.email ?? '');
  const [requestCode, requesting] = useRequestAccountDeletionMutation();
  const [confirmDeletion, deleting] = useConfirmAccountDeletionMutation();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const sendCode = async () => {
    setError(null);
    try {
      await requestCode({ email }).unwrap();
      setSent(true);
      Toast.success(`A code is on its way to ${email}.`, 2);
    } catch (err) {
      setError(
        getErrorMessage(err, 'Could not send the code. Please try again.'),
      );
    }
  };

  const deleteNow = async () => {
    setError(null);
    try {
      await confirmDeletion({ email, code: code.trim() }).unwrap();
      setConfirming(false);
      Toast.success('Your account has been deleted.', 2);
    } catch (err) {
      setConfirming(false);
      setError(
        getErrorMessage(err, 'Could not delete the account. Please try again.'),
      );
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Delete account" subtitle="Account" close />
      <Text style={t.body}>
        Deleting your account is <Text style={styles.strong}>permanent</Text>.
        It removes your account and everything in it:
      </Text>
      <View style={styles.list}>
        {[
          'Plans, tasks and reminders (including their WhatsApp numbers)',
          'Streaks, badges and wallet points (including payouts not yet paid)',
          'Vault notes, photos and voice notes',
          'Your profile and settings',
        ].map(item => (
          <Text key={item} style={[t.body, styles.item]}>
            • {item}
          </Text>
        ))}
      </View>
      <Text style={[t.caption, styles.note]}>
        Kept without your name: payment records where accounting rules require
        them, and each WhatsApp number's YES or STOP answer, so a STOP is still
        respected.
      </Text>

      {!sent ? (
        <Button
          label={`Email a code to ${email}`}
          onPress={sendCode}
          loading={requesting.isLoading}
          size="lg"
          style={styles.mtLg}
        />
      ) : (
        <>
          <TextField
            label="6-digit code from the email"
            value={code}
            onChangeText={v => setCode(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
          />
          <Button
            label="Delete my account"
            variant="danger"
            onPress={() => setConfirming(true)}
            disabled={code.length !== 6}
            size="lg"
            style={styles.mtSm}
          />
          <Button
            label="Send the code again"
            variant="ghost"
            onPress={sendCode}
            loading={requesting.isLoading}
            style={styles.mtSm}
          />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ConfirmSheet
        visible={confirming}
        icon="trash"
        destructive
        title="Delete your account?"
        message="Everything listed here is deleted for good. This can't be undone."
        confirmLabel="Delete forever"
        loading={deleting.isLoading}
        onConfirm={deleteNow}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  strong: {
    fontWeight: '700',
  },
  list: {
    marginTop: spacing.sm,
  },
  item: {
    marginTop: spacing.xs,
  },
  note: {
    marginTop: spacing.md,
  },
  mtLg: {
    marginTop: spacing.xl,
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
