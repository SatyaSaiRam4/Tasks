import { baseApi } from '../../api/baseApi';

export interface WalletMilestone {
  /** The best streak that unlocks it. */
  days: number;
  /** Rupees it's worth. */
  amount: number;
  /** Points it unlocks (once, ever). */
  points: number;
  reached: boolean;
}

/** What can be redeemed: 500 points (₹10) or 1000 points (₹20). */
export interface WalletChoice {
  points: number;
  amount: number;
  available: boolean;
}

export type RedemptionStatus = 'PENDING' | 'PAID' | 'REJECTED';

export interface WalletRedemption {
  id: string;
  amount: number;
  points: number;
  phone: string;
  status: RedemptionStatus;
  /** The UPI / bank reference once it's paid. */
  payout_reference: string | null;
  /** Why it wasn't paid (its points came back). */
  note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Wallet {
  best_streak: number;
  /** Includes today's finished plans, like the dashboard. */
  live_best_streak?: number;
  earned: number;
  redeemed: number;
  balance: number;
  points_unlocked: number;
  points_redeemed: number;
  points_available: number;
  choices: WalletChoice[];
  milestones: WalletMilestone[];
  redemptions: WalletRedemption[];
}

export const walletApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getWallet: builder.query<Wallet, void>({
      query: () => '/wallet',
      providesTags: ['Wallet'],
    }),
    /** `request_id` makes a repeated tap (or a retry after a dropped connection) return the same redemption. */
    redeem: builder.mutation<WalletRedemption, { phone: string; points: number; request_id: string }>({
      query: body => ({ url: '/wallet/redeem', method: 'POST', body }),
      invalidatesTags: ['Wallet'],
    }),
  }),
});

export const { useGetWalletQuery, useRedeemMutation } = walletApi;

/** A fresh id for one redemption request. */
export function newRequestId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
