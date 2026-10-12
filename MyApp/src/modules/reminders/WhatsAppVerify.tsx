import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Share, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { colors, font, radius, spacing, withAlpha } from '../../theme';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { getErrorMessage } from '../../utils/apiError';
import { useAskWhatsappPermissionMutation, useWhatsappStatusQuery, type ContactStatus } from './whatsappApi';

/**
 * Permission for a WhatsApp number, under the number field. Memo only sends
 * reminders to a number whose owner tapped 👍 (or replied YES) on one short
 * message within 1 minute, so nobody can use Memo to message someone else's
 * number. Nothing secret is shown here. A live countdown runs while they
 * decide; after it, "Send again". After 👎 / STOP, only the owner can allow
 * reminders again, by sending YES to Memo themselves.
 */
export function WhatsAppVerify({ phone, onStatus }: { phone: string; onStatus: (status: ContactStatus) => void }) {
  const [ask, asking] = useAskWhatsappPermissionMutation();
  const query = useWhatsappStatusQuery(phone);
  const info = query.data?.phone === phone ? query.data : null;
  // Waiting but never actually asked (left over from an older version): ask again.
  const status: ContactStatus = info?.status === 'PENDING' && !info.asked_at ? 'NONE' : info?.status ?? 'NONE';
  const { refetch } = query;
  // While they have the minute to answer, check every 2 seconds so the screen
  // changes as soon as they tap.
  useEffect(() => {
    if (status !== 'PENDING') return;
    const id = setInterval(() => refetch(), 2000);
    return () => clearInterval(id);
  }, [status, refetch]);
  // The countdown.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'PENDING') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [status]);
  const left = info?.expires_at ? Math.max(0, Math.ceil((new Date(info.expires_at).getTime() - now) / 1000)) : 0;
  // Time's up on this phone: ask the server, which then says EXPIRED.
  useEffect(() => {
    if (status === 'PENDING' && left === 0) refetch();
  }, [status, left, refetch]);
  const [was, setWas] = useState<ContactStatus>(status);
  useEffect(() => {
    onStatus(status);
    if (was === 'PENDING' && status === 'VERIFIED') Toast.success('They tapped 👍. WhatsApp reminders are on.', 1.6);
    if (was === 'PENDING' && status === 'STOPPED') Toast.info('They tapped 👎. Memo won’t message that number.', 2);
    setWas(status);
  }, [status, onStatus, was]);

  const askNow = async () => {
    try {
      const res = await ask(phone).unwrap();
      if (res.status === 'PENDING') Toast.success('Sent. They have 1 minute to tap 👍.', 1.6);
      refetch();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not send the WhatsApp message.'), 2);
    }
  };

  // After STOP: only the owner can turn it back on, by sending YES to Memo.
  const yesLink = info?.business_number ? `https://wa.me/${info.business_number}?text=YES` : null;
  const shareYes = () =>
    yesLink &&
    Share.share({ message: `If you'd like reminders from me through the Memo app on WhatsApp, send YES to Memo here: ${yesLink}` }).catch(() => undefined);

  if (status === 'VERIFIED') return <Note icon="check-circle" tone={colors.success} text="Allowed · this number tapped 👍 for Memo" />;

  if (status === 'PENDING') {
    return (
      <View>
        <View style={[styles.row, { backgroundColor: withAlpha(colors.gold, 0.12) }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[styles.text, styles.flex]}>Sent on WhatsApp. Waiting for 👍 or 👎…</Text>
          <Text style={styles.count}>0:{String(left).padStart(2, '0')}</Text>
        </View>
        <Text style={styles.hint}>They have 1 minute to tap 👍 (allow) or 👎 (refuse) under Memo's message, or reply YES / STOP.</Text>
        <Diagnosis info={info} />
      </View>
    );
  }

  if (status === 'STOPPED') {
    return (
      <View>
        <Note icon="x" tone={colors.danger} text="This number refused (👎 / STOP). Memo won't message it." />
        <Text style={styles.hint}>Only its owner can allow reminders again, by sending YES to Memo on WhatsApp.</Text>
        {yesLink ? (
          <View style={styles.buttons}>
            <Button label="It's my number · Send YES" icon="message" variant="secondary" size="sm" onPress={() => Linking.openURL(yesLink).catch(() => undefined)} />
            <Button label="Ask them" icon="users" variant="ghost" size="sm" onPress={shareYes} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {status === 'EXPIRED' ? (
        <Note icon="clock" tone={colors.warning} text="No answer within 1 minute." />
      ) : (
        <Note icon="shield" tone={colors.warning} text="Its owner needs to allow Memo reminders first." />
      )}
      <Text style={styles.hint}>Memo sends this number one WhatsApp message with 👍 / 👎. They have 1 minute to tap 👍. No codes.</Text>
      <Button
        label={status === 'EXPIRED' ? 'Send again' : 'Ask for permission on WhatsApp'}
        icon="message"
        variant="secondary"
        onPress={askNow}
        loading={asking.isLoading}
        style={styles.mtSm}
      />
    </View>
  );
}

/**
 * While waiting: what has actually reached Memo from this number, so it's
 * clear whether they replied something other than YES, or whether replies
 * aren't reaching the server at all (MSG91's incoming-message webhook).
 */
function Diagnosis({ info }: { info: { asked_at: string | null; last_reply: string | null } | null }) {
  if (!info) return null;
  if (info.last_reply) {
    return <Text style={styles.hint}>Memo got their reply “{info.last_reply}”, which isn't 👍 or YES.</Text>;
  }
  const waited = info.asked_at ? Date.now() - new Date(info.asked_at).getTime() : 0;
  if (waited < 40_000) return null;
  return (
    <Text style={[styles.hint, { color: colors.warning }]}>
      Nothing has reached Memo from this number yet. If they've already tapped 👍, Memo's WhatsApp isn't passing replies on to the app; the admin needs to check the MSG91 inbound webhook.
    </Text>
  );
}

function Note({ icon, tone, text }: { icon: IconName; tone: string; text: string }) {
  return (
    <View style={[styles.row, { backgroundColor: withAlpha(tone, 0.12) }]}>
      <Icon name={icon} size={16} color={tone} />
      <Text style={[styles.text, styles.flex, { color: tone }]}>{text}</Text>
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
  count: {
    ...font.bold,
    fontSize: 14,
    color: colors.gold,
  },
  text: {
    ...font.semibold,
    fontSize: 13,
    color: colors.text,
  },
  hint: {
    ...font.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
});
