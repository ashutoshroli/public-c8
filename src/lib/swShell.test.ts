// ====== The offline app shell: pages are not precached, one shell answers every navigation ======
//
// WHY THE SERVICE WORKER CHANGED
// ------------------------------
// The service worker used to precache all 13 prerendered pages. Their HTML now carries the accounts
// snapshot (lib/snapshot), which changes every time the committee redeploys to refresh it, so every
// refresh would have made every installed app fetch a new service worker, download every page again
// and reload. The pages are not needed offline: the app shell renders any route from JavaScript that
// is already in the cache, and the data comes from the visitor's own saved copy.
//
// Two things make a refresh invisible to installed apps, and both are pinned here:
//   1. the pages are out of the precache, so the HTML can change freely;
//   2. SvelteKit's app version is the commit, not a timestamp, so a redeploy of the same commit
//      builds byte-identical JavaScript and therefore an identical service worker.
//
// The first block checks the CONFIGURATION. The second runs the REAL generated sw.js and Workbox
// runtime in a Node vm against a Vercel-like origin read from build/ — install, then navigations
// online and offline — so the one mistake that bricks a service worker (a navigation fallback that
// is not a precached URL makes Workbox throw while the worker starts) cannot reach production
// unnoticed. It needs `npm run build` first and is skipped without one, loudly.

import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const text = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

// -------------------------------------------------------------------------- configuration

