import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loadSession } from '../../utils/storage';

export type UserRole = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Credentials {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True once we've attempted to rehydrate the session from disk on app boot. */
  isBootstrapped: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isBootstrapped: false,
};

/** Reads a persisted session (if any) from AsyncStorage on app launch. */
export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  return loadSession();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsSet(state, action: PayloadAction<Credentials>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    userUpdated(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
        }
        state.isBootstrapped = true;
      })
      .addCase(restoreSession.rejected, state => {
        state.isBootstrapped = true;
      });
  },
});

export const { credentialsSet, userUpdated, loggedOut } = authSlice.actions;
export default authSlice.reducer;

// --- Selectors -------------------------------------------------------------
// Kept loosely typed on purpose (state: { auth: AuthState }) to avoid a
// circular import with app/store.ts's RootState.
interface AuthRootState {
  auth: AuthState;
}

export const selectCurrentUser = (state: AuthRootState): AuthUser | null => state.auth.user;
export const selectAccessToken = (state: AuthRootState): string | null => state.auth.accessToken;
export const selectRefreshToken = (state: AuthRootState): string | null => state.auth.refreshToken;
export const selectIsAuthenticated = (state: AuthRootState): boolean => Boolean(state.auth.accessToken && state.auth.user);
export const selectIsAdmin = (state: AuthRootState): boolean => state.auth.user?.role === 'ADMIN';
export const selectIsBootstrapped = (state: AuthRootState): boolean => state.auth.isBootstrapped;
