import { errorMessage, toResult } from '../src/modules/subscriptions/checkout';
import { allowanceLine, rupees, type WhatsAppPlan } from '../src/modules/subscriptions/subscriptionsApi';

const base: WhatsAppPlan = {
  free_total: 3,
  free_used: 0,
  free_remaining: 3,
  plan_status: 'NONE',
  paid_remaining: 0,
  plan_messages_total: 0,
  plan_messages_used: 0,
  plan_starts_at: null,
  plan_expires_at: null,
  purchase_required: false,
  payments_enabled: true,
  payments_mode: 'test',
  price_paise: 3000,
  currency: 'INR',
  plan_messages: 100,
  plan_days: 30,
  pending_order_id: null,
};

describe('checkout results', () => {
  it('passes Razorpay’s ids on for the server to check', () => {
    expect(
      toResult('resolved', { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'abc' }, 'order_1'),
    ).toEqual({ kind: 'success', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'abc' });
  });

  it('never treats an incomplete success as paid', () => {
    expect(toResult('resolved', { razorpay_payment_id: 'pay_1' }, 'order_1').kind).toBe('failed');
  });

  it('tells a cancel from a failure', () => {
    expect(toResult('rejected', { code: 0, description: 'Payment cancelled' }, 'o')).toEqual({ kind: 'cancelled' });
    expect(toResult('rejected', { code: 2, description: 'Network error' }, 'o')).toEqual({ kind: 'failed', message: 'Network error' });
  });

  it('reads Razorpay’s JSON error descriptions', () => {
    expect(errorMessage(JSON.stringify({ error: { description: 'Card declined' } }))).toBe('Card declined');
    expect(errorMessage(undefined)).toBe('The payment didn’t go through.');
  });
});

describe('allowance wording', () => {
  it('counts the free ones down, then shows the plan', () => {
    expect(allowanceLine({ ...base, free_used: 1, free_remaining: 2 })).toBe('2 of 3 free WhatsApp reminders left');
    // This build can't sell the plan (PLAN_PURCHASE_ENABLED is off for Google Play): no price shown.
    expect(allowanceLine({ ...base, free_used: 3, free_remaining: 0, purchase_required: true })).toBe(
      'Your 3 free WhatsApp reminders are used · more coming soon',
    );
    expect(allowanceLine({ ...base, free_used: 3, free_remaining: 0, plan_status: 'ACTIVE', paid_remaining: 87 })).toBe(
      'WhatsApp plan: 87 messages left',
    );
    expect(rupees(3000)).toBe('₹30');
  });
});
