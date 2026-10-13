import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { colors, font, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Segmented } from '../../../components/Controls';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { Button } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import { EmptyState, ErrorState, SkeletonList } from '../../../components/Feedback';
import { getErrorMessage } from '../../../utils/apiError';
import { formatDateTime, formatFullDate } from '../../../utils/date';
import {
  useListAdminPaymentsQuery,
  useListAdminPlansQuery,
  useListAdminRedemptionsQuery,
  useMarkRedemptionPaidMutation,
  useRejectRedemptionMutation,
  type AdminRedemption,
} from '../adminApi';

type Tab = 'payouts' | 'payments' | 'plans';

/**
 * Admins: money in and out. Payouts (streak points redeemed for cash) are
 * paid by hand, then marked PAID here with the UPI / bank reference (who and
 * when are recorded), or rejected with a reason (the points go back). Also
 * the WhatsApp plan payments and the plans with their usage. Read-only
 * otherwise; no secrets are shown.
 */
export function AdminMoneyScreen() {
  const [tab, setTab] = useState<Tab>('payouts');
  return (
    <Screen>
      <ScreenHeader title="Money" subtitle="Admin" />
      <Segmented
        options={[
          { value: 'payouts', label: 'Payouts' },
          { value: 'payments', label: 'Payments' },
          { value: 'plans', label: 'Plans' },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />
      {tab === 'payouts' ? <Payouts /> : tab === 'payments' ? <Payments /> : <Plans />}
    </Screen>
  );
}

function Payouts() {
  const list = useListAdminRedemptionsQuery();
  const [markPaid, paying] = useMarkRedemptionPaidMutation();
  const [reject, rejecting] = useRejectRedemptionMutation();
  const [acting, setActing] = useState<{ r: AdminRedemption; paid: boolean } | null>(null);
  const [text, setText] = useState('');

  if (list.isLoading) return <SkeletonList />;
  if (list.isError) return <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} />;
  const rows = list.data ?? [];
  if (!rows.length) return <EmptyState icon="wallet" title="No payouts yet" message="Redemptions from users' wallets appear here." />;

  const confirm = async () => {
    if (!acting) return;
    const value = text.trim();
    if (value.length < 3) return Toast.fail(acting.paid ? 'Enter the payment reference.' : 'Enter a reason.', 2);
    try {
      if (acting.paid) await markPaid({ id: acting.r.id, reference: value }).unwrap();
      else await reject({ id: acting.r.id, note: value }).unwrap();
      Toast.success(acting.paid ? 'Marked as paid.' : 'Rejected. The points went back.', 1.6);
      setActing(null);
      setText('');
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return (
    <>
      <ListGroup>
        {rows.map((r, i) => (
          <View key={r.id} style={[styles.payout, i < rows.length - 1 && styles.divider]}>
            <View style={styles.rowHead}>
              <Text style={t.bodyStrong}>
                ₹{r.amount} · {r.points} points
              </Text>
              <Text style={[styles.badge, { color: r.status === 'PAID' ? colors.success : r.status === 'REJECTED' ? colors.danger : colors.warning }]}>
                {r.status}
              </Text>
            </View>
            <Text style={t.caption}>
              {r.user_email ?? 'Deleted user'} → {r.phone} · {formatDateTime(r.created_at)}
            </Text>
            {r.status === 'PAID' ? (
              <Text style={t.caption}>
                Ref {r.payout_reference} · by {r.decided_by_email ?? '—'} · {r.decided_at ? formatDateTime(r.decided_at) : ''}
              </Text>
            ) : null}
            {r.status === 'REJECTED' ? (
              <Text style={t.caption}>
                {r.note} · by {r.decided_by_email ?? '—'}
              </Text>
            ) : null}
            {r.status === 'PENDING' ? (
              <View style={styles.actions}>
                <Button label="Mark paid" size="sm" icon="check" onPress={() => setActing({ r, paid: true })} />
                <Button label="Reject" size="sm" variant="dangerGhost" onPress={() => setActing({ r, paid: false })} />
              </View>
            ) : null}
          </View>
        ))}
      </ListGroup>
      <ConfirmSheet
        visible={acting !== null}
        icon={acting?.paid ? 'check' : 'x'}
        destructive={!acting?.paid}
        title={acting?.paid ? `Paid ₹${acting.r.amount} to ${acting.r.phone}?` : 'Reject this payout?'}
        message={
          acting?.paid
            ? 'Only after you have actually sent the money. Enter the UPI / bank reference.'
            : 'The user gets their points back. Say why (they see this).'
        }
        confirmLabel={acting?.paid ? 'Mark paid' : 'Reject'}
        loading={paying.isLoading || rejecting.isLoading}
        onConfirm={confirm}
        onCancel={() => {
          setActing(null);
          setText('');
        }}
      >
        <TextField
          label={acting?.paid ? 'Payment reference' : 'Reason'}
          value={text}
          onChangeText={setText}
          placeholder={acting?.paid ? 'e.g. UPI 412345678901' : 'e.g. Wrong number'}
          maxLength={acting?.paid ? 120 : 255}
        />
      </ConfirmSheet>
    </>
  );
}

function Payments() {
  const list = useListAdminPaymentsQuery();
  if (list.isLoading) return <SkeletonList />;
  if (list.isError) return <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} />;
  const rows = list.data ?? [];
  if (!rows.length) return <EmptyState icon="wallet" title="No payments yet" message="WhatsApp plan purchases appear here." />;
  return (
    <ListGroup>
      {rows.map((p, i) => (
        <ListRow
          key={p.id}
          title={`₹${p.amount_paise / 100} · ${p.status}${p.mode === 'test' ? ' · test' : ''}`}
          subtitle={`${p.user_email ?? 'Deleted user'} · ${formatDateTime(p.created_at)}\n${p.provider_order_id}${p.provider_payment_id ? ` · ${p.provider_payment_id}` : ''}${p.failure_reason ? `\n${p.failure_reason}` : ''}`}
          last={i === rows.length - 1}
        />
      ))}
    </ListGroup>
  );
}

function Plans() {
  const list = useListAdminPlansQuery();
  if (list.isLoading) return <SkeletonList />;
  if (list.isError) return <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} />;
  const rows = list.data ?? [];
  if (!rows.length) return <EmptyState icon="message" title="No WhatsApp plans yet" message="Plans bought by users appear here." />;
  return (
    <ListGroup>
      {rows.map((p, i) => (
        <ListRow
          key={`${p.provider_order_id}`}
          title={`${p.user_email ?? 'Deleted user'} · ${p.active ? 'Active' : p.ended_at ? 'Renewed' : 'Ended'}`}
          subtitle={`${p.messages_used} of ${p.messages_total} messages used · free ${p.free_used}/3\n${formatFullDate(p.starts_at)} → ${formatFullDate(p.expires_at)}`}
          last={i === rows.length - 1}
        />
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginBottom: spacing.lg,
  },
  payout: {
    padding: spacing.md,
    gap: 2,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    ...font.bold,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
