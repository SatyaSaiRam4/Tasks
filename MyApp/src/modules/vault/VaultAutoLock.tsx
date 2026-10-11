import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { vaultLocked } from './vaultSlice';
import { useRefreshVaultSessionMutation } from './vaultApi';

let lastActivity = Date.now();
/** Memo's own pickers (gallery, camera, mic permission) are open: leaving the app for them doesn't lock. */
let awayFor = 0;

/** Call on any interaction inside the Vault (a tap, typing) to reset the inactivity timer. */
export function touchVault() {
  lastActivity = Date.now();
}

/**
 * Runs `task` (which opens the gallery, the camera or a permission dialog,
 * all of which briefly leave the app) without locking the Vault for it.
 */
export async function keepVaultOpenWhile<T>(task: () => Promise<T>): Promise<T> {
  awayFor += 1;
  touchVault();
  try {
    return await task();
  } finally {
    // The app reports "active" again a moment after the picker closes.
    setTimeout(() => {
      awayFor = Math.max(0, awayFor - 1);
    }, 1500);
    touchVault();
  }
}

/** Renew the server session when it has less than this left and the Vault is in use. */
const RENEW_BEFORE_MS = 2 * 60_000;
/** "In use" means touched within this long. */
const IN_USE_MS = 60_000;

/**
 * Locks the Vault when the app goes to the background (not for Memo's own
 * pickers) and after the user's chosen time without any activity. While the
 * Vault is being used, its server session is renewed, so it never locks in
 * the middle of using it.
 */
export function VaultAutoLock() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(s => s.vault.token);
  const expiresAt = useAppSelector(s => s.vault.expiresAt);
  const minutes = useAppSelector(s => s.preferences.vaultAutolockMinutes);
  const [refresh] = useRefreshVaultSessionMutation();
  const renewing = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && token && awayFor === 0) dispatch(vaultLocked());
    });
    return () => sub.remove();
  }, [dispatch, token]);

  useEffect(() => {
    if (!token) return;
    touchVault();
    const id = setInterval(() => {
      const now = Date.now();
      const idle = minutes > 0 && now - lastActivity >= minutes * 60_000 && awayFor === 0;
      if (idle || (expiresAt !== null && now >= expiresAt)) {
        dispatch(vaultLocked());
        return;
      }
      const inUse = now - lastActivity < IN_USE_MS || awayFor > 0;
      if (inUse && expiresAt !== null && expiresAt - now < RENEW_BEFORE_MS && !renewing.current) {
        renewing.current = true;
        refresh()
          .unwrap()
          .catch(() => undefined)
          .finally(() => {
            renewing.current = false;
          });
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [dispatch, token, expiresAt, minutes, refresh]);

  return null;
}
