import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';

export type ReminderStatus = 'ACTIVE' | 'CANCELLED';
export type WhatsAppStatus = 'NOT_REQUESTED' | 'PENDING' | 'SENT' | 'FAILED';

export interface ReminderOut {
  id: string;
  title: string;
  note: string | null;
  remind_at: string;
  status: ReminderStatus;
  whatsapp_number: string | null;
  whatsapp_status: WhatsAppStatus;
  created_at: string;
  updated_at: string;
}

export interface ListRemindersParams {
  include_cancelled?: boolean;
}

export interface CreateReminderRequest {
  title: string;
  note?: string;
  remind_at: string;
  whatsapp_number?: string;
}

export interface UpdateReminderRequest {
  id: string;
  title?: string;
  note?: string;
  remind_at?: string;
  whatsapp_number?: string;
  clear_whatsapp_number?: boolean;
}

export const remindersApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    listReminders: builder.query<ReminderOut[], ListRemindersParams | void>({
      query: arg => ({ url: '/reminders', params: cleanParams({ ...arg }) }),
      providesTags: result =>
        result
          ? [...result.map(r => ({ type: 'Reminder' as const, id: r.id })), { type: 'Reminder' as const, id: 'LIST' }]
          : [{ type: 'Reminder' as const, id: 'LIST' }],
    }),

    getReminder: builder.query<ReminderOut, string>({
      query: id => `/reminders/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Reminder', id }],
    }),

    createReminder: builder.mutation<ReminderOut, CreateReminderRequest>({
      query: body => ({ url: '/reminders', method: 'POST', body }),
      invalidatesTags: [{ type: 'Reminder', id: 'LIST' }],
    }),

    updateReminder: builder.mutation<ReminderOut, UpdateReminderRequest>({
      query: ({ id, ...body }) => ({ url: `/reminders/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Reminder', id: arg.id },
        { type: 'Reminder', id: 'LIST' },
      ],
    }),

    cancelReminder: builder.mutation<ReminderOut, string>({
      query: id => ({ url: `/reminders/${id}/cancel`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Reminder', id },
        { type: 'Reminder', id: 'LIST' },
      ],
    }),

    deleteReminder: builder.mutation<void, string>({
      query: id => ({ url: `/reminders/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Reminder', id: 'LIST' }],
    }),
  }),
});

export const {
  useListRemindersQuery,
  useGetReminderQuery,
  useCreateReminderMutation,
  useUpdateReminderMutation,
  useCancelReminderMutation,
  useDeleteReminderMutation,
} = remindersApi;
