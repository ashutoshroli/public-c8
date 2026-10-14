// ====== The inline script in app.html: the language is the address ======
//
// This script is plain JavaScript inside an HTML template, so nothing type-checks it and nothing
// imports it; what it does is only visible in a browser. It runs before first paint on every page
// and can send a visitor to another URL, so it is exercised here for real: the script text is
// pulled out of app.html and run in a sandbox against a fake `location` and `localStorage`, for the
// same addresses lib/lang/url.ts is tested with. The two must agree, or a visitor is sent somewhere
// the rest of the site does not expect.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { isFilePath, langOfPath, localePath } from './url';
import { LANG_KEY } from '../i18n';

const HTML = readFileSync(join(process.cwd(), 'src/app.html'), 'utf8');

/** The text of every inline <script> in app.html's head, with HTML comments out of the way. */
const SCRIPTS = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const LANG_SCRIPT = SCRIPTS.find((s) => s.includes('__cpmRedirecting = true'))!;
const GTM_SCRIPT = SCRIPTS.find((s) => s.includes('GTM-'))!;

interface Run {
  replaced: string[];
  htmlLang: string | null;
  redirecting: boolean;
  window: Record<string, unknown>;
}

/** Runs a script as a browser would, at `url`, with `stored` as the saved language ('throw' = storage is blocked). */
function run(script: string, url: string, stored: string | null | 'throw', extra: Record<string, unknown> = {}): Run {
  const u = new URL(url, 'https://chhath.test');
  const replaced: string[] = [];
  let htmlLang: string | null = null;
  const win: Record<string, unknown> = {};
  const storage = {
    getItem(k: string) {
      if (stored === 'throw') throw new Error('storage blocked');
      if (k === LANG_KEY) return stored;
      return extra[`ls:${k}`] ?? null;
    },
  };
  const ctx = {
    location: {
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      replace: (to: string) => replaced.push(to),
    },
    localStorage: storage,
    document: {
      documentElement: { setAttribute: (k: string, v: string) => { if (k === 'lang') htmlLang = v; } },
      getElementsByTagName: () => [{ parentNode: { insertBefore: (el: unknown) => { win.__injected = el; } } }],
      createElement: () => ({}),
    },
    window: win,
    Date,
  };
  // `window.x = …` in the script writes to `win`; bare `w[l]` access goes through the argument.
  Object.assign(win, ctx, extra);
  win.window = win;
  vm.runInNewContext(script, { ...ctx, window: win });
  return { replaced, htmlLang, redirecting: win.__cpmRedirecting === true, window: win };
}

describe('the script is there, once', () => {
  it('finds the language script and the GTM snippet in app.html', () => {
    expect(LANG_SCRIPT, 'no inline language script').toBeTruthy();
    expect(GTM_SCRIPT, 'no GTM snippet').toBeTruthy();
    expect(SCRIPTS.filter((s) => s.includes('cpm_public_lang')).length, 'exactly one reads the stored language').toBe(1);
  });

  it('comes before the analytics snippet, so the redirect flag exists when GTM decides', () => {
    expect(HTML.indexOf('__cpmRedirecting = true')).toBeGreaterThan(-1);
    expect(HTML.indexOf('__cpmRedirecting = true')).toBeLessThan(HTML.indexOf('GTM-N6BF7NP7'));
  });

  it('reads the same storage key the language store writes', () => {
    expect(LANG_SCRIPT).toContain(`'${LANG_KEY}'`);
  });
});

describe('a Hindi address', () => {
  it('is labelled Hindi and never redirected, whatever is stored', () => {
    for (const stored of [null, 'hi', 'en'] as const) {
      for (const path of ['/hi', '/hi/', '/hi/expenses', '/hi/2025', '/hi/verify?record=A1']) {
        const r = run(LANG_SCRIPT, path, stored);
        expect(r.htmlLang, `${path} (${stored})`).toBe('hi');
        expect(r.replaced, `${path} (${stored})`).toEqual([]);
        expect(r.redirecting).toBe(false);
      }
    }
  });
});

