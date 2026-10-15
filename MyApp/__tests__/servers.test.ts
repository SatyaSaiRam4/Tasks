/**
 * Two backends run the same code: the app uses whichever is up and moves on
 * when one is suspended, unreachable or too slow, without ever doing a change
 * twice.
 */
import { store } from '../src/app/store';
import { baseApi } from '../src/api/baseApi';
import { API_ORIGINS } from '../src/config/env';
import { apiBaseUrl, chooseServer, currentServer, resetServersForTests } from '../src/api/servers';

const [FIRST, SECOND] = API_ORIGINS;
const SUSPENDED = '<!DOCTYPE html><html><body>This service has been suspended.</body></html>';

const api = baseApi.injectEndpoints({
  endpoints: builder => ({
    ping: builder.query<{ ok: boolean }, void>({ query: () => '/ping' }),
    save: builder.mutation<{ ok: boolean }, void>({ query: () => ({ url: '/save', method: 'POST', body: {} }) }),
  }),
});

type Behaviour = 'up' | 'suspended' | 'unreachable' | 'slow' | 'notfound';
let behaviour: Record<string, Behaviour>;
let hits: { origin: string; method: string; path: string }[];

beforeEach(() => {
  hits = [];
  behaviour = { [FIRST]: 'up', [SECOND]: 'up' };
  resetServersForTests();
  store.dispatch(baseApi.util.resetApiState());
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;
    hits.push({ origin, method: request.method, path: url.pathname });
    const how = behaviour[origin];
    if (how === 'unreachable') throw new TypeError('Network request failed');
    if (how === 'slow') {
      return new Promise((_, reject) => request.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))));
    }
    if (how === 'suspended') return new Response(SUSPENDED, { status: 503, headers: { 'Content-Type': 'text/html' } });
    if (how === 'notfound') return new Response(JSON.stringify({ error: { code: 'HTTPEXCEPTION', message: 'Reminder not found.' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const body = url.pathname.endsWith('/health/live') ? { status: 'ok' } : { ok: true };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});

afterEach(() => jest.restoreAllMocks());

it('lists both production servers', () => {
  expect(API_ORIGINS).toEqual(['https://tasks-singapore.onrender.com', 'https://tasks-wvlv.onrender.com']);
  expect(apiBaseUrl(1)).toBe('https://tasks-wvlv.onrender.com/api/v1');
});

it('moves to the other server when one is suspended, and stays there', async () => {
  behaviour[FIRST] = 'suspended';
  const res = await store.dispatch(api.endpoints.ping.initiate());
  expect(res.data).toEqual({ ok: true });
  expect(hits.map(h => h.origin)).toEqual([FIRST, SECOND]);
  expect(currentServer()).toBe(1);
  await store.dispatch(api.endpoints.ping.initiate(undefined, { forceRefetch: true }));
  expect(hits.map(h => h.origin)).toEqual([FIRST, SECOND, SECOND]);
});

it('moves on when a server can’t be reached', async () => {
  behaviour[FIRST] = 'unreachable';
  const res = await store.dispatch(api.endpoints.ping.initiate());
  expect(res.data).toEqual({ ok: true });
  expect(currentServer()).toBe(1);
});

it('resends a change only when the first server refused it before running it', async () => {
  behaviour[FIRST] = 'suspended';
  const res = await store.dispatch(api.endpoints.save.initiate());
  expect('data' in res && res.data).toEqual({ ok: true });
  expect(hits.filter(h => h.method === 'POST').map(h => h.origin)).toEqual([FIRST, SECOND]);
});

it('never resends a change after a timeout (it may have run), but uses the other server next', async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  behaviour[FIRST] = 'slow';
  const pending = store.dispatch(api.endpoints.save.initiate());
  await jest.advanceTimersByTimeAsync(16000);
  const res = await pending;
  jest.useRealTimers();
  // A timeout (TIMEOUT_ERROR on a phone; the test's abort reads as FETCH_ERROR): either way, not resent.
  expect(['TIMEOUT_ERROR', 'FETCH_ERROR']).toContain('error' in res && (res.error as { status: string }).status);
  expect(hits.filter(h => h.method === 'POST').map(h => h.origin)).toEqual([FIRST]);
  expect(currentServer()).toBe(1);
});

it('doesn’t switch servers for an ordinary error from the API', async () => {
  behaviour[FIRST] = 'notfound';
  const res = await store.dispatch(api.endpoints.ping.initiate());
  expect(res.error).toMatchObject({ status: 404 });
  expect(hits.map(h => h.origin)).toEqual([FIRST]);
  expect(currentServer()).toBe(0);
});

it('picks a server that answers at launch', async () => {
  behaviour[FIRST] = 'suspended';
  await chooseServer(2000);
  expect(currentServer()).toBe(1);
});
