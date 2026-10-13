import { Platform, TurboModuleRegistry } from 'react-native';
import { colors } from '../../theme';
import type { PlanOrder } from './subscriptionsApi';

/**
 * Razorpay's own checkout (react-native-razorpay): Razorpay shows the payment
 * screens and handles cards, UPI and wallets, so Memo never sees payment
 * details. The result only says what the checkout saw; the server confirms
 * the payment with Razorpay before anything is granted.
 *
 * The native module is loaded only when it's needed, so a build without it
 * says checkout isn't available instead of crashing.
 */
export type CheckoutResult =
  | { kind: 'success'; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

export function isCheckoutAvailable(): boolean {
  try {
    return Platform.OS !== 'web' && TurboModuleRegistry.get('RNRazorpayCheckout') != null;
  } catch {
    return false;
  }
}

/** Razorpay's Android SDK reports "closed by the user" as code 0. */
const PAYMENT_CANCELLED = 0;

/** The readable part of Razorpay's error (its description is sometimes JSON). */
export function errorMessage(description: unknown): string {
  if (typeof description !== 'string' || !description) return 'The payment didn’t go through.';
  try {
    const parsed = JSON.parse(description);
    const text = parsed?.error?.description ?? parsed?.description;
    if (typeof text === 'string' && text) return text;
  } catch {
    // plain text
  }
  return description;
}

/** Maps what the SDK resolved or rejected with. Exported for tests. */
export function toResult(outcome: 'resolved' | 'rejected', data: any, orderId: string): CheckoutResult {
  if (outcome === 'resolved') {
    if (data?.razorpay_payment_id && data?.razorpay_signature) {
      return {
        kind: 'success',
        razorpay_order_id: data.razorpay_order_id ?? orderId,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
      };
    }
    return { kind: 'failed', message: 'Razorpay didn’t return the payment details.' };
  }
  if (Number(data?.code) === PAYMENT_CANCELLED) return { kind: 'cancelled' };
  return { kind: 'failed', message: errorMessage(data?.description) };
}

export async function openCheckout(order: PlanOrder): Promise<CheckoutResult> {
  if (!isCheckoutAvailable()) {
    return { kind: 'failed', message: 'Payments need the latest version of the app.' };
  }
  const RazorpayCheckout = require('react-native-razorpay').default;
  try {
    const data = await RazorpayCheckout.open({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount_paise,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: { email: order.prefill_email, name: order.prefill_name },
      theme: { color: colors.primary },
    });
    return toResult('resolved', data, order.order_id);
  } catch (err) {
    return toResult('rejected', err, order.order_id);
  }
}