describe('an English page address', () => {
  const PAGES = ['/', '/expenses', '/loans', '/2025', '/decade', '/verify?record=ABC.1', '/privacy#cookies', '/?record=X'];

  it('is left alone for a visitor with no saved language, or who chose English', () => {
    for (const stored of [null, 'en', 'garbage'] as const) {
      for (const path of PAGES) {
        const r = run(LANG_SCRIPT, path, stored);
        expect(r.replaced, `${path} (${stored})`).toEqual([]);
        expect(r.htmlLang).toBeNull();
        expect(r.redirecting).toBe(false);
      }
    }
  });

  it('takes a visitor who chose Hindi to the Hindi twin, keeping the query and the hash', () => {
    const expected: Record<string, string> = {
      '/': '/hi',
      '/expenses': '/hi/expenses',
      '/loans': '/hi/loans',
      '/2025': '/hi/2025',
      '/decade': '/hi/decade',
      '/verify?record=ABC.1': '/hi/verify?record=ABC.1',
      '/privacy#cookies': '/hi/privacy#cookies',
      '/?record=X': '/hi?record=X',
    };
    for (const path of PAGES) {
      const r = run(LANG_SCRIPT, path, 'hi');
      expect(r.replaced, path).toEqual([expected[path]]);
      expect(r.redirecting, `${path} must raise the flag for analytics`).toBe(true);
    }
  });

  it('goes where lib/lang/url.ts says the Hindi twin is — the two cannot drift apart', () => {
    for (const path of [...PAGES, '/guide', '/loan-rules', '/hi-fi', '/history', '/hindi']) {
      const r = run(LANG_SCRIPT, path, 'hi');
      expect(r.replaced, path).toEqual([localePath(path, 'hi')]);
    }
  });

  it('does not mistake an English page whose name starts with "hi" for a Hindi address', () => {
    for (const path of ['/history', '/hindi', '/hi-fi', '/his']) {
      expect(langOfPath(path)).toBe('en');
      expect(run(LANG_SCRIPT, path, 'hi').replaced, path).toEqual([`/hi${path}`]);
    }
  });

  it('survives storage being blocked (private mode, a strict browser): no error, no redirect', () => {
    for (const path of PAGES) {
      const r = run(LANG_SCRIPT, path, 'throw');
      expect(r.replaced).toEqual([]);
      expect(r.redirecting).toBe(false);
    }
  });
});

describe('a file is never redirected', () => {
  const FILES = [
    '/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/.well-known/security.txt',
    '/favicon.ico', '/apple-touch-icon.png', '/manifest.webmanifest', '/og-image.png', '/sw.js',
    '/icons/icon-192.png', '/_app/immutable/entry/start.abc123.js', '/app-shell.html', '/404.html',
  ];

  it('there is one robots.txt, one sitemap and one security.txt, whatever language is saved', () => {
    for (const path of FILES) {
      expect(isFilePath(path), path).toBe(true);
      const r = run(LANG_SCRIPT, path, 'hi');
      expect(r.replaced, path).toEqual([]);
      expect(r.redirecting).toBe(false);
    }
  });

  it('a file under /hi (the Hindi llms-full.txt) is Hindi and stays where it is', () => {
    const r = run(LANG_SCRIPT, '/hi/llms-full.txt', 'hi');
    expect(r.replaced).toEqual([]);
    expect(r.htmlLang).toBe('hi');
  });
});

describe('the analytics snippet does not count a page that is being left', () => {
  const CONSENT = { 'ls:cpm_analytics_consent': 'granted' };

  it('loads GTM for a visitor who accepted analytics', () => {
    const r = run(GTM_SCRIPT, '/expenses', null, CONSENT);
    expect(r.window.__cpmGtmLoaded).toBe(true);
    expect(Array.isArray(r.window.dataLayer)).toBe(true);
  });

  it('does nothing while a redirect is under way', () => {
    const r = run(GTM_SCRIPT, '/expenses', null, { ...CONSENT, __cpmRedirecting: true });
    expect(r.window.__cpmGtmLoaded).toBeUndefined();
    expect(r.window.dataLayer).toBeUndefined();
  });

  it('still waits for consent', () => {
    const r = run(GTM_SCRIPT, '/expenses', null, {});
    expect(r.window.__cpmGtmLoaded).toBeUndefined();
  });
});
