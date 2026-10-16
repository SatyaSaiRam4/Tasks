import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  brand,
  colors,
  font,
  spacing,
  type as t,
  withAlpha,
} from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { ErrorState, Skeleton } from '../../../components/Feedback';
import { ProgressBar } from '../../../components/Progress';
import { Icon, type IconName } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { openCheckout } from '../checkout';
import { PLAN_PURCHASE_ENABLED } from '../../../config/env';
import {
  rupees,
  useCreatePlanOrderMutation,
  useGetWhatsAppPlanQuery,
  useVerifyPlanPaymentMutation,
  type WhatsAppPlan,
} from '../subscriptionsApi';

/** Where a purchase is: nothing shown, Razorpay open, confirming, waiting on Razorpay, done, or not done. */
type Step =
  | { kind: 'idle' }
  | { kind: 'opening' }
  | { kind: 'verifying' }
  | { kind: 'pending' }
  | { kind: 'paid' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

/**
 * The WhatsApp plan: 3 free WhatsApp reminders per account, then ₹30 for 100
 * over 30 days. Everything shown comes from the server. Buying opens
 * Razorpay's checkout; the plan only shows as active once the server has
 * confirmed the payment with Razorpay (if that takes a moment, this screen
 * keeps checking, and so does the server after an app restart).
 */
export function WhatsAppPlanScreen() {
  const plan = useGetWhatsAppPlanQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const [createOrder] = useCreatePlanOrderMutation();
  const [verify] = useVerifyPlanPaymentMutation();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const busy = step.kind === 'opening' || step.kind === 'verifying';
  const p = plan.data;

  // Waiting on Razorpay (or a checkout started before the app was closed):
  // ask the server every few seconds for up to 2 minutes.
  const waiting =
    step.kind === 'pending' ||
    (step.kind === 'idle' && Boolean(p?.pending_order_id));
  const polls = useRef(0);
  const { refetch } = plan;
  useEffect(() => {
    if (!waiting) return;
    polls.current = 0;
    const id = setInterval(() => {
      polls.current += 1;
      if (polls.current > 30) clearInterval(id);
      else refetch();
    }, 4000);
    return () => clearInterval(id);
  }, [waiting, refetch]);
  // Confirmed while waiting.
  useEffect(() => {
    if (
      step.kind === 'pending' &&
      p?.plan_status === 'ACTIVE' &&
      !p.pending_order_id
    )
      setStep({ kind: 'paid' });
  }, [step.kind, p?.plan_status, p?.pending_order_id]);

  // Set at once (state updates wait for the next render), so a double tap opens one checkout.
  const buying = useRef(false);
  const buy = async () => {
    if (busy || buying.current) return;
    buying.current = true;
    setStep({ kind: 'opening' });
    try {
      const order = await createOrder().unwrap();
      const result = await openCheckout(order);
      if (result.kind === 'cancelled') return setStep({ kind: 'cancelled' });
      if (result.kind === 'failed')
        return setStep({ kind: 'failed', message: result.message });
      setStep({ kind: 'verifying' });
      const res = await verify({
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      }).unwrap();
      if (res.state === 'PAID') setStep({ kind: 'paid' });
      else if (res.state === 'PENDING') setStep({ kind: 'pending' });
      else
        setStep({
          kind: 'failed',
          message:
            res.state === 'FAILED'
              ? 'The payment didn’t go through.'
              : 'This payment couldn’t be matched to the plan.',
        });
    } catch (err) {
      setStep({
        kind: 'failed',
        message: getErrorMessage(
          err,
          'Couldn’t complete the payment. Please try again.',
        ),
      });
    } finally {
      buying.current = false;
      plan.refetch();
    }
  };

  if (plan.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="WhatsApp plan" />
        <Skeleton height={170} />
        <Skeleton height={120} style={styles.mtLg} />
      </Screen>
    );
  }
  if (plan.isError || !p) {
    return (
      <Screen>
        <ScreenHeader title="WhatsApp plan" />
        <ErrorState
          message={getErrorMessage(
            plan.error,
            'Couldn’t load your WhatsApp plan.',
          )}
          onRetry={plan.refetch}
        />
      </Screen>
    );
  }

  const price = rupees(p.price_paise);
  const active = p.plan_status === 'ACTIVE';
  const canBuy = p.payments_enabled && !busy && step.kind !== 'pending';

  return (
    <Screen onRefresh={plan.refetch} refreshing={plan.isFetching && !waiting}>
      <ScreenHeader title="WhatsApp plan" subtitle="Reminders on WhatsApp" />

      <Card tone="hero" contentStyle={styles.hero}>
        <Text style={styles.heroLabel}>
          {active ? 'Messages left' : 'Free WhatsApp reminders left'}
        </Text>
        <Text style={styles.heroNumber}>
          {active ? p.paid_remaining + p.free_remaining : p.free_remaining}
        </Text>
        <Text style={styles.heroNote}>{heroNote(p)}</Text>
        {active && p.plan_messages_total ? (
          <ProgressBar
            progress={p.plan_messages_used / p.plan_messages_total}
            height={5}
            style={styles.heroBar}
          />
        ) : null}
      </Card>

      {p.purchase_required ? (
        <Notice
          icon="message"
          tone={colors.warning}
          text={
            PLAN_PURCHASE_ENABLED
              ? `Your ${p.free_total} free WhatsApp reminders are used. The plan is ${price} for ${p.plan_messages} WhatsApp reminders over ${p.plan_days} days.`
              : `Your ${p.free_total} free WhatsApp reminders are used. More WhatsApp reminders are coming soon.`
          }
        />
      ) : null}

      {!PLAN_PURCHASE_ENABLED ? (
        // This build can't sell the plan (Google Play): nothing to buy, no price.
        <Card contentStyle={styles.offer}>
          <Text style={styles.offerLine}>WhatsApp plan coming soon</Text>
          <Text style={[t.caption, styles.offerNote]}>
            For now, every account gets {p.free_total} WhatsApp reminders free.
            Alarms and phone notifications are always free.
          </Text>
        </Card>
      ) : (
        <>
          <Text style={styles.section}>{active ? 'Renew' : 'The plan'}</Text>
          <Card contentStyle={styles.offer}>
            <Text style={styles.price}>{price}</Text>
            <Text style={styles.offerLine}>
              {p.plan_messages} WhatsApp reminders · {p.plan_days} days
            </Text>
            <Text style={[t.caption, styles.offerNote]}>
              {active
                ? 'Renewing starts a new 30 days now and keeps your unused messages.'
                : 'Starts when your payment is confirmed. No automatic renewal: you choose when to renew.'}
            </Text>
            <StepNote step={step} />
            <Button
              label={
                !p.payments_enabled
                  ? 'Payments coming soon'
                  : active
                  ? `Renew for ${price}`
                  : `Get the plan for ${price}`
              }
              onPress={buy}
              loading={busy}
              disabled={!canBuy}
              size="lg"
              style={styles.mtMd}
            />
            {p.payments_mode === 'test' && p.payments_enabled ? (
              <Text style={[t.caption, styles.offerNote]}>
                Test mode: no real money is charged.
              </Text>
            ) : null}
            <Text style={[t.caption, styles.offerNote]}>
              Paid securely with Razorpay. Memo never sees your card or UPI
              details.
            </Text>
          </Card>
        </>
      )}

      <Text style={[t.caption, styles.footnote]}>
        Only numbers that replied YES get your WhatsApp reminders, with or
        without a plan. Alarms and phone notifications are always free.
      </Text>
    </Screen>
  );
}

