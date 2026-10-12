import { baseApi, type TokenResponse } from '../../api/baseApi';
import { credentialsSet, loggedOut } from './authSlice';
import { saveSession, clearSession } from '../../utils/storage';
import { deviceTimezone } from '../../utils/date';
import { cancelAllScheduled } from '../../notifications';
import { signOutOfGoogle } from './google';

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

/** Sign-up result: the account signs in once the emailed code is verified. */
export interface VerificationPending {
  verification_required: true;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

async function persist(dispatch: (a: unknown) => unknown, data: TokenResponse) {
  dispatch(credentialsSet({ user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token }));
  await saveSession({ user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token });
}

async function signOutLocally(dispatch: (a: unknown) => unknown) {
  dispatch(loggedOut());
  await clearSession().catch(() => undefined);
  await cancelAllScheduled().catch(() => undefined);
  // So the next Google sign-in offers the account picker again.
  await signOutOfGoogle();
}

export const authApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    // Creates the account and emails a code; nothing signs in until verifyEmail.
    register: builder.mutation<VerificationPending, RegisterRequest>({
      // The device's timezone decides what "today" means for streaks.
      query: body => ({ url: '/auth/register', method: 'POST', body: { ...body, timezone: deviceTimezone() } }),
    }),

    // The emailed 6-digit code proves the address is real, and signs in.
    verifyEmail: builder.mutation<TokenResponse, { email: string; code: string }>({
      query: body => ({ url: '/auth/verify-email', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          await persist(dispatch, data);
        } catch {
          // surfaced by the caller
        }
      },
    }),

    // Sign in (or sign up) with a Google ID token; Google has verified the email.
    googleSignIn: builder.mutation<TokenResponse, { id_token: string }>({
      query: body => ({ url: '/auth/google', method: 'POST', body: { ...body, timezone: deviceTimezone() } }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          await persist(dispatch, data);
        } catch {
          // surfaced by the caller
        }
      },
    }),

    resendCode: builder.mutation<{ message: string }, { email: string }>({
      query: body => ({ url: '/auth/resend-code', method: 'POST', body }),
    }),

    login: builder.mutation<TokenResponse, LoginRequest>({
      query: body => ({ url: '/auth/login', method: 'POST', body: { ...body, timezone: deviceTimezone() } }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          await persist(dispatch, data);
        } catch {
          // surfaced by the caller
        }
      },
    }),

    logout: builder.mutation<void, { refresh_token: string }>({
      query: body => ({ url: '/auth/logout', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          await signOutLocally(dispatch);
        }
      },
    }),

    logoutAll: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout-all', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          await signOutLocally(dispatch);
        }
      },
    }),

    forgotPassword: builder.mutation<{ message: string }, { email: string }>({
      query: body => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),

    resetPassword: builder.mutation<void, { email: string; code: string; new_password: string }>({
      query: body => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),

    changePassword: builder.mutation<void, { current_password: string; new_password: string }>({
      query: body => ({ url: '/auth/change-password', method: 'POST', body }),
    }),
  }),
});

export const {
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendCodeMutation,
  useGoogleSignInMutation,
  useLoginMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
} = authApi;
