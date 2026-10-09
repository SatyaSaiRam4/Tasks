import { baseApi } from '../../api/baseApi';

export interface WalletMilestone {
  days: number;
  amount: number;
  reached: boolean;
}

export interface WalletRedemption {
  id: string;
  amount: number;
  phone: string;
  status: string;
  created_at: string;
}

export interface Wallet {
  best_streak: number;
  earned: number;
  redeemed: number;
  balance: number;
  milestones: WalletMilestone[];
  redemptions: WalletRedemption[];
}

export const walletApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getWallet: builder.query<Wallet, void>({
      query: () => '/wallet',
      providesTags: ['Wallet'],
    }),
    redeem: builder.mutation<WalletRedemption, { phone: string; amount: number }>({
      query: body => ({ url: '/wallet/redeem', method: 'POST', body }),
      invalidatesTags: ['Wallet'],
    }),
  }),
});

export const { useGetWalletQuery, useRedeemMutation } = walletApi;
