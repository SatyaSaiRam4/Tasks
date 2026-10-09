import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { useGetWalletQuery, useRedeemMutation } from '../walletApi';

/**
 * The wallet: money earned from streak milestones (500 streak points → ₹10,
 * 1000 → ₹20), shown side by side. To redeem, the user enters an amount (up
 * to the balance) and a mobile number.
 */
export function WalletScreen() {
  const wallet = useGetWalletQuery();
  const [redeem, { isLoading: redeeming }] = useRedeemMutation();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const w = wallet.data;

  const submit = async () => {
    setError(null);
    const rupees = Number(amount);
    if (!Number.isInteger(rupees) || rupees < 1) return setError('Enter an amount in rupees, e.g. 10.');
    if (w && rupees > w.balance) return setError(`You can redeem up to ₹${w.balance}.`);
    if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter your mobile number, e.g. 9876543210.');
    try {
      const r = await redeem({ phone, amount: rupees }).unwrap();
      setPhone('');
      setAmount('');
      Toast.success(`₹${r.amount} is on its way to ${r.phone}.`, 2);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not redeem right now.'));
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
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balance}>₹{w.balance}</Text>
            <Text style={styles.balanceNote}>
              {w.balance > 0 ? 'Ready to redeem' : `Best streak: ${w.best_streak}`}
            </Text>
          </Card>

          <Text style={styles.section}>Earn with streaks</Text>
          <View style={styles.milestones}>
            {w.milestones.map(m => (
              <Card key={m.days} style={styles.flex} contentStyle={styles.milestone} accent={m.reached ? colors.success : undefined}>
                <RealIcon name={m.reached ? 'trophy' : 'flame'} size={30} />
                <Text style={styles.milestoneAmount}>₹{m.amount}</Text>
                <Text style={styles.milestoneGoal}>{m.days} streaks</Text>
                <ProgressBar
                  progress={Math.min(w.best_streak / m.days, 1)}
                  height={4}
                  colorsPair={m.reached ? gradients.success : gradients.primary}
                  style={styles.milestoneBar}
                />
                <Text style={[t.caption, m.reached && { color: colors.success }]}>
                  {m.reached ? 'Earned ✓' : `${Math.max(m.days - w.best_streak, 0)} to go`}
                </Text>
              </Card>
            ))}
          </View>

          <Text style={styles.section}>Redeem</Text>
          <Card contentStyle={styles.redeem}>
            <TextField
              label={`Amount (up to ₹${w.balance})`}
              value={amount}
              onChangeText={v => setAmount(v.replace(/[^0-9]/g, ''))}
              placeholder={w.balance ? String(w.balance) : '0'}
              keyboardType="number-pad"
              maxLength={6}
              editable={w.balance > 0}
            />
            <TextField
              label="Mobile number (UPI / wallet)"
              value={phone}
              onChangeText={setPhone}
              placeholder="9876543210"
              keyboardType="phone-pad"
              maxLength={16}
              error={error}
              editable={w.balance > 0}
            />
            <Button
              label={w.balance > 0 ? `Redeem ₹${amount || 0}` : 'Nothing to redeem yet'}
              onPress={submit}
              loading={redeeming}
              disabled={w.balance <= 0 || !amount}
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
                    title={`₹${r.amount} to ${r.phone}`}
                    subtitle={formatFullDate(r.created_at)}
                    right={
                      <View style={styles.status}>
                        {r.status === 'PAID' ? <RealIcon name="check" size={16} /> : <Icon name="clock" size={14} color={colors.textSecondary} />}
                        <Text style={t.caption}>{r.status === 'PAID' ? 'Paid' : 'Processing'}</Text>
                      </View>
                    }
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

const styles = StyleSheet.create({
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
