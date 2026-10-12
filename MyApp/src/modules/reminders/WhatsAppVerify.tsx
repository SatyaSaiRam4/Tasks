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
 * reminders to a number whose owner has replied YES to one short message
 * ("…Reply YES to allow them, or STOP to never get them"), so nobody can use
 * Memo to message someone else's number. Nothing secret is shown here: the
 * owner simply replies on WhatsApp. After STOP, only the owner can allow
 * reminders again, by sending YES to Memo themselves.
 */
export function WhatsAppVerify({ phone, onStatus }: { phone: string; onStatus: (status: ContactStatus) => void }) {
  const [ask, asking] = useAskWhatsappPermissionMutation();
  const query = useWhatsappStatusQuery(phone);
  const info = query.data?.phone === phone ? query.data : null;
  // Waiting but never actually asked (left over from an older version): ask again.
  const status: ContactStatus = info?.status === 'PENDING' && !info.asked_at ? 'NONE' : info?.status ?? 'NONE';
  // While waiting for the reply, look every few seconds.
  const { refetch } = query;
  useEffect(() => {
    if (status !== 'PENDING') return;
    const id = setInterval(() => refetch(), 4000);
    return () => clearInterval(id);
  }, [status, refetch]);
  const [was, setWas] = useState<ContactStatus>(status);
  useEffect(() => {
    onStatus(status);
    if (was === 'PENDING' && status === 'VERIFIED') Toast.success('They said YES. WhatsApp reminders are on.', 1.6);
    setWas(status);
  }, [status, onStatus, was]);

  const askNow = async () => {
    try {
      const res = await ask(phone).unwrap();
      if (res.status === 'PENDING') Toast.success('Sent. Ask them to reply YES on WhatsApp.', 1.6);
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

  if (status === 'VERIFIED') return <Note icon="check-circle" tone={colors.success} text="Allowed · this number replied YES to Memo" />;

  if (status === 'PENDING') {
    return (
      <View>
        <View style={[styles.row, { backgroundColor: withAlpha(colors.gold, 0.12) }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[styles.text, styles.flex]}>Asked on WhatsApp. Waiting for them to reply YES…</Text>
        </View>
        <Text style={styles.hint}>Memo sent this number one message: “Reply YES to allow, or STOP”. You can save now; reminders go out once they reply YES.</Text>
        <Diagnosis info={info} />
        <AskAgain askedAt={info?.asked_at ?? null} onPress={askNow} loading={asking.isLoading} />
      </View>
    );
  }

  if (status === 'STOPPED') {
    return (
      <View>
        <Note icon="x" tone={colors.danger} text="This number replied STOP. Memo won't message it." />
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
      <Note icon="shield" tone={colors.warning} text="Its owner needs to allow Memo reminders first." />
      <Text style={styles.hint}>Memo will send this number one WhatsApp message asking them to reply YES (or STOP). No codes.</Text>
      <Button label="Ask for permission on WhatsApp" icon="message" variant="secondary" onPress={askNow} loading={asking.isLoading} style={styles.mtSm} />
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
    return <Text style={styles.hint}>Memo got their reply “{info.last_reply}”, which isn't YES. Ask them to reply just YES.</Text>;
  }
  const waited = info.asked_at ? Date.now() - new Date(info.asked_at).getTime() : 0;
  if (waited < 2 * 60_000) return null;
  return (
    <Text style={[styles.hint, { color: colors.warning }]}>
      No reply has reached Memo from this number yet. If they've already replied YES, Memo's WhatsApp isn't passing replies on to the app; the admin needs to check the MSG91 incoming-message webhook.
    </Text>
  );
}

/** "Send the message again", available 15 minutes after the last one. */
function AskAgain({ askedAt, onPress, loading }: { askedAt: string | null; onPress: () => void; loading: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const wait = askedAt ? Math.ceil((new Date(askedAt).getTime() + 15 * 60_000 - now) / 60_000) : 0;
  if (wait > 0) return <Text style={styles.hint}>Didn't get it? You can send it again in {wait} min.</Text>;
  return <Button label="Send the message again" icon="refresh" variant="ghost" size="sm" onPress={onPress} loading={loading} style={styles.mtSm} />;
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
