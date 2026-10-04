import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '../app/store';
import { API_BASE_URL } from '../config/env';
import { credentialsSet, loggedOut, type AuthUser } from '../modules/auth/authSlice';
import { saveSession, clearSession } from '../utils/storage';

/** Shape returned by /auth/login, /auth/register and /auth/refresh. */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    headers.set('content-type', 'application/json');
    return headers;
  },
});

type RawResult = Awaited<ReturnType<typeof rawBaseQuery>>;

// Endpoints that never need — and must never trigger — a token refresh.
const AUTH_FREE_URLS = ['/auth/login', '/auth/register', '/auth/refresh'];

function requestUrl(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : args.url;
}

// Guards against a "refresh storm": if several requests 401 at once, only the
// first kicks off a refresh; the rest await that same in-flight promise.
let refreshPromise: Promise<RawResult> | null = null;

/**
 * Wraps fetchBaseQuery with automatic refresh-on-401 handling:
 *  - On a 401, calls POST /auth/refresh with the stored refresh token.
 *  - On success, stores the rotated tokens and retries the original request once.
 *  - On failure (or no refresh token available), logs the user out.
 */
export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401 && !AUTH_FREE_URLS.includes(requestUrl(args))) {
    const state = api.getState() as RootState;
    const refreshToken = state.auth.refreshToken;

    if (!refreshToken) {
      api.dispatch(loggedOut());
      clearSession().catch(() => undefined);
      return result;
    }

    if (!refreshPromise) {
      refreshPromise = Promise.resolve(
        rawBaseQuery(
          { url: '/auth/refresh', method: 'POST', body: { refresh_token: refreshToken } },
          api,
          extraOptions,
        ),
      ).finally(() => {
        refreshPromise = null;
      });
    }

    const refreshResult = await refreshPromise;

    if (refreshResult.data) {
      const data = refreshResult.data as TokenResponse;
      api.dispatch(
        credentialsSet({ user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token }),
      );
      await saveSession({
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      }).catch(() => undefined);

      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(loggedOut());
      await clearSession().catch(() => undefined);
    }
  }

  return result;
};

/**
 * The single RTK Query API instance for the whole app. Feature modules call
 * `.injectEndpoints()` on this rather than creating their own `createApi`.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Category',
    'Task',
    'TaskType',
    'Note',
    'Reminder',
    'AdminUser',
    'AdminDashboard',
    'Me',
  ],
  endpoints: () => ({}),
});
