import { baseApi } from '../../api/baseApi';
import { preferencesSynced } from '../../app/preferencesSlice';
import { userUpdated, type AuthUser } from '../auth/authSlice';

export interface UserSettings {
  accent_color: string | null;
  animations_enabled: boolean;
  reduced_motion: boolean;
  satya_enabled: boolean;
  confirmation_mode: 'STANDARD' | 'QUICK';
  vault_autolock_minutes: number;
  notify_actions: boolean;
  notify_reminders: boolean;
  notify_streak_warnings: boolean;
  notify_achievements: boolean;
  is_public_profile: boolean;
  show_current_streak: boolean;
  show_best_streak: boolean;
  show_achievements: boolean;
  /** Others who find you can see your profile photo. */
  show_photo: boolean;
}

export interface Me {
  id: string;
  email: string;
  display_name: string;
  public_id: string;
  avatar: string | null;
  /** API path of the profile photo (with a version), or null. */
  photo_url: string | null;
  timezone: string;
  role: 'USER' | 'ADMIN';
  created_at: string;
  onboarding_completed: boolean;
  settings: UserSettings;
}

export interface AchievementBadge {
  code: string;
  title: string;
  icon: string;
  earned_at: string | null;
}

export interface ProfileStats {
  current_streak: number;
  best_streak: number;
  consistency_pct: number;
  consistency_score: number;
  total_success_days: number;
  completed_tracks: number;
  perfect_tracks: number;
  total_completed_actions: number;
  tracking_started_on: string;
}

export interface MyProfile {
  me: Me;
  stats: ProfileStats;
  achievements: AchievementBadge[];
}

export interface PublicProfile {
  display_name: string;
  public_id: string;
  avatar: string | null;
  photo_url: string | null;
  member_since: string;
  current_streak: number | null;
  best_streak: number | null;
  consistency_pct: number;
  completed_tracks: number;
  achievements: AchievementBadge[] | null;
}

export type SettingsUpdate = Partial<UserSettings> & { clear_accent_color?: boolean };

function toPreferences(s: UserSettings) {
  return {
    animationsEnabled: s.animations_enabled,
    reducedMotion: s.reduced_motion,
    satyaEnabled: s.satya_enabled,
    confirmationMode: s.confirmation_mode,
    vaultAutolockMinutes: s.vault_autolock_minutes,
    notifyActions: s.notify_actions,
    notifyReminders: s.notify_reminders,
    notifyStreakWarnings: s.notify_streak_warnings,
  };
}

function syncUser(dispatch: (a: unknown) => unknown, getState: () => unknown, me: Me) {
  dispatch(preferencesSynced(toPreferences(me.settings)));
  const current = (getState() as { auth: { user: AuthUser | null } }).auth.user;
  if (current) {
    dispatch(
      userUpdated({
        ...current,
        display_name: me.display_name,
        public_id: me.public_id,
        avatar: me.avatar,
        timezone: me.timezone,
        onboarding_completed: me.onboarding_completed,
        role: me.role,
      }),
    );
  }
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getMe: builder.query<Me, void>({
      query: () => '/users/me',
      providesTags: ['Me', 'Settings'],
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          syncUser(dispatch, getState, data);
        } catch {
          // ignore
        }
      },
    }),

    updateMe: builder.mutation<Me, { display_name?: string; avatar?: string | null; timezone?: string }>({
      query: body => ({ url: '/users/me', method: 'PATCH', body }),
      invalidatesTags: ['Me', 'Profile', 'Dashboard'],
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          syncUser(dispatch, getState, data);
        } catch {
          // surfaced by the caller
        }
      },
    }),

    uploadPhoto: builder.mutation<Me, { uri: string; type: string; name: string }>({
      query: ({ uri, type, name }) => {
        const form = new FormData();
        form.append('file', { uri, name, type } as unknown as Blob);
        return { url: '/users/me/photo', method: 'PUT', body: form };
      },
      invalidatesTags: ['Me', 'Profile'],
    }),

    deletePhoto: builder.mutation<Me, void>({
      query: () => ({ url: '/users/me/photo', method: 'DELETE' }),
      invalidatesTags: ['Me', 'Profile'],
    }),

    getMyProfile: builder.query<MyProfile, void>({
      query: () => '/users/me/profile',
      providesTags: ['Profile'],
    }),

    updateSettings: builder.mutation<UserSettings, SettingsUpdate>({
      query: body => ({ url: '/users/me/settings', method: 'PATCH', body }),
      invalidatesTags: ['Settings', 'Dashboard'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        // Optimistic: preferences apply instantly, roll back on failure.
        const patch = dispatch(
          usersApi.util.updateQueryData('getMe', undefined, draft => {
            Object.assign(draft.settings, arg);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(preferencesSynced(toPreferences(data)));
        } catch {
          patch.undo();
        }
      },
    }),

    completeOnboarding: builder.mutation<Me, void>({
      query: () => ({ url: '/users/me/onboarding/complete', method: 'POST' }),
      invalidatesTags: ['Me'],
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          syncUser(dispatch, getState, data);
        } catch {
          // ignore
        }
      },
    }),

    resetOnboarding: builder.mutation<Me, void>({
      query: () => ({ url: '/users/me/onboarding/reset', method: 'POST' }),
      invalidatesTags: ['Me'],
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          syncUser(dispatch, getState, data);
        } catch {
          // ignore
        }
      },
    }),

    searchUser: builder.query<PublicProfile, string>({
      query: publicId => ({ url: '/users/search', params: { public_id: publicId } }),
    }),
  }),
});

export const {
  useGetMeQuery,
  useUpdateMeMutation,
  useUploadPhotoMutation,
  useDeletePhotoMutation,
  useGetMyProfileQuery,
  useUpdateSettingsMutation,
  useCompleteOnboardingMutation,
  useResetOnboardingMutation,
  useLazySearchUserQuery,
} = usersApi;
