// ====== What a search engine reads from <head>, page by page and language by language ======
//
// Seo.svelte is mounted for real, at real addresses, and the tags it writes into <head> are read
// back. This is the part of the Hindi pages that is invisible to a visitor and decides everything
// for a crawler: which URL a page says it IS (canonical), which URL is its twin (hreflang), what
// language its text is in, and whether it asks to be left out.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Seo from './Seo.svelte';
import { page } from '$app/stores';

vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('https://chhath.shaharpura.com/'), params: {}, error: null }) };
});

const SITE = 'https://chhath.shaharpura.com';
let app: ReturnType<typeof mount> | null = null;

function visit(path: string, error: unknown = null) {
  const pageStore = page as unknown as { set(v: unknown): void };
  pageStore.set({ url: new URL(path, SITE), params: {}, error });
  flushSync();
}

const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute('content') ?? null;
const link = (sel: string) => document.head.querySelector(sel)?.getAttribute('href') ?? null;
const alternates = () =>
  [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]);
const graph = () => JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.textContent!)['@graph'] as Record<string, unknown>[];

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  app = mount(Seo, { target: document.body });
});
afterEach(() => {
  if (app) { unmount(app); app = null; }
});

describe('an English page names itself, and its Hindi twin', () => {
  it('canonicals to itself, never to the home page', () => {
    visit('/expenses');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/expenses`);
    expect(meta('meta[property="og:url"]')).toBe(`${SITE}/expenses`);
  });

  it('says it is English, and offers Hindi as the alternate', () => {
    visit('/expenses');
    expect(meta('meta[property="og:locale"]')).toBe('en_IN');
    expect(meta('meta[property="og:locale:alternate"]')).toBe('hi_IN');
  });

  it('lists itself, its twin and x-default (English) as hreflang alternates', () => {
    visit('/expenses');
    expect(alternates()).toEqual([
      ['en', `${SITE}/expenses`], ['hi', `${SITE}/hi/expenses`], ['x-default', `${SITE}/expenses`],
    ]);
  });

  it('the home page is / and /hi', () => {
    visit('/');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/`);
    expect(alternates()).toEqual([['en', `${SITE}/`], ['hi', `${SITE}/hi`], ['x-default', `${SITE}/`]]);
  });

  it('describes itself in English', () => {
    visit('/loans');
    expect(meta('meta[name="description"]')).toMatch(/^Loans issued from the committee fund/);
    expect(meta('meta[property="og:description"]')).toBe(meta('meta[name="description"]'));
    expect(meta('meta[property="og:title"]')).toBe('Surplus Loan Distribution — Chhath Puja');
  });
});

describe('a Hindi page canonicals to ITSELF, not to the English page', () => {
  it('(a canonical to the English page would ask Google to drop the Hindi one)', () => {
    visit('/hi/expenses');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/hi/expenses`);
    expect(meta('meta[property="og:url"]')).toBe(`${SITE}/hi/expenses`);
  });

  it('carries the SAME three alternates as its English twin — hreflang must be reciprocal', () => {
    visit('/expenses');
    const en = alternates();
    visit('/hi/expenses');
    expect(alternates()).toEqual(en);
    expect(alternates()).toHaveLength(3);
  });

  it('the Hindi home page is /hi and the set is the same', () => {
    visit('/hi');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/hi`);
    expect(alternates()).toEqual([['en', `${SITE}/`], ['hi', `${SITE}/hi`], ['x-default', `${SITE}/`]]);
  });

  it('is described, titled and localed in Hindi', () => {
    visit('/hi/expenses');
    expect(meta('meta[name="description"]')).toMatch(/[\u0900-\u097F]/);
    expect(meta('meta[name="description"]')).toMatch(/^नवयुवक छठ पूजा समिति का हर खर्च/);
    expect(meta('meta[property="og:title"]')).toBe('व्यय बही — छठ पूजा');
    expect(meta('meta[name="twitter:title"]')).toBe('व्यय बही — छठ पूजा');
    expect(meta('meta[property="og:locale"]')).toBe('hi_IN');
    expect(meta('meta[property="og:locale:alternate"]')).toBe('en_IN');
  });

  it('the Hindi home page shares with the full Hindi title', () => {
    visit('/hi');
    expect(meta('meta[property="og:title"]')).toBe('छठ पूजा पारदर्शिता पोर्टल — नवयुवक छठ पूजा समिति');
  });

  it('its structured data is Hindi, at Hindi addresses, with the organisation unchanged', () => {
    visit('/hi/expenses');
    const nodes = graph();
    const web = nodes.find((n) => n['@type'] === 'WebPage')!;
    expect(web.url).toBe(`${SITE}/hi/expenses`);
    expect(web.inLanguage).toBe('hi');
    expect(web.name).toBe('व्यय बही — छठ पूजा');
    const crumbs = (nodes.find((n) => n['@type'] === 'BreadcrumbList') as { itemListElement: { name: string; item: string }[] }).itemListElement;
    expect(crumbs.map((c) => [c.name, c.item])).toEqual([['होम', `${SITE}/hi`], ['व्यय बही', `${SITE}/hi/expenses`]]);
    expect((nodes.find((n) => n['@type'] === 'NGO') as { name: string }).name).toBe('Navyuvak Chhath Puja Samiti');
  });
});

