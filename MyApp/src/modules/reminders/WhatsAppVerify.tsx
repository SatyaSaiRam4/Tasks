import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { colors, font, radius, spacing, withAlpha } from '../../theme';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { getErrorMessage } from '../../utils/apiError';
import { useAskWhatsappPermissionMutation, useWhatsappStatusQuery, type ContactStatus } from './whatsappApi';

/**
 * Permission for a WhatsApp number, under the number field. Memo sends that
 * number one short message: reply YES to allow, STOP to refuse. The screen
 * keeps checking while it's open, so YES turns it green and a STOP (even
 * right after YES) turns it to "Not accepted" within a couple of seconds.
 * "Send again" appears once the 1-minute answer window is over; after 3
 * refusals in a day it says to try again tomorrow.
 */
export function WhatsAppVerify({ phone, onStatus }: { phone: string; onStatus: (status: ContactStatus) => void }) {
  const [ask, asking] = useAskWhatsappPermissionMutation();
  // Always fresh from the server when the editor opens (never an old answer).
  const query = useWhatsappStatusQuery(phone, { refetchOnMountOrArgChange: true, refetchOnFocus: true });
  const info = query.data?.phone === phone ? query.data : null;
  // Waiting but never actually asked (left over from an older version): ask again.
  const status: ContactStatus = info?.status === 'PENDING' && !info.asked_at ? 'NONE' : info?.status ?? 'NONE';
  const { refetch } = query;
  // Keep checking while the editor is open: fast while they decide, then
  // still often enough that a later STOP (or YES) shows up by itself.
  useEffect(() => {
    const id = setInterval(() => refetch(), status === 'PENDING' ? 1500 : 3000);
    return () => clearInterval(id);
  }, [status, refetch]);
  // The countdown (while waiting, and until "Send again" after a STOP).
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'PENDING' && status !== 'STOPPED') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [status]);
  const windowEnds = info?.asked_at ? new Date(info.asked_at).getTime() + 60_000 : 0;
  const left = Math.max(0, Math.ceil((windowEnds - now) / 1000));
  // Time's up on this phone: ask the server, which then says EXPIRED.
  useEffect(() => {
    if (status === 'PENDING' && left === 0) refetch();
  }, [status, left, refetch]);
  const [was, setWas] = useState<ContactStatus>(status);
  useEffect(() => {
    onStatus(status);
    if (was !== status && status === 'VERIFIED' && was !== 'NONE') Toast.success('They replied YES. WhatsApp reminders are on.', 1.6);
    if (was !== status && status === 'STOPPED' && was !== 'NONE') Toast.info('They replied STOP. Memo won’t message that number.', 2);
    setWas(status);
  }, [status, onStatus, was]);

  const askNow = async () => {
    try {
      const res = await ask(phone).unwrap();
      if (res.status === 'PENDING') Toast.success('Sent. Waiting for YES.', 1.4);
      refetch();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not send the WhatsApp message.'), 2);
    }
  };

  if (status === 'VERIFIED') return <Note icon="check-circle" tone={colors.success} text="Accepted · they replied YES" />;

  if (status === 'PENDING') {
    return (
      <View>
        <View style={[styles.row, { backgroundColor: withAlpha(colors.gold, 0.12) }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[styles.text, styles.flex]}>Sent on WhatsApp. Waiting for YES or STOP…</Text>
          <Text style={styles.count}>0:{String(left).padStart(2, '0')}</Text>
        </View>
        <Diagnosis info={info} />
      </View>
    );
  }

  if (status === 'STOPPED') {
    const blockedUntil = info?.try_again_at ? new Date(info.try_again_at) : null;
    if (blockedUntil && blockedUntil.getTime() > now) {
      return (
        <View>
          <Note icon="alert" tone={colors.danger} text="Not accepted 3 times today. Try again tomorrow." />
          <Text style={styles.hint}>
            Memo won't message it before {blockedUntil.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
          </Text>
        </View>
      );
    }
    return (
      <View>
        <Note icon="x" tone={colors.danger} text="Not accepted · they replied STOP" />
        {left > 0 ? (
          <Text style={styles.hint}>You can send again in 0:{String(left).padStart(2, '0')}.</Text>
        ) : (
          <Button label="Send again" icon="message" variant="secondary" onPress={askNow} loading={asking.isLoading} style={styles.mtSm} />
        )}
      </View>
    );
  }

  return (
    <View>
      {status === 'EXPIRED' ? (
        <Note icon="clock" tone={colors.warning} text="No answer within 1 minute." />
      ) : (
        <Note icon="shield" tone={colors.warning} text="They need to reply YES on WhatsApp first." />
      )}
      <Button
        label={status === 'EXPIRED' ? 'Send again' : 'Ask on WhatsApp'}
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
 * clear whether they replied something other than YES or STOP, or whether replies
 * aren't reaching the server at all (MSG91's incoming-message webhook).
 */
function Diagnosis({ info }: { info: { asked_at: string | null; last_reply: string | null } | null }) {
  if (!info) return null;
  if (info.last_reply) {
    return <Text style={styles.hint}>Memo got their reply “{info.last_reply}”, which isn't YES or STOP.</Text>;
  }
  const waited = info.asked_at ? Date.now() - new Date(info.asked_at).getTime() : 0;
  if (waited < 40_000) return null;
  return (
    <Text style={[styles.hint, { color: colors.warning }]}>
      Nothing has reached Memo from this number yet. If they've already replied YES, Memo's WhatsApp isn't passing replies on to the app; the admin needs to check the MSG91 inbound webhook.
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
  mtSm: {
    marginTop: spacing.sm,
  },
});
