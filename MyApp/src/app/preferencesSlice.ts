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
  /** A soft click on every tap (Settings, off by default). */
  tapSound: boolean;
  /** Bumped when the alarm sound or length changes, so scheduled alarms are redone. */
  alarmVersion: number;
  /** The welcome story is open (first sign-in, or replayed from Settings). */
  storyOpen: boolean;
  /**
   * The tour was started again from Settings (not a new user's first one).
   * During a new user's first story and tour, Home keeps Melo's corner off
   * (no animation or weather showing through behind the guide); a replay
   * leaves it on.
   */
  tourReplay: boolean;
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
  tapSound: false,
  alarmVersion: 0,
  storyOpen: false,
  tourReplay: false,
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
    tourReplayed(state) {
      state.tourReplay = true;
    },
  },
});

export const { preferencesSynced, preferencesReset, alarmChanged, storyOpened, storyClosed, tourReplayed } = preferencesSlice.actions;
export default preferencesSlice.reducer;
