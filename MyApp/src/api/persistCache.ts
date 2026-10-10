/**
 * Keeps a copy of the app's last-loaded data on the device, so every screen
 * opens with content at once (on a cold start or after a theme reload)
 * while fresh data loads quietly in the background.
 *
 * Only the signed-in user's own everyday data is kept; the Vault and admin
 * data never are. The copy is tied to the user id and deleted on logout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { Store } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import { loadSession } from '../utils/storage';

const CACHE_KEY = '@memo/api_cache_v1';
const SAVE_DELAY_MS = 2000;

/** Queries worth keeping. Vault and admin endpoints are deliberately absent. */
const KEPT = new Set([
  'getMe',
  'getMyProfile',
  'getDashboard',
  'getStreak',
  'getTrackCompletions',
  'listAchievements',
  'listTracks',
  'getTrack',
  'trackGrid',
  'listTrackActions',
  'listReminders',
  'getWallet',
]);

interface Entry {
  endpointName: string;
  originalArgs: unknown;
  data: unknown;
}

interface QueryState {
  status?: string;
  endpointName?: string;
  originalArgs?: unknown;
  data?: unknown;
}

type AnyState = { auth: { user: { id: string } | null }; [key: string]: unknown };
type Dispatch = (action: unknown) => unknown;

function entriesOf(state: AnyState): Entry[] {
  const queries = (state[baseApi.reducerPath] as { queries: Record<string, QueryState | undefined> }).queries;
  return Object.values(queries)
    .filter((q): q is Required<QueryState> => Boolean(q && q.status === 'fulfilled' && q.endpointName && KEPT.has(q.endpointName) && q.data !== undefined))
    .map(q => ({ endpointName: q.endpointName, originalArgs: q.originalArgs, data: q.data }));
}

/** Puts the saved copy back into the API cache. Run before the first screen draws. */
export async function hydrateApiCache(dispatch: Dispatch): Promise<Entry[]> {
  try {
    const session = await loadSession();
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!session || !raw) return [];
    const saved = JSON.parse(raw) as { userId: string; entries: Entry[] };
    if (saved.userId !== session.user.id) return [];
    await Promise.all(
      saved.entries.map(e => dispatch(baseApi.util.upsertQueryData(e.endpointName as never, e.originalArgs as never, e.data as never))),
    );
    return saved.entries;
  } catch {
    return [];
  }
}

/** Reloads what was restored from the device, in the background. */
export function refreshHydrated(dispatch: Dispatch, entries: Entry[]) {
  const endpoints = baseApi.endpoints as unknown as Record<string, { initiate: (args: unknown, opts: object) => unknown }>;
  for (const e of entries) {
    endpoints[e.endpointName]?.initiate && dispatch(endpoints[e.endpointName].initiate(e.originalArgs, { subscribe: false, forceRefetch: true }));
  }
}

/** Saves the cache a moment after it changes, and right away when the app goes to the background. */
export function persistApiCache(store: Store) {
  let last: unknown;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    timer = null;
    const state = store.getState() as AnyState;
    const user = state.auth.user;
    if (!user) {
      AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
      return;
    }
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ userId: user.id, entries: entriesOf(state) })).catch(() => undefined);
  };

  store.subscribe(() => {
    const api = (store.getState() as AnyState)[baseApi.reducerPath];
    if (api === last) return;
    last = api;
    if (!timer) timer = setTimeout(save, SAVE_DELAY_MS);
  });
  AppState.addEventListener('change', s => {
    if (s === 'background') save();
  });
}
