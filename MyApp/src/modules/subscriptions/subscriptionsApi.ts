import { baseApi } from '../../api/baseApi';

/**
 * The account's WhatsApp allowance, always from the server: 3 free WhatsApp
 * reminders per account, then the plan (₹30 for 100 over 30 days).
 */
export interface WhatsAppPlan {
  free_total: number;
  free_used: number;
  free_remaining: number;
  /** NONE (never bought), ACTIVE, USED_UP (all used, period not over), EXPIRED */
  plan_status: 'NONE' | 'ACTIVE' | 'USED_UP' | 'EXPIRED';
  paid_remaining: number;
  plan_messages_total: number;
  plan_messages_used: number;
  plan_starts_at: string | null;
  plan_expires_at: string | null;
  /** Free ones used and nothing left on a plan: WhatsApp reminders need a plan. */
  purchase_required: boolean;
  /** False until Razorpay is set up on the server. */
  payments_enabled: boolean;
  payments_mode: 'test' | 'live';
  price_paise: number;
  currency: string;
  plan_messages: number;
  plan_days: number;
  /** A checkout started recently and not yet confirmed (the server keeps checking it). */
  pending_order_id: string | null;
}

/** What Razorpay's checkout needs; the price and plan come from the server. */
export interface PlanOrder {
  order_id: string;
  /** Razorpay's public key id (the secret never leaves the server). */
  key_id: string;
  amount_paise: number;
  currency: string;
  name: string;
  description: string;
  prefill_email: string;
  prefill_name: string;
  mode: 'test' | 'live';
}

export interface VerifyResult {
  /** PAID: plan active · PENDING: Razorpay hasn't confirmed yet · FAILED · MISMATCH */
  state: 'PAID' | 'PENDING' | 'FAILED' | 'MISMATCH';
  plan: WhatsAppPlan;
}

export const subscriptionsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getWhatsAppPlan: builder.query<WhatsAppPlan, void>({
      query: () => '/subscriptions/whatsapp',
      providesTags: ['WhatsAppPlan'],
      keepUnusedDataFor: 0,
    }),
    createPlanOrder: builder.mutation<PlanOrder, void>({
      query: () => ({ url: '/subscriptions/whatsapp/order', method: 'POST' }),
    }),
    verifyPlanPayment: builder.mutation<
      VerifyResult,
      { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
    >({
      query: body => ({ url: '/subscriptions/whatsapp/verify', method: 'POST', body }),
      invalidatesTags: ['WhatsAppPlan'],
    }),
  }),
});

export const { useGetWhatsAppPlanQuery, useCreatePlanOrderMutation, useVerifyPlanPaymentMutation } = subscriptionsApi;

/** "₹30" from paise. */
export function rupees(paise: number): string {
  return `₹${Math.round(paise) / 100}`;
}

/** One line for the reminder editor: what's left, in plain words. */
export function allowanceLine(p: WhatsAppPlan): string {
  if (p.plan_status === 'ACTIVE') return `WhatsApp plan: ${p.paid_remaining} messages left${p.free_remaining ? ` (+${p.free_remaining} free)` : ''}`;
  if (p.free_remaining > 0) return `${p.free_remaining} of ${p.free_total} free WhatsApp reminders left`;
  return `Free WhatsApp reminders used · plan ${rupees(p.price_paise)} for ${p.plan_messages}`;
}
