import { baseApi, type TokenResponse } from '../../api/baseApi';
import { credentialsSet, loggedOut, type AuthUser } from './authSlice';
import { saveSession, clearSession } from '../../utils/storage';

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    register: builder.mutation<TokenResponse, RegisterRequest>({
      query: body => ({ url: '/auth/register', method: 'POST', body }),
      invalidatesTags: ['Me'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            credentialsSet({ user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token }),
          );
          await saveSession({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
          });
        } catch {
          // handled by the caller via the mutation's error state
        }
      },
    }),

    login: builder.mutation<TokenResponse, LoginRequest>({
      query: body => ({ url: '/auth/login', method: 'POST', body }),
      invalidatesTags: ['Me'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            credentialsSet({ user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token }),
          );
          await saveSession({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
          });
        } catch {
          // handled by the caller via the mutation's error state
        }
      },
    }),

    logout: builder.mutation<void, { refresh_token: string }>({
      query: body => ({ url: '/auth/logout', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(loggedOut());
          await clearSession();
        }
      },
    }),

    logoutAll: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout-all', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(loggedOut());
          await clearSession();
        }
      },
    }),

    me: builder.query<AuthUser, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useMeQuery,
} = authApi;
