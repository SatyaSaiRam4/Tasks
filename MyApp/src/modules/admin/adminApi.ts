import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';
import type { UserRole } from '../auth/authSlice';

export interface AdminDashboardOut {
  total_users: number;
  active_users: number;
  admin_users: number;
  total_tracks: number;
  total_actions: number;
  completions_today: number;
  total_completions: number;
  vault_entries: number;
  avg_current_streak: number;
  max_best_streak: number;
  reminders_active: number;
  whatsapp_sent: number;
  whatsapp_failed: number;
  whatsapp_pending: number;
}

export interface AdminUserOut {
  id: string;
  email: string;
  display_name: string;
  public_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AdminRedemption {
  id: string;
  user_email: string | null;
  amount: number;
  points: number;
  phone: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  payout_reference: string | null;
  note: string | null;
  decided_by_email: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface AdminPayment {
  id: string;
  user_email: string | null;
  purpose: string;
  amount_paise: number;
  currency: string;
  mode: 'test' | 'live';
  status: 'CREATED' | 'PAID' | 'FAILED' | 'EXPIRED';
  provider_order_id: string;
  provider_payment_id: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface AdminPlan {
  user_email: string | null;
  free_used: number;
  messages_total: number;
  messages_used: number;
  starts_at: string;
  expires_at: string;
  ended_at: string | null;
  active: boolean;
  provider_order_id: string;
}

export const adminApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getAdminDashboard: builder.query<AdminDashboardOut, void>({
      query: () => '/admin/dashboard',
      providesTags: ['AdminDashboard'],
    }),

    listAdminUsers: builder.query<AdminUserOut[], { search?: string } | void>({
      query: arg => ({ url: '/admin/users', params: cleanParams({ search: arg?.search }) }),
      providesTags: result =>
        result
          ? [...result.map(u => ({ type: 'AdminUser' as const, id: u.id })), { type: 'AdminUser' as const, id: 'LIST' }]
          : [{ type: 'AdminUser' as const, id: 'LIST' }],
    }),

    disableAdminUser: builder.mutation<AdminUserOut, string>({
      query: id => ({ url: `/admin/users/${id}/disable`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'AdminUser', id },
        { type: 'AdminUser', id: 'LIST' },
        'AdminDashboard',
      ],
    }),

    enableAdminUser: builder.mutation<AdminUserOut, string>({
      query: id => ({ url: `/admin/users/${id}/enable`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'AdminUser', id },
        { type: 'AdminUser', id: 'LIST' },
        'AdminDashboard',
      ],
    }),

    updateAdminUserRole: builder.mutation<AdminUserOut, { id: string; role: UserRole }>({
      query: ({ id, role }) => ({ url: `/admin/users/${id}/role`, method: 'PATCH', body: { role } }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'AdminUser', id: arg.id },
        { type: 'AdminUser', id: 'LIST' },
        'AdminDashboard',
      ],
    }),

    listAdminRedemptions: builder.query<AdminRedemption[], { status?: string } | void>({
      query: arg => ({ url: '/admin/redemptions', params: cleanParams({ status: arg?.status }) }),
      providesTags: ['AdminMoney'],
    }),
    /** Only after the payout has really been sent: the UPI / bank reference is recorded with who and when. */
    markRedemptionPaid: builder.mutation<AdminRedemption, { id: string; reference: string }>({
      query: ({ id, reference }) => ({ url: `/admin/redemptions/${id}/paid`, method: 'POST', body: { reference } }),
      invalidatesTags: ['AdminMoney'],
    }),
    rejectRedemption: builder.mutation<AdminRedemption, { id: string; note: string }>({
      query: ({ id, note }) => ({ url: `/admin/redemptions/${id}/reject`, method: 'POST', body: { note } }),
      invalidatesTags: ['AdminMoney'],
    }),
    listAdminPayments: builder.query<AdminPayment[], void>({
      query: () => '/admin/payments',
      providesTags: ['AdminMoney'],
    }),
    listAdminPlans: builder.query<AdminPlan[], void>({
      query: () => '/admin/whatsapp-plans',
      providesTags: ['AdminMoney'],
    }),
  }),
});

export const {
  useListAdminRedemptionsQuery,
  useMarkRedemptionPaidMutation,
  useRejectRedemptionMutation,
  useListAdminPaymentsQuery,
  useListAdminPlansQuery,
  useGetAdminDashboardQuery,
  useListAdminUsersQuery,
  useDisableAdminUserMutation,
  useEnableAdminUserMutation,
  useUpdateAdminUserRoleMutation,
} = adminApi;
