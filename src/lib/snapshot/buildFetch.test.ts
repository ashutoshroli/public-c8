// ====== The build-time fetch: retries, and what happens when it cannot succeed ======
//
// The accounts text in the HTML is read from the API when the site is BUILT. The policy that
// matters is what a build does when it cannot read it: it FAILS, because Vercel then keeps the
// previous deployment (with last time's accounts in it) instead of replacing it with a site whose
// accounts section is empty. Each test below pins one half of that decision, including the two
// deliberate ways around it.

import { describe, it, expect, vi } from 'vitest';
import {
  fetchBuildPayload, problemWith, resolveBuildPayload, snapshotPolicy, SnapshotFetchError,
} from './buildFetch';
import { buildPayloadPlugin } from './vitePlugin';

const API = 'https://api.example.test';
const LEDGER = { collections: [{ Year: 2025, Amount: 100 }], expenses: [], loans: [], users: [] };

type Responder = (url: string, init?: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fetch whose answers come from `routes`, one per call, in order, per action. */
function fakeFetch(handler: Responder) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const noWait = { sleep: async () => {}, backoffMs: [0, 0] };

// ------------------------------------------------------------------------ policy

describe('the policy is read from the environment', () => {
  it('defaults to: take a snapshot, and fail the build if it cannot be taken', () => {
    expect(snapshotPolicy({})).toEqual({ mode: 'on', allowEmpty: false });
  });

  it('CPM_SNAPSHOT=off (or 0 / false / no) skips the snapshot', () => {
    for (const v of ['off', 'OFF', '0', 'false', 'no']) expect(snapshotPolicy({ CPM_SNAPSHOT: v }).mode, v).toBe('off');
    for (const v of ['on', '1', 'true', '', undefined]) expect(snapshotPolicy({ CPM_SNAPSHOT: v }).mode, String(v)).toBe('on');
  });

  it('CPM_SNAPSHOT_ALLOW_EMPTY=1 (or true / yes / on) lets a build go on without one', () => {
    for (const v of ['1', 'true', 'YES', 'on']) expect(snapshotPolicy({ CPM_SNAPSHOT_ALLOW_EMPTY: v }).allowEmpty, v).toBe(true);
    for (const v of ['0', 'false', '', 'maybe', undefined]) expect(snapshotPolicy({ CPM_SNAPSHOT_ALLOW_EMPTY: v }).allowEmpty, String(v)).toBe(false);
  });
});

// ----------------------------------------------------------- what counts as a usable response

describe('a response that parses is not necessarily a ledger', () => {
  it('accepts a payload with contributions, or expenses, or loans', () => {
    expect(problemWith(LEDGER)).toBeNull();
    expect(problemWith({ collections: [], expenses: [{ Year: 2025 }] })).toBeNull();
    expect(problemWith({ collections: [], loans: [{ Year: 2025 }] })).toBeNull();
  });

  it('rejects an empty ledger: 200 with empty arrays is what a half-failed database read looks like', () => {
    expect(problemWith({ collections: [], expenses: [], loans: [], users: [{ ID: 'U1' }] })).toMatch(/empty ledger/);
  });

  it('rejects anything that is not the expected object', () => {
    for (const bad of [null, undefined, 'text', 42, [], {}, { collections: 'nope' }]) {
      expect(problemWith(bad), JSON.stringify(bad)).toBeTruthy();
    }
  });
});

// ------------------------------------------------------------------------ the fetch itself

describe('fetching, like the browser client does', () => {
  it('asks for the data version first and passes it on, so a stale edge copy cannot answer', async () => {
    const { impl, calls } = fakeFetch((url) => (url.includes('dataVersion') ? json({ v: '1234' }) : json(LEDGER)));
    const out = await fetchBuildPayload({ apiBase: API, fetchImpl: impl, now: () => new Date('2026-10-14T06:00:00Z'), ...noWait });
    expect(calls).toEqual([`${API}/?action=dataVersion`, `${API}/?action=portalData&v=1234`]);
    expect(out).toEqual({ fetchedAt: '2026-10-14T06:00:00.000Z', version: '1234', data: LEDGER });
  });

  it('still works when the version call fails — it only exists to dodge a stale cache', async () => {
    const { impl, calls } = fakeFetch((url) => (url.includes('dataVersion') ? json({}, 500) : json(LEDGER)));
    const out = await fetchBuildPayload({ apiBase: `${API}/`, fetchImpl: impl, ...noWait });
    expect(out.version).toBe('');
    expect(calls[1]).toBe(`${API}/?action=portalData`);
  });

  it('retries a failure and uses the attempt that works', async () => {
    let n = 0;
    const log: string[] = [];
    const { impl } = fakeFetch((url) => {
      if (url.includes('dataVersion')) return json({ v: '9' });
      return ++n < 3 ? json({ error: 'boom' }, 503) : json(LEDGER);
    });
    const out = await fetchBuildPayload({ apiBase: API, fetchImpl: impl, log: (m) => log.push(m), ...noWait });
    expect(out.data).toEqual(LEDGER);
    expect(log.filter((m) => /failed/.test(m))).toHaveLength(2);
    expect(log.at(-1)).toMatch(/attempt 3 of 3/);
  });

  it('treats unparseable JSON, a network error and an empty ledger as failures to retry', async () => {
    const answers: Array<() => Response | Promise<Response>> = [
      () => new Response('<html>Cloudflare challenge</html>', { status: 200 }),
      () => { throw new TypeError('fetch failed'); },
      () => json({ collections: [], expenses: [], loans: [] }),
    ];
    let i = 0;
    const { impl } = fakeFetch((url) => (url.includes('dataVersion') ? json({ v: '1' }) : answers[i++]()));
    await expect(fetchBuildPayload({ apiBase: API, fetchImpl: impl, ...noWait })).rejects.toThrow(SnapshotFetchError);
    expect(i).toBe(3);
  });

  it('gives up on a request that never answers, instead of hanging the build', async () => {
    const { impl } = fakeFetch((_url, init) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const started = Date.now();
    await expect(
      fetchBuildPayload({ apiBase: API, fetchImpl: impl, attempts: 2, timeoutMs: 30, ...noWait }),
    ).rejects.toThrow(/timed out after 30 ms/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('waits between attempts, longer each time', async () => {
    const sleep = vi.fn(async () => {});
    const { impl } = fakeFetch(() => json({}, 500));
    await expect(
      fetchBuildPayload({ apiBase: API, fetchImpl: impl, sleep, backoffMs: [1500, 4000] }),
    ).rejects.toThrow();
    expect(sleep.mock.calls.map((c) => (c as unknown as number[])[0])).toEqual([1500, 4000]);
  });

  it('warns, but still uses it, when the Worker says the data is a last-known-good copy', async () => {
    const log: string[] = [];
    const { impl } = fakeFetch((url) => (url.includes('dataVersion') ? json({ v: '1' }) : json({ ...LEDGER, stale: true })));
    const out = await fetchBuildPayload({ apiBase: API, fetchImpl: impl, log: (m) => log.push(m), ...noWait });
    expect(out.data).toMatchObject({ stale: true });
    expect(log.join('\n')).toMatch(/last-known-good/);
  });

  it('after the last attempt the error names the cause, the consequence and both ways out', async () => {
    const { impl } = fakeFetch(() => json({}, 502));
    const err = (await fetchBuildPayload({ apiBase: API, fetchImpl: impl, ...noWait }).catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(SnapshotFetchError);
    expect(err.message).toContain('after 3 attempts');
    expect(err.message).toContain('HTTP 502');
    expect(err.message).toMatch(/previous deployment/);
    expect(err.message).toContain('CPM_SNAPSHOT_ALLOW_EMPTY=1');
    expect(err.message).toContain('CPM_SNAPSHOT=off');
  });
});

// ------------------------------------------------------------ the decision: fail, skip, or go on

describe('what the build does when it cannot read the accounts', () => {
  const down = () => fakeFetch(() => json({}, 503));

  it('FAILS by default — the previous good deployment keeps serving', async () => {
    const { impl } = down();
    await expect(resolveBuildPayload({}, { apiBase: API, fetchImpl: impl, ...noWait })).rejects.toThrow(SnapshotFetchError);
  });

  it('CPM_SNAPSHOT=off builds without one and never touches the network', async () => {
    const { impl, calls } = down();
    const log: string[] = [];
    const out = await resolveBuildPayload({ CPM_SNAPSHOT: 'off' }, { apiBase: API, fetchImpl: impl, log: (m) => log.push(m), ...noWait });
    expect(out).toBeNull();
    expect(calls).toEqual([]);
    expect(log.join('\n')).toMatch(/CPM_SNAPSHOT=off/);
  });

  it('CPM_SNAPSHOT_ALLOW_EMPTY=1 builds without one, and says so loudly', async () => {
    const { impl } = down();
    const log: string[] = [];
    const out = await resolveBuildPayload({ CPM_SNAPSHOT_ALLOW_EMPTY: '1' }, { apiBase: API, fetchImpl: impl, log: (m) => log.push(m), ...noWait });
    expect(out).toBeNull();
    expect(log.join('\n')).toMatch(/continues WITHOUT a snapshot/);
  });

  it('a healthy API gives a payload whichever flags are set', async () => {
    const { impl } = fakeFetch((url) => (url.includes('dataVersion') ? json({ v: '1' }) : json(LEDGER)));
    const out = await resolveBuildPayload({ CPM_SNAPSHOT_ALLOW_EMPTY: '1' }, { apiBase: API, fetchImpl: impl, ...noWait });
    expect(out?.data).toEqual(LEDGER);
  });
});

// ------------------------------------------------------------------------- the Vite plugin

describe('the virtual module: data for the server bundle, nothing for anyone else', () => {
  const ID = 'virtual:cpm-build-payload';
  const RESOLVED = '\0virtual:cpm-build-payload';
  const EMPTY = 'export default null;';

  type LoadFn = (id: string, options?: { ssr?: boolean }) => Promise<string | null>;
  function plugin(env: Record<string, string | undefined>, command: 'build' | 'serve' = 'build') {
    const p = buildPayloadPlugin(env, { apiBase: API, sleep: async () => {}, backoffMs: [0, 0] });
    (p.configResolved as unknown as (c: { command: string }) => void)({ command });
    const load = (p.load as unknown as LoadFn).bind({});
    const resolveId = (p.resolveId as unknown as (id: string) => string | null).bind({});
    return { p, load, resolveId };
  }

  function stubApi() {
    const impl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('dataVersion') ? json({ v: '7' }) : json(LEDGER));
    vi.stubGlobal('fetch', impl);
    return impl;
  }

  it('resolves only its own id', () => {
    const { resolveId } = plugin({});
    expect(resolveId(ID)).toBe(RESOLVED);
    expect(resolveId('./other')).toBeNull();
  });

  it('gives the SERVER build the fetched data, as an ES module', async () => {
    const api = stubApi();
    const { load } = plugin({});
    const code = (await load(RESOLVED, { ssr: true }))!;
    expect(code.startsWith('export default {')).toBe(true);
    const payload = JSON.parse(code.slice('export default '.length, -1));
    expect(payload.version).toBe('7');
    expect(payload.data).toEqual(LEDGER);
    expect(api.mock.calls[0][0]).toBe(`${API}/?action=dataVersion`);
    vi.unstubAllGlobals();
  });

  it('gives the CLIENT build nothing, ever — the accounts are not shipped to browsers as JavaScript', async () => {
    const api = stubApi();
    const { load } = plugin({});
    expect(await load(RESOLVED, { ssr: false })).toBe(EMPTY);
    expect(await load(RESOLVED, {})).toBe(EMPTY);
    expect(await load(RESOLVED)).toBe(EMPTY);
    expect(api).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('gives dev and test runs nothing and touches no network', async () => {
    const api = stubApi();
    expect(await plugin({}, 'serve').load(RESOLVED, { ssr: true })).toBe(EMPTY);
    expect(await plugin({ VITEST: 'true' }).load(RESOLVED, { ssr: true })).toBe(EMPTY);
    expect(api).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('fetches once per build, however many times the module is loaded', async () => {
    const api = stubApi();
    const { load } = plugin({});
    await load(RESOLVED, { ssr: true });
    await load(RESOLVED, { ssr: true });
    await load(RESOLVED, { ssr: true });
    // one dataVersion + one portalData
    expect(api).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('lets the load FAIL when the API is down, which fails the build', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 503)));
    const { load } = plugin({});
    await expect(load(RESOLVED, { ssr: true })).rejects.toThrow(/Could not fetch the accounts/);
    vi.unstubAllGlobals();
  });

  it('…unless the committee chose to build without one', async () => {
    const api = stubApi();
    expect(await plugin({ CPM_SNAPSHOT: 'off' }).load(RESOLVED, { ssr: true })).toBe(EMPTY);
    expect(api).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('reads the API the live page reads, and ignores a PUBLIC_API_BASE the client build would ignore', async () => {
    // Vite exposes only VITE_* to import.meta.env, so config.ts always resolves the default; if this
    // plugin honoured the variable, the snapshot and the live page could describe two different ledgers.
    const impl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('dataVersion') ? json({ v: '7' }) : json(LEDGER));
    vi.stubGlobal('fetch', impl);
    const p = buildPayloadPlugin({ PUBLIC_API_BASE: 'https://elsewhere.example' }, { sleep: async () => {}, backoffMs: [0, 0] });
    (p.configResolved as unknown as (c: { command: string }) => void)({ command: 'build' });
    await (p.load as unknown as LoadFn).call({}, RESOLVED, { ssr: true });
    const { DEFAULTS } = await import('../config');
    expect(String(impl.mock.calls[0][0])).toBe(`${DEFAULTS.PUBLIC_API_BASE}/?action=dataVersion`);
    expect(impl.mock.calls.every((c) => !String(c[0]).includes('elsewhere'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('is registered first in the Vite config, with a comment saying why a failed fetch stops the build', async () => {
    const { readFileSync } = await import('node:fs');
    const cfg = readFileSync('vite.config.ts', 'utf8');
    expect(cfg).toMatch(/plugins: \[\s*buildPayloadPlugin\(\),\s*sveltekit\(\)/);
    expect(cfg).toMatch(/failed fetch fails the build on purpose/);
  });
});