describe('configuration', () => {
  const kitCfg = text('svelte.config.js');
  const viteCfg = text('vite.config.ts');

  it('the app version is the commit, so a redeploy of the same commit is the same build', () => {
    expect(kitCfg).toMatch(/version: \{ name: appVersion\(\) \}/);
    expect(kitCfg).toMatch(/process\.env\.VERCEL_GIT_COMMIT_SHA/);
    expect(kitCfg).toMatch(/git rev-parse HEAD/);
  });

  it('the static adapter writes a second copy of the fallback as /app-shell', () => {
    expect(kitCfg).toMatch(/adapter: staticAdapterWithShell\(\{/);
    expect(kitCfg).toMatch(/builder\.generateFallback\(path\.join\(options\.pages, 'app-shell\.html'\)\)/);
    expect(kitCfg, '404.html stays: Vercel serves it, with a 404, for unknown URLs').toMatch(/fallback: '404\.html'/);
  });

  it('the worker precaches that shell and answers every navigation with it, by the SAME url', () => {
    expect(viteCfg).toMatch(/adapterFallback: 'app-shell\.html'/);
    expect(viteCfg).toMatch(/fallbackMapping: '\/app-shell'/);
    expect(viteCfg).toMatch(/navigateFallback: '\/app-shell',/);
  });

  it('no prerendered page is precached', () => {
    expect(/globIgnores:\s*\[([\s\S]*?)\]/.exec(viteCfg)![1]).toContain("'**/prerendered/pages/**'");
  });

  it('the shell is kept out of search results', () => {
    const rule = JSON.parse(text('vercel.json')).headers.find((h: { source: string }) => h.source.startsWith('/app-shell'));
    expect(rule?.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex' }]);
  });
});

// ------------------------------------------------------------------------------ the real worker

const BUILD = join(ROOT, 'build');
const built = existsSync(join(BUILD, 'sw.js')) && existsSync(join(BUILD, 'app-shell.html'));

describe.skipIf(!built)('the generated service worker, run for real (needs `npm run build`)', () => {
  const ORIGIN = 'https://portal.test';
  const PAGES = new Set(['', 'committee', 'contributors', 'decade', 'donate', 'downloads', 'expenses', 'guide',
    'loan-rules', 'loans', 'privacy', 'terms', 'verify', 'app-shell']);
  const MIME: Record<string, string> = {
    '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
    '.html': 'text/html; charset=utf-8',
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const make = () => {
    let offline = false;
    const network: string[] = [];
    const urlOf = (r: any) => (typeof r === 'string' ? new URL(r, ORIGIN).href : r instanceof URL ? r.href : new URL(r.url, ORIGIN).href);

    // What Vercel would answer: a file if there is one, a page by its clean URL, else 404.html with a 404.
    const origin = (u: string) => {
      const url = new URL(u);
      if (url.origin !== ORIGIN) throw new TypeError(`Failed to fetch ${url.origin}`);
      const p = decodeURIComponent(url.pathname);
      const file = join(BUILD, p);
      if (p !== '/' && existsSync(file) && statSync(file).isFile()) {
        return new Response(readFileSync(file), { status: 200, headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' } });
      }
      const key = p.replace(/^\/|\/$/g, '');
      if (PAGES.has(key)) return new Response(readFileSync(join(BUILD, `${key || 'index'}.html`)), { status: 200, headers: { 'content-type': MIME['.html'] } });
      return new Response(readFileSync(join(BUILD, '404.html')), { status: 404, headers: { 'content-type': MIME['.html'] } });
    };
    const fakeFetch = async (input: any) => {
      const u = urlOf(input);
      network.push(u);
      if (offline) throw new TypeError('Failed to fetch');
      return origin(u);
    };

    class FakeCache {
      map = new Map<string, { url: string; res: Response }>();
      async put(req: any, res: Response) { this.map.set(urlOf(req), { url: urlOf(req), res: res.clone() }); }
      async match(req: any, opts: any = {}) {
        const url = urlOf(req);
        let hit = this.map.get(url);
        if (!hit && opts.ignoreSearch) hit = [...this.map.values()].find((v) => v.url.split('?')[0] === url.split('?')[0]);
        return hit ? hit.res.clone() : undefined;
      }
      async delete(req: any) { return this.map.delete(urlOf(req)); }
      async keys() { return [...this.map.values()].map((v) => new Request(v.url)); }
    }
    class FakeCaches {
      stores = new Map<string, FakeCache>();
      async open(n: string) { if (!this.stores.has(n)) this.stores.set(n, new FakeCache()); return this.stores.get(n)!; }
      async keys() { return [...this.stores.keys()]; }
      async delete(n: string) { return this.stores.delete(n); }
      async has(n: string) { return this.stores.has(n); }
      async match(req: any, opts: any) { for (const c of this.stores.values()) { const m = await c.match(req, opts); if (m) return m; } return undefined; }
    }
    // A browser resolves a relative URL against the worker's location; Node's Request does not.
    class SwRequest extends Request {
      constructor(input: any, init?: any) { super(typeof input === 'string' ? new URL(input, ORIGIN).href : input, init); }
    }
    class ExtendableEvent {
      type: string;
      constructor(type: string) { this.type = type; }
      waitUntil(_p: unknown) { /* replaced per dispatch */ }
    }
    class FetchEvent extends ExtendableEvent {}

    const listeners: Record<string, Array<(e: any) => void>> = {};
    const sandbox: any = {
      console, URL, URLSearchParams, Response, Headers, Promise, Map, Set, Date, Error, TypeError, JSON, Math,
      Object, Array, String, Number, RegExp, Symbol, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder,
      AbortController, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
      Request: SwRequest, ExtendableEvent, FetchEvent,
      fetch: fakeFetch,
      caches: new FakeCaches(),
      location: new URL(`${ORIGIN}/sw.js`),
      registration: { scope: `${ORIGIN}/`, showNotification: async () => {}, pushManager: {} },
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (type: string, fn: (e: any) => void) => { (listeners[type] ||= []).push(fn); },
      removeEventListener: () => {},
      performance: { now: () => Date.now() },
    };
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    sandbox.importScripts = (...urls: string[]) => {
      for (const u of urls) {
        const rel = new URL(u, `${ORIGIN}/sw.js`).pathname;
        vm.runInContext(readFileSync(join(BUILD, rel), 'utf8'), ctx, { filename: rel });
      }
    };

    const settle = (ms = 30) => new Promise<void>((r) => setTimeout(r, ms));

    async function lifecycle(type: 'install' | 'activate') {
      const waits: Promise<unknown>[] = [];
      const ev = new ExtendableEvent(type);
      ev.waitUntil = (p: unknown) => { waits.push(Promise.resolve(p)); };
      for (const h of listeners[type] ?? []) h(ev);
      const settled = await Promise.allSettled(waits);
      const bad = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
      if (bad.length) throw new Error(`${type} failed: ${bad.map((b) => b.reason?.message ?? b.reason).join('; ')}`);
      await settle();
    }

    const navigate = (pathAndQuery: string) => ({
      url: new URL(pathAndQuery, ORIGIN).href, method: 'GET', mode: 'navigate', destination: 'document',
      headers: new Headers({ accept: 'text/html' }), credentials: 'include', cache: 'default', redirect: 'manual',
      clone() { return this; },
    });
    const subresource = (url: string, destination: string) =>
      Object.defineProperties(new SwRequest(url), { destination: { value: destination }, mode: { value: 'cors' } });

    async function dispatchFetch(request: any): Promise<{ handled: boolean; status?: number; body?: string; error?: string }> {
      let responded: Promise<Response> | undefined;
      const waits: Promise<unknown>[] = [];
      const ev: any = new FetchEvent('fetch');
      Object.assign(ev, {
        request, clientId: '', resultingClientId: '', preloadResponse: Promise.resolve(undefined),
        waitUntil: (p: unknown) => { waits.push(Promise.resolve(p)); },
        respondWith: (p: Promise<Response>) => { responded = Promise.resolve(p); },
      });
      for (const h of listeners.fetch ?? []) { h(ev); if (responded) break; }
      if (!responded) return { handled: false };
      try {
        const response = await responded;
        await Promise.allSettled(waits);
        return { handled: true, status: response.status, body: await response.clone().text() };
      } catch (e) {
        return { handled: true, error: (e as Error).message };
      }
    }

    return {
      network,
      setOffline: (v: boolean) => { offline = v; },
      async boot() {
        vm.runInContext(readFileSync(join(BUILD, 'sw.js'), 'utf8'), ctx, { filename: 'sw.js' });
        await settle(80);
        await lifecycle('install');
        await lifecycle('activate');
      },
      async precacheUrls() {
        const name = (await sandbox.caches.keys()).find((n: string) => /precache/.test(n));
        return ((await (await sandbox.caches.open(name)).keys()) as Request[]).map((r) => new URL(r.url).pathname);
      },
      navigate, subresource, dispatchFetch,
    };
  };

  const shell = built ? readFileSync(join(BUILD, 'app-shell.html'), 'utf8') : '';
  // Booted on first use, not when the file is collected: without a build/ this suite is skipped,
  // and collecting it must not try to read a service worker that is not there.
  let booting: ReturnType<typeof make> extends infer T ? Promise<T> | null : never = null;
  const booted = async () => {
    booting ??= (async () => { const sw = make(); await sw.boot(); return sw; })();
    return booting;
  };

  it('installs: the shell answers 200 at /app-shell, so Workbox can precache it', async () => {
    const sw = await booted();
    const urls = await sw.precacheUrls();
    expect(urls.length).toBeGreaterThan(40);
    expect(urls).toContain('/app-shell');
  });

  it('precaches no page HTML — that is what lets the snapshot change without a service-worker update', async () => {
    const sw = await booted();
    const pages = (await sw.precacheUrls()).filter((u) => !u.startsWith('/_app') && !/\.[a-z0-9]+$/i.test(u) && u !== '/app-shell');
    expect(pages).toEqual([]);
  });

  it('its navigation fallback is a URL it precached (a mismatch bricks the worker at start-up)', () => {
    const sw = readFileSync(join(BUILD, 'sw.js'), 'utf8');
    const fallback = /createHandlerBoundToURL\("([^"]+)"\)/.exec(sw)?.[1];
    const entries = [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map((m) => m[1]);
    expect(fallback).toBe('/app-shell');
    expect(entries).toContain(fallback);
  });

  it('app-shell.html is the same page as 404.html, which Vercel serves for unknown URLs', () => {
    expect(readFileSync(join(BUILD, 'app-shell.html'), 'utf8')).toBe(readFileSync(join(BUILD, '404.html'), 'utf8'));
  });

  it('answers every page navigation with the shell, straight from the cache', async () => {
    const sw = await booted();
    sw.network.length = 0;
    for (const p of ['/', '/expenses', '/loans', '/decade', '/does-not-exist', '/?record=2026/REC.001', '/verify?record=ABC.1']) {
      const r = await sw.dispatchFetch(sw.navigate(p));
      expect(r.handled, p).toBe(true);
      expect(r.body, p).toBe(shell);
    }
    expect(sw.network, 'none of it needed the network').toEqual([]);
  });

  it('does the same with no connection at all', async () => {
    const sw = await booted();
    sw.setOffline(true);
    try {
      for (const p of ['/committee', '/guide', '/contributors', '/typo']) {
        const r = await sw.dispatchFetch(sw.navigate(p));
        expect(r.error, p).toBeUndefined();
        expect(r.body, p).toBe(shell);
      }
    } finally {
      sw.setOffline(false);
    }
  });

  it('does not swallow a navigation to a FILE: robots.txt, llms.txt, sitemap.xml, security.txt reach the network', async () => {
    const sw = await booted();
    for (const f of ['/robots.txt', '/llms.txt', '/llms-full.txt', '/sitemap.xml', '/.well-known/security.txt', '/favicon.ico', '/apple-touch-icon.png']) {
      expect((await sw.dispatchFetch(sw.navigate(f))).handled, f).toBe(false);
    }
  });

  it('still serves precached assets offline, and keeps the API network-only', async () => {
    const sw = await booted();
    const start = (await sw.precacheUrls()).find((u) => /\/_app\/immutable\/entry\/start\./.test(u))!;
    sw.setOffline(true);
    try {
      expect((await sw.dispatchFetch(sw.subresource(start, 'script'))).status).toBe(200);
      expect((await sw.dispatchFetch(sw.subresource('/icons/icon-192.png', 'image'))).status).toBe(200);
      const api = await sw.dispatchFetch(sw.subresource('https://chhath-public-worker.shaharpura.com/?action=portalData', 'empty'));
      expect(api.handled && !!api.error, 'a cached copy must never stand in for live data').toBe(true);
    } finally {
      sw.setOffline(false);
    }
  });
});

describe.runIf(!built)('the real-worker checks', () => {
  it('are skipped because there is no build/ — run `npm run build && npm test` to include them', () => {
    expect(built).toBe(false);
  });
});
