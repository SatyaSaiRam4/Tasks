import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';

export type ReminderStatus = 'ACTIVE' | 'CANCELLED';
export type WhatsAppStatus = 'NOT_REQUESTED' | 'PENDING' | 'SENT' | 'FAILED';
export type ReminderPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface Reminder {
  id: string;
  title: string;
  note: string | null;
  remind_at: string;
  status: ReminderStatus;
  whatsapp_number: string | null;
  whatsapp_status: WhatsAppStatus;
  alarm_enabled: boolean;
  priority: ReminderPriority;
  track_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
/** @deprecated kept for older imports */
export type ReminderOut = Reminder;

export interface ReminderInput {
  title: string;
  note?: string | null;
  remind_at: string;
  whatsapp_number?: string | null;
  alarm_enabled?: boolean;
  priority?: ReminderPriority;
  track_id?: string | null;
}

export interface ReminderUpdate extends Partial<ReminderInput> {
  id: string;
  clear_whatsapp_number?: boolean;
  clear_track?: boolean;
}

const TAGS = ['Reminder', 'Dashboard'] as const;

export const remindersApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    listReminders: builder.query<Reminder[], { include_cancelled?: boolean } | void>({
      query: arg => ({ url: '/reminders', params: cleanParams({ include_cancelled: arg?.include_cancelled }) }),
      providesTags: ['Reminder'],
    }),
    getReminder: builder.query<Reminder, string>({
      query: id => `/reminders/${id}`,
      providesTags: ['Reminder'],
    }),
    createReminder: builder.mutation<Reminder, ReminderInput>({
      query: body => ({ url: '/reminders', method: 'POST', body }),
      invalidatesTags: [...TAGS],
    }),
    updateReminder: builder.mutation<Reminder, ReminderUpdate>({
      query: ({ id, ...body }) => ({ url: `/reminders/${id}`, method: 'PATCH', body }),
      invalidatesTags: [...TAGS],
    }),
    setReminderCompleted: builder.mutation<Reminder, { id: string; completed: boolean }>({
      query: ({ id, completed }) => ({ url: `/reminders/${id}/${completed ? 'complete' : 'uncomplete'}`, method: 'POST' }),
      invalidatesTags: [...TAGS],
    }),
    snoozeReminder: builder.mutation<Reminder, { id: string; minutes: number }>({
      query: ({ id, minutes }) => ({ url: `/reminders/${id}/snooze`, method: 'POST', body: { minutes } }),
      invalidatesTags: [...TAGS],
    }),
    cancelReminder: builder.mutation<Reminder, string>({
      query: id => ({ url: `/reminders/${id}/cancel`, method: 'POST' }),
      invalidatesTags: [...TAGS],
    }),
    deleteReminder: builder.mutation<void, string>({
      query: id => ({ url: `/reminders/${id}`, method: 'DELETE' }),
      invalidatesTags: [...TAGS],
    }),
  }),
});

export const {
  useListRemindersQuery,
  useGetReminderQuery,
  useCreateReminderMutation,
  useUpdateReminderMutation,
  useSetReminderCompletedMutation,
  useSnoozeReminderMutation,
  useCancelReminderMutation,
  useDeleteReminderMutation,
} = remindersApi;
