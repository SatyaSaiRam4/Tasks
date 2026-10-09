import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { brand, colors, font, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { ErrorState, Skeleton } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { RealIcon } from '../../../components/RealIcon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { useGetWalletQuery, useRedeemMutation } from '../walletApi';

/**
 * The wallet: money earned from streak milestones (500 days → ₹10,
 * 1000 days → ₹20). The user enters a mobile number to redeem it.
 */
export function WalletScreen() {
  const wallet = useGetWalletQuery();
  const [redeem, { isLoading: redeeming }] = useRedeemMutation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const w = wallet.data;

  const submit = async () => {
    setError(null);
    if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter your mobile number, e.g. 9876543210.');
    try {
      const r = await redeem({ phone }).unwrap();
      setPhone('');
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
              {w.balance > 0 ? 'Ready to redeem' : `Best streak: ${w.best_streak} ${w.best_streak === 1 ? 'day' : 'days'}`}
            </Text>
          </Card>

          <Text style={styles.section}>Rewards</Text>
          <ListGroup>
            {w.milestones.map((m, i) => (
              <ListRow
                key={m.days}
                leading={<RealIcon name={m.reached ? 'trophy' : 'flame'} size={32} />}
                title={`${m.days}-day streak`}
                subtitle={m.reached ? 'Earned' : `${Math.max(m.days - w.best_streak, 0)} days to go`}
                value={`₹${m.amount}`}
                last={i === w.milestones.length - 1}
              />
            ))}
          </ListGroup>

          {w.balance > 0 ? (
            <View style={styles.mtXl}>
              <TextField
                label="Mobile number"
                value={phone}
                onChangeText={setPhone}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={16}
                error={error}
              />
              <Button label={`Redeem ₹${w.balance}`} onPress={submit} loading={redeeming} size="lg" />
            </View>
          ) : null}

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
  mtXl: {
    marginTop: spacing.xl,
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
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
