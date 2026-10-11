import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH';
export type RepeatType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';
export type TrackStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'ARCHIVED';

export interface Track {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  start_date: string;
  end_date: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  status: TrackStatus;
  action_count: number;
  today_required: number;
  today_completed: number;
  day_number: number | null;
  total_days: number | null;
  days_remaining: number | null;
  streak: number;
  completion_rate: number;
}

export interface TrackDay {
  date: string;
  required: number;
  completed: number;
  status: string;
}

/** The category table: rows are tasks, columns are days. */
export type GridCell = 'DONE' | 'MISSED' | 'TODO' | 'FUTURE' | 'NONE';

export interface TrackGrid {
  today: string;
  days: string[];
  rows: { action_id: string; title: string; cells: GridCell[] }[];
}

export interface ActionStep {
  id: string;
  title: string;
  sort_order: number;
}

export interface Action {
  id: string;
  track_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  time_of_day: string | null;
  start_date: string;
  end_date: string | null;
  repeat_type: RepeatType;
  repeat_weekdays: number[] | null;
  repeat_interval_days: number | null;
  is_required: boolean;
  reminder_enabled: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  steps: ActionStep[];
}

export interface AgendaItem {
  action: Action;
  is_completed: boolean;
  completed_at: string | null;
}

export interface AgendaGroup {
  track: { id: string; name: string; icon: string | null; color: string | null };
  items: AgendaItem[];
  required: number;
  completed: number;
}

export interface Agenda {
  date: string;
  is_today: boolean;
  editable: boolean;
  required: number;
  completed: number;
  groups: AgendaGroup[];
}

export interface TrackInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  clear_end_date?: boolean;
}

export interface ActionInput {
  title: string;
  description?: string | null;
  priority?: Priority;
  time_of_day?: string | null;
  clear_time?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  clear_end_date?: boolean;
  repeat_type?: RepeatType;
  repeat_weekdays?: number[] | null;
  repeat_interval_days?: number | null;
  is_required?: boolean;
  reminder_enabled?: boolean;
  is_active?: boolean;
  steps?: string[];
}

export interface AchievementBrief {
  code: string;
  title: string;
  description: string;
  icon: string;
}

export interface CompletionResult {
  action_id: string;
  date: string;
  is_completed: boolean;
  completed_at: string | null;
  already_completed: boolean;
  day_secured: boolean;
  day_just_secured: boolean;
  /** This tick finished one plan for today: +1 streak. */
  plan_just_finished?: boolean;
  plan_name?: string | null;
  plans_due?: number;
  plans_done?: number;
  today_required: number;
  today_completed: number;
  current_streak: number;
  best_streak: number;
  new_achievements: AchievementBrief[];
}

// Everything a completion changes.
const COMPLETION_TAGS = ['Agenda', 'Track', 'Streak', 'Dashboard', 'Profile', 'Achievement', 'Wallet'] as const;
const DEFINITION_TAGS = ['Agenda', 'Track', 'Action', 'Streak', 'Dashboard'] as const;

