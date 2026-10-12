import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Share, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { colors, font, radius, spacing, type as t, withAlpha } from '../../theme';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { getErrorMessage } from '../../utils/apiError';
import { useStartWhatsappVerificationMutation, useWhatsappStatusQuery, type ContactStatus, type VerifyStart } from './whatsappApi';

/**
 * The WhatsApp number's verification, under the number field. Memo only
 * messages a number whose owner has sent it a code from that number, so nobody
 * can use Memo to message someone else. For your own number, "Open WhatsApp"
 * sends it in one tap; for someone else's, share the code and they send it.
 * If the owner ever sends STOP, it has to be verified again.
 */
export function WhatsAppVerify({ phone, onStatus }: { phone: string; onStatus: (status: ContactStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [start, starting] = useStartWhatsappVerificationMutation();
  const [pending, setPending] = useState<VerifyStart | null>(null);
  // While the sheet is open, check every few seconds whether the code has arrived.
  const query = useWhatsappStatusQuery(phone, { pollingInterval: open ? 3000 : 0 });
  const status: ContactStatus = query.data?.phone === phone ? query.data.status : 'NONE';

  useEffect(() => onStatus(status), [status, onStatus]);
  useEffect(() => {
    if (open && status === 'VERIFIED') {
      setOpen(false);
      Toast.success('WhatsApp number verified.', 1.4);
    }
  }, [open, status]);

  const begin = async () => {
    try {
      const res = await start(phone).unwrap();
      if (res.status === 'VERIFIED') {
        query.refetch();
        return;
      }
      setPending(res);
      setOpen(true);
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not start verification.'), 2);
    }
  };

  const share = () =>
    pending &&
    Share.share({
      message: `I'd like to send you reminders from the Memo app on WhatsApp. If that's OK, send this message to Memo on WhatsApp: ${pending.message}\n${pending.link}\n(Reply STOP to Memo any time to stop them.)`,
    }).catch(() => undefined);

  if (status === 'VERIFIED') {
    return (
      <View style={[styles.row, styles.ok]}>
        <Icon name="check-circle" size={16} color={colors.success} />
        <Text style={[styles.text, { color: colors.success }]}>Verified · this number agreed to Memo reminders</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.row, styles.todo]}>
        <Icon name="shield" size={16} color={colors.warning} />
        <Text style={[styles.text, styles.flex]}>
          {status === 'STOPPED' ? 'This number replied STOP. Verify it again to send reminders.' : 'Not verified yet. Its owner sends Memo a code once.'}
        </Text>
      </View>
      <Button label={status === 'STOPPED' ? 'Verify again' : 'Verify this number'} icon="message" variant="secondary" onPress={begin} loading={starting.isLoading} style={styles.verify} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Verify on WhatsApp" subtitle={phone}>
        <Text style={[t.body, styles.lead]}>From the WhatsApp of {phone}, send this message to Memo:</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code} selectable>
            {pending?.message}
          </Text>
        </View>
        <Button label="It's my number · Open WhatsApp" icon="message" size="lg" onPress={() => pending?.link && Linking.openURL(pending.link).catch(() => undefined)} />
        <Button label="Someone else's · Share the code" icon="users" variant="secondary" onPress={share} style={styles.mtSm} />
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.gold} />
          <Text style={t.caption}>Waiting for the message… The code works for 30 minutes.</Text>
        </View>
        <Text style={[t.caption, styles.note]}>
          This keeps anyone from sending reminders to a number that isn't theirs. Reply STOP to Memo on WhatsApp any time to stop them.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  ok: {
    backgroundColor: withAlpha(colors.success, 0.12),
  },
  todo: {
    backgroundColor: withAlpha(colors.warning, 0.12),
  },
  text: {
    ...font.semibold,
    fontSize: 13,
    color: colors.text,
  },
  verify: {
    marginTop: spacing.sm,
  },
  lead: {
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  codeBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  code: {
    ...font.bold,
    fontSize: 30,
    letterSpacing: 3,
    color: colors.text,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  note: {
    marginTop: spacing.md,
  },
});
