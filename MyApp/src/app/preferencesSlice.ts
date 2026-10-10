import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * A synchronous mirror of the user's server-side settings that affect how
 * the UI behaves (motion, Melo, completion confirmation), so any component
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
  /** Bumped when the alarm sound or length changes, so scheduled alarms are redone. */
  alarmVersion: number;
  /** The welcome story is open (first sign-in, or replayed from Settings). */
  storyOpen: boolean;
}

const initialState: PreferencesState = {
  animationsEnabled: true,
  reducedMotion: false,
  satyaEnabled: true,
  confirmationMode: 'QUICK',
  vaultAutolockMinutes: 5,
  notifyActions: true,
  notifyReminders: true,
  notifyStreakWarnings: true,
  alarmVersion: 0,
  storyOpen: false,
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
    alarmChanged(state) {
      state.alarmVersion += 1;
    },
    storyOpened(state) {
      state.storyOpen = true;
    },
    storyClosed(state) {
      state.storyOpen = false;
    },
  },
});

export const { preferencesSynced, preferencesReset, alarmChanged, storyOpened, storyClosed } = preferencesSlice.actions;
export default preferencesSlice.reducer;
