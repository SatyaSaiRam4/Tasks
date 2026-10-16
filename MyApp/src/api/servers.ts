import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { API_ORIGINS, API_PREFIX } from '../config/env';

/**
 * Which backend the app talks to. Memo runs the same backend on more than one
 * Render service (same code, same database), and any one of them can be
 * asleep, suspended or down at a given moment. The app keeps one "current"
 * server, moves to the next one when the current one fails, and remembers the
 * last one that worked (across restarts). At launch it asks all of them at
 * once and settles on whichever answers first.
 */
const STORAGE_KEY = '@memo/api_server';
let current = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

/** e.g. "https://tasks-wvlv.onrender.com/api/v1". */
export function apiBaseUrl(index = current): string {
  return `${API_ORIGINS[index].replace(/\/+$/, '')}${API_PREFIX}`;
}

export function currentServer(): number {
  return current;
}

export function serverCount(): number {
  return API_ORIGINS.length;
}

/** Makes `index` the current server (and remembers it). */
export function selectServer(index: number) {
  if (index === current || index < 0 || index >= API_ORIGINS.length) return;
  current = index;
  AsyncStorage.setItem(STORAGE_KEY, API_ORIGINS[index]).catch(() => undefined);
  notify();
}

/** The current one failed: move to the next server. Returns the new index. */
export function failOver(from = current): number {
  if (API_ORIGINS.length < 2) return current;
  const next = (from + 1) % API_ORIGINS.length;
  if (from === current) selectServer(next);
  return current;
}

/** A public page on the server in use, e.g. publicPage('/privacy'). */
export function publicPage(path: string): string {
  return `${API_ORIGINS[current].replace(/\/+$/, '')}${path}`;
}

/** For screens that put the API URL in an image or audio source. */
export function useApiBaseUrl(): string {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => apiBaseUrl(),
  );
}

async function healthy(index: number, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_ORIGINS[index].replace(/\/+$/, '')}/health/live`, { signal: controller.signal });
    const body = res.ok ? await res.json() : null;
    if (body?.status !== 'ok') throw new Error('not ok');
    return index;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * At launch: start from the server that worked last time, then ask every
 * server at once and use the first that answers. Never throws; with no
 * answer at all, the current server stays (requests will fail over anyway).
 */
export async function chooseServer(timeoutMs = 12000): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    const index = saved ? API_ORIGINS.indexOf(saved) : -1;
    if (index >= 0 && index !== current) {
      current = index;
      notify();
    }
  } catch {
    // no saved choice
  }
  if (API_ORIGINS.length < 2) return;
  // The first server to answer wins (Promise.any, written out for older JS engines).
  const first = await new Promise<number | null>(resolve => {
    let failed = 0;
    API_ORIGINS.forEach((_, i) =>
      healthy(i, timeoutMs).then(resolve, () => {
        failed += 1;
        if (failed === API_ORIGINS.length) resolve(null);
      }),
    );
  });
  if (first !== null) selectServer(first);
}

/** Tests only: start again from the first server. */
export function resetServersForTests() {
  current = 0;
  notify();
}

/**
 * fetch() for the few places outside RTK Query (Vault photos): reads `path`
 * (e.g. "/vault/entries/…") from the current server, moving to the next one
 * if it's down (can't be reached, 502/503/504, or a web page instead of the API).
 * For reading only (GET).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < API_ORIGINS.length; attempt++) {
    const server = current;
    try {
      const res = await fetch(`${apiBaseUrl(server)}${path}`, init);
      const html = (res.headers.get('content-type') ?? '').includes('text/html');
      if (res.status !== 502 && res.status !== 503 && res.status !== 504 && !(html && !res.ok)) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    failOver(server);
  }
  throw lastError ?? new Error('No server answered.');
}
