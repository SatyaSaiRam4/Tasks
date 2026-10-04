import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { vaultLocked } from './vaultSlice';

let lastActivity = Date.now();

/** Call on any interaction inside the Vault to reset the inactivity timer. */
export function touchVault() {
  lastActivity = Date.now();
}

/**
 * Locks the Vault when the app leaves the foreground, when the server
 * session expires, and after the user's chosen period of inactivity.
 */
export function VaultAutoLock() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(s => s.vault.token);
  const expiresAt = useAppSelector(s => s.vault.expiresAt);
  const minutes = useAppSelector(s => s.preferences.vaultAutolockMinutes);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && token) dispatch(vaultLocked());
    });
    return () => sub.remove();
  }, [dispatch, token]);

  useEffect(() => {
    if (!token) return;
    touchVault();
    const id = setInterval(() => {
      const now = Date.now();
      const expired = expiresAt !== null && now >= expiresAt;
      const idle = minutes > 0 && now - lastActivity >= minutes * 60_000;
      if (expired || idle) dispatch(vaultLocked());
    }, 5_000);
    return () => clearInterval(id);
  }, [dispatch, token, expiresAt, minutes]);

  return null;
}
