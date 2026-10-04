import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * The unlocked-Vault session. Lives only in memory: it is never persisted,
 * so killing the app always locks the Vault. Cleared on logout, on expiry,
 * after inactivity, and when the app goes to the background.
 */
interface VaultState {
  token: string | null;
  expiresAt: number | null; // epoch ms
}

const initialState: VaultState = { token: null, expiresAt: null };

const vaultSlice = createSlice({
  name: 'vault',
  initialState,
  reducers: {
    vaultUnlocked(state, action: PayloadAction<{ token: string; expiresAt: string }>) {
      state.token = action.payload.token;
      state.expiresAt = new Date(action.payload.expiresAt).getTime();
    },
    vaultLocked() {
      return initialState;
    },
  },
});

export const { vaultUnlocked, vaultLocked } = vaultSlice.actions;
export default vaultSlice.reducer;

interface VaultRootState {
  vault: VaultState;
}
export const selectVaultToken = (s: VaultRootState) => s.vault.token;
export const selectVaultUnlocked = (s: VaultRootState) =>
  Boolean(s.vault.token && s.vault.expiresAt && s.vault.expiresAt > Date.now());