function heroNote(p: WhatsAppPlan): string {
  if (p.plan_status === 'ACTIVE' && p.plan_expires_at)
    return `Plan active until ${formatFullDate(p.plan_expires_at)}`;
  if (p.plan_status === 'USED_UP')
    return 'All plan messages used. Renew to keep going.';
  if (p.plan_status === 'EXPIRED' && p.plan_expires_at)
    return `Plan ended on ${formatFullDate(p.plan_expires_at)}`;
  return `${p.free_used} of ${p.free_total} free ones used`;
}

function StepNote({ step }: { step: Step }) {
  if (step.kind === 'opening')
    return (
      <Notice
        icon="clock"
        tone={colors.textSecondary}
        text="Opening Razorpay…"
        busy
      />
    );
  if (step.kind === 'verifying')
    return (
      <Notice
        icon="clock"
        tone={colors.textSecondary}
        text="Confirming your payment…"
        busy
      />
    );
  if (step.kind === 'pending')
    return (
      <Notice
        icon="clock"
        tone={colors.gold}
        text="Waiting for Razorpay to confirm the payment. This usually takes a few seconds."
        busy
      />
    );
  if (step.kind === 'paid')
    return (
      <Notice
        icon="check-circle"
        tone={colors.success}
        text="Payment confirmed. Your WhatsApp plan is active."
      />
    );
  if (step.kind === 'cancelled')
    return (
      <Notice
        icon="x"
        tone={colors.textSecondary}
        text="Payment cancelled. Nothing was charged."
      />
    );
  if (step.kind === 'failed')
    return (
      <Notice
        icon="alert"
        tone={colors.danger}
        text={`${step.message} You can try again.`}
      />
    );
  return null;
}

function Notice({
  icon,
  tone,
  text,
  busy,
}: {
  icon: IconName;
  tone: string;
  text: string;
  busy?: boolean;
}) {
  return (
    <View
      style={[styles.notice, { backgroundColor: withAlpha(tone, 0.12) }]}
      accessibilityLiveRegion="polite"
    >
      {busy ? (
        <ActivityIndicator size="small" color={tone} />
      ) : (
        <Icon name={icon} size={16} color={tone} />
      )}
      <Text
        style={[
          styles.noticeText,
          { color: tone === colors.textSecondary ? colors.text : tone },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mtLg: {
    marginTop: spacing.lg,
  },
  mtMd: {
    marginTop: spacing.md,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  heroLabel: {
    ...t.micro,
    color: brand.champagne,
  },
  heroNumber: {
    ...t.hero,
    fontSize: 60,
    lineHeight: 66,
    color: brand.champagneLight,
    marginTop: spacing.xs,
  },
  heroNote: {
    ...font.semibold,
    fontSize: 13,
    color: colors.heroTextSecondary,
    marginTop: spacing.xs,
  },
  heroBar: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  section: {
    ...t.micro,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  offer: {
    padding: spacing.lg,
    alignItems: 'stretch',
  },
  price: {
    ...font.serif,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    textAlign: 'center',
  },
  offerLine: {
    ...font.semibold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  offerNote: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  noticeText: {
    ...font.semibold,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  footnote: {
    textAlign: 'center',
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
  },
});