describe('a year page, in both languages', () => {
  it('has its own title, description, canonical and alternates', () => {
    visit('/2025');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/2025`);
    expect(alternates()).toEqual([['en', `${SITE}/2025`], ['hi', `${SITE}/hi/2025`], ['x-default', `${SITE}/2025`]]);
    expect(meta('meta[property="og:title"]')).toBe('Chhath Puja 2025 — Navyuvak Chhath Puja Samiti');
    expect(meta('meta[name="description"]')).toMatch(/^Chhath Puja 2025 at Shaharpura/);
    expect(document.head.querySelector('meta[name="robots"]'), 'a year page asks to be found').toBeNull();
  });

  it('the Hindi one canonicals to itself', () => {
    visit('/hi/2025');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/hi/2025`);
    expect(meta('meta[property="og:title"]')).toBe('छठ पूजा 2025 — नवयुवक छठ पूजा समिति');
    expect(meta('meta[name="description"]')).toMatch(/^शहरपुरा में छठ पूजा 2025/);
    expect(alternates()).toEqual([['en', `${SITE}/2025`], ['hi', `${SITE}/hi/2025`], ['x-default', `${SITE}/2025`]]);
  });

  it('is a page of the site in structured data, with the year in its breadcrumb', () => {
    visit('/hi/2025');
    const nodes = graph();
    expect((nodes.find((n) => n['@type'] === 'WebPage') as { url: string }).url).toBe(`${SITE}/hi/2025`);
    const crumbs = (nodes.find((n) => n['@type'] === 'BreadcrumbList') as { itemListElement: { name: string }[] }).itemListElement;
    expect(crumbs[1].name).toBe('छठ पूजा 2025');
  });

  it('a trailing slash is the same page, not a competing canonical', () => {
    visit('/2025/');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/2025`);
    visit('/hi/');
    expect(link('link[rel="canonical"]')).toBe(`${SITE}/hi`);
  });
});

describe('what asks to be left out', () => {
  it('the receipt-verification page is noindex in both languages and offers no alternates', () => {
    for (const path of ['/verify', '/hi/verify']) {
      visit(path);
      expect(meta('meta[name="robots"]'), path).toBe('noindex, follow');
      expect(alternates(), `${path}: a page that asks to be left out has no twin to advertise`).toEqual([]);
    }
  });

  it('an unknown address, in either language, is noindex with no description or alternates', () => {
    for (const path of ['/not-a-page', '/hi/not-a-page']) {
      visit(path);
      expect(meta('meta[name="robots"]'), path).toBe('noindex, follow');
      expect(document.head.querySelector('meta[name="description"]'), path).toBeNull();
      expect(alternates(), path).toEqual([]);
    }
  });

  it('an error page states its own stricter robots tag, so this one stays out of its way', () => {
    visit('/hi/not-a-page', { message: 'Not Found' });
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('every ordinary page, in both languages, asks to be found', () => {
    for (const path of ['/', '/contributors', '/expenses', '/loans', '/committee', '/decade', '/downloads', '/donate', '/guide', '/loan-rules', '/privacy', '/terms']) {
      for (const prefix of ['', '/hi']) {
        const full = `${prefix}${path}`.replace(/^\/hi\/$/, '/hi') || '/';
        visit(full);
        expect(document.head.querySelector('meta[name="robots"]'), full).toBeNull();
        expect(alternates(), full).toHaveLength(3);
        expect(meta('meta[name="description"]'), full).toBeTruthy();
      }
    }
  });
});

describe('the tags do not pile up as the visitor moves from page to page', () => {
  it('one canonical, one description and one set of alternates after several navigations', () => {
    for (const path of ['/', '/hi/expenses', '/2025', '/hi/2025', '/loans']) visit(path);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(3);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  });
});
