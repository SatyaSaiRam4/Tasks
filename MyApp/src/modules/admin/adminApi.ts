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
  }),
});

export const {
  useGetAdminDashboardQuery,
  useListAdminUsersQuery,
  useDisableAdminUserMutation,
  useEnableAdminUserMutation,
  useUpdateAdminUserRoleMutation,
} = adminApi;
