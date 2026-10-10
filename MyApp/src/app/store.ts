import { combineReducers, configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer, { loggedOut } from '../modules/auth/authSlice';
import vaultReducer from '../modules/vault/vaultSlice';
import preferencesReducer from './preferencesSlice';
import { baseApi } from '../api/baseApi';
import { persistApiCache } from '../api/persistCache';

const appReducer = combineReducers({
  auth: authReducer,
  vault: vaultReducer,
  preferences: preferencesReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

/** On logout, every slice (including the API cache and Vault session) resets. */
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: UnknownAction) => {
  if (loggedOut.match(action)) {
    return appReducer({ auth: { ...state!.auth, user: null, accessToken: null, refreshToken: null } } as never, action);
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(baseApi.middleware),
});

// Enables refetchOnFocus/refetchOnReconnect behavior for RTK Query.
setupListeners(store.dispatch);
// Keeps a copy of the last-loaded data on the device for instant screens.
persistApiCache(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
