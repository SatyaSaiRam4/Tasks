import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';
import type { Agenda } from '../routines/routinesApi';
import type { Reminder } from '../reminders/remindersApi';

export interface TodaySummary {
  date: string;
  required: number;
  completed: number;
  optional_due: number;
  optional_completed: number;
  secured: boolean;
  /** Plans with something due today, and how many of them are finished (+1 streak each). */
  plans_due: number;
  plans_done: number;
  remaining: number;
  progress: number;
}

export interface StreakSummary {
  current_streak: number;
  best_streak: number;
  total_success_days: number;
  total_failed_days: number;
  bonus_points: number;
  consistency_score: number;
  consistency_pct: number;
  tracking_started_on: string;
  at_risk: boolean;
  today: TodaySummary;
}

export interface HistoryDay {
  date: string;
  status: string;
  required: number;
  completed: number;
}

export interface TrackCompletion {
  id: string;
  track_id: string | null;
  track_name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  required_total: number;
  completed_total: number;
  is_perfect: boolean;
  bonus_points: number;
  evaluated_at: string;
}

export interface Achievement {
  code: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_at: string | null;
}

export interface Dashboard {
  display_name: string;
  local_hour: number;
  satya_enabled: boolean;
  animations_enabled: boolean;
  reduced_motion: boolean;
  streak: StreakSummary;
  agenda: Agenda;
  active_tracks: number;
  total_tracks: number;
  upcoming_reminders: Reminder[];
  reminder_count: number;
}

export const streaksApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getDashboard: builder.query<Dashboard, void>({
      query: () => '/dashboard/summary',
      providesTags: ['Dashboard', 'Streak', 'Agenda'],
    }),
    getStreak: builder.query<StreakSummary, void>({
      query: () => '/streaks/me',
      providesTags: ['Streak'],
    }),
    getHistory: builder.query<HistoryDay[], { from?: string; to?: string } | void>({
      query: arg => ({ url: '/streaks/history', params: cleanParams({ from: arg?.from, to: arg?.to }) }),
      providesTags: ['Streak'],
    }),
    getTrackCompletions: builder.query<TrackCompletion[], void>({
      query: () => '/streaks/track-completions',
      providesTags: ['Streak'],
    }),
    listAchievements: builder.query<Achievement[], void>({
      query: () => '/achievements',
      providesTags: ['Achievement'],
    }),
  }),
});

export const {
  useGetDashboardQuery,
  useGetStreakQuery,
  useGetHistoryQuery,
  useGetTrackCompletionsQuery,
  useListAchievementsQuery,
} = streaksApi;
