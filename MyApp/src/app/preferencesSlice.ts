import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * A synchronous mirror of the user's server-side settings that affect how
 * the UI behaves (motion, Satya, completion confirmation), so any component
 * can read them without subscribing to a query.
 */
export interface PreferencesState {
  animationsEnabled: boolean;
  reducedMotion: boolean;
  satyaEnabled: boolean;
  confirmationMode: 'STANDARD' | 'QUICK';
  vaultAutolockMinutes: number;
  notifyActions: boolean;
  notifyReminders: boolean;
  notifyStreakWarnings: boolean;
}

const initialState: PreferencesState = {
  animationsEnabled: true,
  reducedMotion: false,
  satyaEnabled: true,
  confirmationMode: 'STANDARD',
  vaultAutolockMinutes: 5,
  notifyActions: true,
  notifyReminders: true,
  notifyStreakWarnings: true,
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    preferencesSynced(state, action: PayloadAction<Partial<PreferencesState>>) {
      Object.assign(state, action.payload);
    },
    preferencesReset() {
      return initialState;
    },
  },
});

export const { preferencesSynced, preferencesReset } = preferencesSlice.actions;
export default preferencesSlice.reducer;