export const routinesApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    listTracks: builder.query<Track[], { includeArchived?: boolean } | void>({
      query: arg => ({ url: '/tracks', params: cleanParams({ include_archived: arg?.includeArchived }) }),
      providesTags: ['Track'],
    }),
    getTrack: builder.query<Track, string>({
      query: id => `/tracks/${id}`,
      providesTags: ['Track'],
    }),
    trackDays: builder.query<TrackDay[], { id: string; from?: string; to?: string }>({
      query: ({ id, from, to }) => ({ url: `/tracks/${id}/days`, params: cleanParams({ from, to }) }),
      providesTags: ['Track'],
    }),
    trackGrid: builder.query<TrackGrid, string>({
      query: id => `/tracks/${id}/grid`,
      providesTags: ['Track', 'Action'],
    }),
    createTrack: builder.mutation<Track, TrackInput>({
      query: body => ({ url: '/tracks', method: 'POST', body }),
      invalidatesTags: [...DEFINITION_TAGS],
    }),
    updateTrack: builder.mutation<Track, Partial<TrackInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/tracks/${id}`, method: 'PATCH', body }),
      invalidatesTags: [...DEFINITION_TAGS],
    }),
    archiveTrack: builder.mutation<Track, { id: string; archived: boolean }>({
      query: ({ id, archived }) => ({ url: `/tracks/${id}/${archived ? 'archive' : 'restore'}`, method: 'POST' }),
      invalidatesTags: [...DEFINITION_TAGS],
    }),
    deleteTrack: builder.mutation<void, string>({
      query: id => ({ url: `/tracks/${id}`, method: 'DELETE' }),
      invalidatesTags: [...DEFINITION_TAGS],
    }),

    listTrackActions: builder.query<Action[], string>({
      query: trackId => `/tracks/${trackId}/actions`,
      providesTags: ['Action'],
    }),
    getAction: builder.query<Action, string>({
      query: id => `/actions/${id}`,
      providesTags: ['Action'],
    }),
    createAction: builder.mutation<Action, ActionInput & { trackId: string }>({
      query: ({ trackId, ...body }) => ({ url: `/tracks/${trackId}/actions`, method: 'POST', body }),
      invalidatesTags: [...DEFINITION_TAGS],
    }),
    updateAction: builder.mutation<Action, Partial<ActionInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/actions/${id}`, method: 'PATCH', body }),
      invalidatesTags: [...DEFINITION_TAGS],
    }),
    deleteAction: builder.mutation<void, string>({
      query: id => ({ url: `/actions/${id}`, method: 'DELETE' }),
      invalidatesTags: [...DEFINITION_TAGS],
    }),

    getAgenda: builder.query<Agenda, { day?: string } | void>({
      query: arg => ({ url: '/actions/agenda', params: cleanParams({ day: arg?.day }) }),
      providesTags: ['Agenda'],
    }),
    completeAction: builder.mutation<CompletionResult, { id: string; method: 'STANDARD' | 'QUICK' }>({
      query: ({ id, method }) => ({ url: `/actions/${id}/complete`, method: 'POST', body: { confirmed: true, method } }),
      invalidatesTags: [...COMPLETION_TAGS],
      onQueryStarted: ({ id }, api) => markToday(api, id, 'DONE'),
    }),
    uncompleteAction: builder.mutation<CompletionResult, string>({
      query: id => ({ url: `/actions/${id}/uncomplete`, method: 'POST', body: {} }),
      invalidatesTags: [...COMPLETION_TAGS],
      onQueryStarted: (id, api) => markToday(api, id, 'TODO'),
    }),
  }),
});

/**
 * Once the server confirms a tick (or untick), shows it in every cached plan
 * table straight away, so the box goes from spinner to tick without waiting
 * for the table to reload.
 */
async function markToday(
  api: { dispatch: (action: unknown) => unknown; getState: () => unknown; queryFulfilled: Promise<unknown> },
  actionId: string,
  cell: GridCell,
) {
  try {
    await api.queryFulfilled;
  } catch {
    return;
  }
  const state = api.getState() as Parameters<typeof routinesApi.util.selectCachedArgsForQuery>[0];
  for (const trackId of routinesApi.util.selectCachedArgsForQuery(state, 'trackGrid')) {
    api.dispatch(
      routinesApi.util.updateQueryData('trackGrid', trackId, grid => {
        const row = grid.rows.find(r => r.action_id === actionId);
        const today = grid.days.indexOf(grid.today);
        if (row && today >= 0) row.cells[today] = cell;
      }),
    );
  }
}

export const {
  useListTracksQuery,
  useGetTrackQuery,
  useTrackDaysQuery,
  useTrackGridQuery,
  useCreateTrackMutation,
  useUpdateTrackMutation,
  useArchiveTrackMutation,
  useDeleteTrackMutation,
  useListTrackActionsQuery,
  useGetActionQuery,
  useCreateActionMutation,
  useUpdateActionMutation,
  useDeleteActionMutation,
  useGetAgendaQuery,
  useCompleteActionMutation,
  useUncompleteActionMutation,
} = routinesApi;
