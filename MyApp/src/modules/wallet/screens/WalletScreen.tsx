import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { brand, colors, font, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { ErrorState, Skeleton } from '../../../components/Feedback';
import { ProgressBar } from '../../../components/Progress';
import { Icon } from '../../../components/Icon';
import { RealIcon } from '../../../components/RealIcon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { newRequestId, useGetWalletQuery, useRedeemMutation, type WalletRedemption } from '../walletApi';

/**
 * The wallet: streak points that turn into money. Best-streak milestones
 * unlock points once each (500 at a best streak of 500, 1000 more at 1000).
 * The user redeems 500 points (₹10) or 1000 points (₹20) to a mobile number;
 * payouts are sent by hand and each request shows Processing, Paid or Not
 * paid. Everything comes from the server; nothing is decided on the phone.
 */
export function WalletScreen() {
  const wallet = useGetWalletQuery();
  const [redeem, { isLoading: redeeming }] = useRedeemMutation();
  const [phone, setPhone] = useState('');
  const [points, setPoints] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One id per redemption: a second tap or a retry after a dropped connection
  // gets the same redemption back instead of a new one.
  const requestId = useRef(newRequestId());
  // Set at once (state updates wait for the next render), so a double tap sends once.
  const sending = useRef(false);
  const w = wallet.data;
  // The same streak the dashboard shows (today's finished plans included).
  const live = Math.max(w?.live_best_streak ?? 0, w?.best_streak ?? 0);

  const choice = w?.choices.find(c => c.points === points && c.available) ?? null;

  const submit = async () => {
    if (redeeming || sending.current) return;
    setError(null);
    if (!choice) return setError('Choose 500 or 1000 points.');
    if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter your mobile number, e.g. 9876543210.');
    sending.current = true;
    try {
      const r = await redeem({ phone, points: choice.points, request_id: requestId.current }).unwrap();
      requestId.current = newRequestId();
      setPhone('');
      setPoints(null);
      Toast.success(`₹${r.amount} (${r.points} points) is on its way to ${r.phone}.`, 2);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not redeem right now.'));
    } finally {
      sending.current = false;
    }
  };

  return (
    <Screen onRefresh={wallet.refetch} refreshing={wallet.isFetching}>
      <ScreenHeader title="Wallet" />
      {wallet.isLoading ? (
        <>
          <Skeleton height={150} />
          <Skeleton height={120} style={styles.mtLg} />
        </>
      ) : wallet.isError || !w ? (
        <ErrorState message={getErrorMessage(wallet.error, 'Could not load your wallet.')} onRetry={wallet.refetch} />
      ) : (
        <>
          <Card tone="hero" contentStyle={styles.balanceCard}>
            <RealIcon name="coin" size={52} />
            <Text style={styles.balanceLabel}>Points to redeem</Text>
            <Text style={styles.balance} accessibilityLabel={`${w.points_available} points, worth ${w.balance} rupees`}>
              {w.points_available}
            </Text>
            <Text style={styles.balanceNote}>
              {w.points_available > 0 ? `Worth ₹${w.balance} · ready to redeem` : `Best streak: ${live}`}
            </Text>
          </Card>

          <Text style={styles.section}>Earn with streaks</Text>
          <View style={styles.milestones}>
            {w.milestones.map(m => (
              <Card key={m.days} style={styles.flex} contentStyle={styles.milestone} accent={m.reached ? colors.success : undefined}>
                <RealIcon name={m.reached ? 'trophy' : 'flame'} size={30} />
                <Text style={styles.milestoneAmount}>₹{m.amount}</Text>
                <Text style={styles.milestoneGoal}>
                  {m.points || m.days} points · streak {m.days}
                </Text>
                <ProgressBar
                  progress={Math.min(live / m.days, 1)}
                  height={4}
                  colorsPair={m.reached ? gradients.success : gradients.primary}
                  style={styles.milestoneBar}
                />
                <Text style={[t.caption, m.reached && { color: colors.success }]}>
                  {m.reached ? 'Earned ✓' : live >= m.days ? 'Added tonight' : `${m.days - live} to go`}
                </Text>
              </Card>
            ))}
          </View>

          <Text style={styles.section}>Redeem</Text>
          <Card contentStyle={styles.redeem}>
            <View style={styles.choices} accessibilityRole="radiogroup">
              {w.choices.map(c => {
                const selected = points === c.points && c.available;
                return (
                  <Pressable
                    key={c.points}
                    onPress={() => {
                      setPoints(c.points);
                      setError(null);
                    }}
                    disabled={!c.available || redeeming}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !c.available }}
                    accessibilityLabel={`${c.points} points for ${c.amount} rupees${c.available ? '' : ', not enough points yet'}`}
                    style={[styles.choice, selected && styles.choiceSelected, !c.available && styles.choiceOff]}
                  >
                    <Text style={[styles.choicePoints, selected && styles.choiceTextSelected]}>{c.points} points</Text>
                    <Text style={[styles.choiceAmount, selected && styles.choiceTextSelected]}>₹{c.amount}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextField
              label="Mobile number (UPI / wallet)"
              value={phone}
              onChangeText={setPhone}
              placeholder="9876543210"
              keyboardType="phone-pad"
              maxLength={16}
              error={error}
              editable={w.points_available > 0 && !redeeming}
            />
            <Button
              label={w.points_available <= 0 ? 'No points to redeem yet' : choice ? `Redeem ₹${choice.amount}` : 'Choose 500 or 1000 points'}
              onPress={submit}
              loading={redeeming}
              disabled={!choice || redeeming}
              size="lg"
            />
            <Text style={[t.caption, styles.redeemNote]}>Payments are sent by hand within a few days.</Text>
          </Card>

          {w.redemptions.length ? (
            <>
              <Text style={styles.section}>Redeemed</Text>
              <ListGroup>
                {w.redemptions.map((r, i) => (
                  <ListRow
                    key={r.id}
                    title={`₹${r.amount} · ${r.points} points`}
                    subtitle={redemptionDetail(r)}
                    right={<RedemptionState status={r.status} />}
                    last={i === w.redemptions.length - 1}
                  />
                ))}
              </ListGroup>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** "To +91… · 12 Oct", plus the payout reference or why it wasn't paid. */
function redemptionDetail(r: WalletRedemption): string {
  const base = `To ${r.phone} · ${formatFullDate(r.created_at)}`;
  if (r.status === 'PAID' && r.payout_reference) return `${base} · Ref ${r.payout_reference}`;
  if (r.status === 'REJECTED') return `${base} · ${r.note ? `${r.note}. ` : ''}Points returned`;
  return base;
}

function RedemptionState({ status }: { status: WalletRedemption['status'] }) {
  const label = status === 'PAID' ? 'Paid' : status === 'REJECTED' ? 'Not paid' : 'Processing';
  return (
    <View style={styles.status} accessibilityLabel={label}>
      {status === 'PAID' ? (
        <RealIcon name="check" size={16} />
      ) : (
        <Icon name={status === 'REJECTED' ? 'x' : 'clock'} size={14} color={status === 'REJECTED' ? colors.danger : colors.textSecondary} />
      )}
      <Text style={[t.caption, status === 'REJECTED' && { color: colors.danger }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  choices: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceOff: {
    opacity: 0.45,
  },
  choicePoints: {
    ...font.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  choiceAmount: {
    ...font.serif,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
  },
  choiceTextSelected: {
    color: colors.onPrimary,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  balanceCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  balanceLabel: {
    ...t.micro,
    marginTop: spacing.sm,
    color: brand.champagne,
  },
  balance: {
    ...t.hero,
    fontSize: 64,
    lineHeight: 70,
    color: brand.champagneLight,
    marginTop: spacing.sm,
  },
  balanceNote: {
    ...font.semibold,
    fontSize: 13,
    color: colors.heroTextSecondary,
    marginTop: spacing.xs,
  },
  section: {
    ...t.micro,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  flex: {
    flex: 1,
  },
  milestones: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  milestone: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  milestoneAmount: {
    ...font.serif,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
    marginTop: spacing.xs,
  },
  milestoneGoal: {
    ...font.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  milestoneBar: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  redeem: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  redeemNote: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
