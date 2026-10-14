// ====== One festival year on one page (/2025, /hi/2025) ======
//
// The year page has the same hand-over as the "accounts in words" box — what the build wrote, then
// the live figures — plus things only a page of its own can get wrong: showing a year's figures
// under another year's heading, offering a year that has nothing in it, or linking a language the
// visitor is not reading. The real component is mounted against the real stores.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { mount, unmount, flushSync } from 'svelte';
import YearPage from './YearPage.svelte';
import { page } from '$app/stores';
import { portalState, year as selectedYear } from '$lib/stores/portal';
import { lang } from '$lib/stores/lang';
import { parsePortalData, EMPTY_PORTAL_DATA, type PortalData } from '$lib/api/schema';
import { yearPack, yearsWithRecords } from '$lib/snapshot/facts';
import { yearCarrierScript } from '$lib/snapshot/runtime';

vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('https://chhath.shaharpura.com/2025'), params: { year: '2025' }, error: null }) };
});

const NOW = new Date('2026-10-14T06:00:00Z');
const NAMES = ['Ravi Verma', 'रवि वर्मा', '9876500001', 'USER0001'];

function dataWith(bannerAmount = 8670, story = true): PortalData {
  return parsePortalData({
    users: [{ ID: 'USER0001', Name: 'Ravi Verma', 'Name (Hindi)': 'रवि वर्मा', Village: 'Shaharpura', Mobile: '9876500001' }],
    collections: [
      { Name: 'USER0001', Year: 2025, Amount: 500, 'Contribution Type': '1' },
      { Name: 'USER0001', Year: 2024, Amount: 300, 'Contribution Type': '1' },
    ],
    expenses: [
      { Year: 2025, Discription: 'Banner', 'Discription (Hindi)': 'बैनर', Amount: bannerAmount },
      { Year: 2024, Discription: 'Diesel', 'Discription (Hindi)': 'डीजल', Amount: 100 },
    ],
    loans: [{ Year: 2025, Name: 'USER0001', Amount: 1000, 'Intrest Rate': 2, Tenure: 10, Status: 'Active', 'Loan ID': 'L1' }],
    journeyEntries: story
      ? [{ year: 2025, title_en: 'The tent year', title_hi: 'तम्बू का वर्ष', content_en: 'We built a bigger ghat.', content_hi: 'हमने बड़ा घाट बनाया।' }]
      : [],
  })!;
}

/** What the server leaves in <head> for the year page: the pack built from a build-time payload. */
function putCarrier(y: number, data: PortalData, asOf = '2026-10-14') {
  const holder = document.createElement('div');
  holder.innerHTML = yearCarrierScript(y, { asOf, pack: yearPack(data, y, NOW), years: yearsWithRecords(data) });
  document.head.appendChild(holder.firstElementChild!);
}

function ready(data: PortalData, over: Partial<Parameters<typeof portalState.set>[0]> = {}) {
  portalState.set({ status: 'ready', data, stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network', ...over });
}

function at(y: string | number, language: 'en' | 'hi' = 'en') {
  const store = page as unknown as { set(v: unknown): void };
  store.set({ url: new URL(`https://chhath.shaharpura.com${language === 'hi' ? '/hi' : ''}/${y}`), params: { year: String(y) }, error: null });
  lang.set(language);
}

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;
const text = () => host.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const section = (id: string) => host.querySelector(`[data-year-section="${id}"]`);
const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;

function show(y: string | number = 2025, language: 'en' | 'hi' = 'en') {
  at(y, language);
  app = mount(YearPage, { target: host });
  flushSync();
}

const noNavigation = (e: Event) => e.preventDefault();

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
  selectedYear.set(2025);
  document.addEventListener('click', noNavigation, true);
});

afterEach(() => {
  document.removeEventListener('click', noNavigation, true);
  if (app) { unmount(app); app = null; }
  lang.set('en');
});

// ----------------------------------------------------------------------- snapshot, then live

describe('snapshot, then live', () => {
  it('while the data loads, shows the year the server wrote, labelled with its date', () => {
    putCarrier(2025, dataWith());
    show();
    expect(host.querySelector('h1')?.textContent).toBe('Chhath Puja 2025');
    expect(text()).toContain('Navyuvak Chhath Puja Samiti · Shaharpura, Gardih');
    expect(text()).toContain('as of 14 Oct 2026 (IST)');
    expect(text()).toContain('Banner — ₹8,670');
    expect(text()).toContain('Expenses recorded for 2025: 1, totalling ₹8,670.');
    expect(text()).not.toContain('Live figures for');
    expect(document.title || document.head.querySelector('title')?.textContent).toBe('Chhath Puja 2025 — Navyuvak Chhath Puja Samiti');
  });

  it('has the five sections, in order, and the committee’s story of the year first', () => {
    putCarrier(2025, dataWith());
    show();
    const ids = [...host.querySelectorAll('[data-year-section]')].map((e) => e.getAttribute('data-year-section'));
    expect(ids).toEqual(['story', 'overview', 'contributors', 'expenses', 'loans', 'committee']);
    expect(section('story')?.textContent).toContain('The tent year');
    expect(section('story')?.textContent).toContain('We built a bigger ghat.');
    expect([...host.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'The tent year', 'Overview', 'Contributors', 'Expenses', 'Loans', 'Committee', 'The detailed ledgers', 'Other years',
    ]);
  });

  it('says the "no names" note once', () => {
    putCarrier(2025, dataWith());
    show();
    expect((text().match(/People’s names are not repeated/g) || []).length).toBe(1);
  });

  it('when live data arrives, replaces it: the live number wins and the label says live', () => {
    putCarrier(2025, dataWith(8670));
    show();
    ready(dataWith(9999));
    flushSync();
    expect(text()).toContain('Banner — ₹9,999');
    expect(text()).not.toContain('₹8,670');
    expect(text()).toContain('Live figures for 2025');
    expect(text()).not.toContain('as of 14 Oct 2026');
    expect(host.querySelectorAll('h1')).toHaveLength(1);
  });

  it('a saved copy (offline, or the Worker’s last-known-good) is called saved, never live', () => {
    putCarrier(2025, dataWith(8670));
    show();
    ready(dataWith(9100), { source: 'snapshot', stale: true, savedAt: new Date('2026-10-10T08:00:00Z').getTime() });
    flushSync();
    expect(text()).toContain('Saved figures for 2025, last updated 10 Oct 2026');
    expect(text()).not.toContain('Live figures');
  });

  it('if loading fails outright it keeps the snapshot rather than going blank', () => {
    putCarrier(2025, dataWith(8670));
    show();
    portalState.set({ status: 'error', data: EMPTY_PORTAL_DATA, stale: true, savedAt: 0, version: '', failed: true, source: 'empty' });
    flushSync();
    expect(text()).toContain('Banner — ₹8,670');
  });

  it('reads the snapshot once at the start: it survives the carrier leaving the document', () => {
    // Svelte removes the server's <head> nodes while it hydrates, so a later read would find none.
    putCarrier(2025, dataWith(8670));
    show();
    document.getElementById('cpm-snapshot-year-2025')?.remove();
    portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
    flushSync();
    expect(text()).toContain('Banner — ₹8,670');
  });
});

// ------------------------------------------------------------------- without a snapshot

describe('no snapshot (dev, the escape hatch, or arriving by a link inside the app)', () => {
  it('shows a loading state — never an invented zero — and does not ask to be left out', () => {
    show();
    expect(host.querySelector('h1')?.textContent).toBe('Chhath Puja 2025');
    expect(text()).toContain('Loading the figures for 2025…');
    expect(host.querySelector('[data-year-section]')).toBeNull();
    expect(robots(), 'not knowing yet is not the same as having nothing').toBeNull();
  });

  it('shows the year as soon as there is data', () => {
    show();
    ready(dataWith(8670));
    flushSync();
    expect(text()).toContain('Banner — ₹8,670');
    expect(text()).toContain('Live figures for 2025');
    expect(text()).not.toContain('Loading the figures');
  });

  it('ignores a carrier that is damaged or is for another year', () => {
    putCarrier(2024, dataWith());
    const bad = document.createElement('script');
    bad.type = 'application/json';
    bad.id = 'cpm-snapshot-year-2025';
    bad.textContent = '{not json';
    document.head.appendChild(bad);
    show(2025);
    expect(host.querySelector('[data-year-section]')).toBeNull();
    expect(text()).toContain('Loading the figures for 2025…');
  });

  it('ignores a carrier whose pack is for a different year than its id says', () => {
    const holder = document.createElement('div');
    holder.innerHTML = yearCarrierScript(2025, { asOf: '2026-10-14', pack: yearPack(dataWith(), 2024, NOW), years: [2025, 2024] });
    document.head.appendChild(holder.firstElementChild!);
    show(2025);
    expect(host.querySelector('[data-year-section]')).toBeNull();
  });
});

// -------------------------------------------------- one year's figures never under another's name

describe('moving between years', () => {
  it('never shows one year’s figures under another year’s heading', () => {
    putCarrier(2025, dataWith(8670));
    show(2025);
    expect(text()).toContain('Banner — ₹8,670');
    // The visitor follows a link to 2024 before any live data has loaded.
    at(2024);
    flushSync();
    expect(host.querySelector('h1')?.textContent).toBe('Chhath Puja 2024');
    expect(text()).not.toContain('Banner');
    expect(text()).not.toContain('₹8,670');
    expect(text()).toContain('Loading the figures for 2024…');
    // ... and once the live data arrives it is 2024's.
    ready(dataWith());
    flushSync();
    expect(text()).toContain('Diesel — ₹100');
    expect(text()).not.toContain('Banner');
    expect(text()).toContain('Expenses recorded for 2024: 1, totalling ₹100.');
  });

  it('the page title follows the year', () => {
    putCarrier(2025, dataWith());
    show(2025);
    at(2024);
    flushSync();
    expect(document.head.querySelector('title')?.textContent).toBe('Chhath Puja 2024 — Navyuvak Chhath Puja Samiti');
  });
});

// ------------------------------------------------------------------ a year with nothing in it

describe('a year with no records', () => {
  it('says so, offers no empty sections, and asks to be left out of search', () => {
    show(2030);
    ready(dataWith());
    flushSync();
    expect(text()).toContain('No records have been published for 2030 yet.');
    expect(host.querySelector('h1')?.textContent).toBe('Chhath Puja 2030');
    expect(host.querySelector('[data-year-section="overview"]')).toBeNull();
    expect(section('empty')).toBeTruthy();
    expect(robots()).toBe('noindex, follow');
  });

  it('still lets the visitor get to a year that has records', () => {
    show(2030);
    ready(dataWith());
    flushSync();
    const hrefs = [...host.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/2025');
    expect(hrefs).toContain('/2024');
    expect(hrefs).toContain('/decade');
  });

  it('a year that does have records does not ask to be left out', () => {
    show(2025);
    ready(dataWith());
    flushSync();
    expect(robots()).toBeNull();
  });
});

// ---------------------------------------------------------------------------------- links

describe('links', () => {
  it('lists every year with a page, the current one as such and not as a link', () => {
    putCarrier(2025, dataWith());
    show(2025);
    const nav = host.querySelector('nav[aria-labelledby="year-nav-h"]')!;
    expect([...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/2024', '/decade']);
    const current = nav.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('2025');
    expect(current?.tagName, 'the current year is not a link to itself').toBe('SPAN');
  });

  it('opening a ledger from here makes it show this year', () => {
    putCarrier(2024, dataWith());
    show(2024);
    selectedYear.set(2025);
    const expenses = [...host.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/expenses')!;
    expect(expenses.textContent).toBe('Expenses');
    expenses.click();
    expect(get(selectedYear)).toBe(2024);
  });

  it('links the four ledgers', () => {
    putCarrier(2025, dataWith());
    show(2025);
    const section = host.querySelector('section[aria-labelledby="year-details-h"]')!;
    expect([...section.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Contributors', '/contributors'], ['Expenses', '/expenses'], ['Loans', '/loans'], ['Committee', '/committee'],
    ]);
  });
});

// ---------------------------------------------------------------------------------- Hindi

describe('Hindi', () => {
  it('is Hindi all the way down: heading, sections, note, story, and every link on a Hindi address', () => {
    putCarrier(2025, dataWith());
    show(2025, 'hi');
    expect(host.querySelector('h1')?.textContent).toBe('छठ पूजा 2025');
    expect([...host.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'तम्बू का वर्ष', 'सारांश', 'योगदानकर्ता', 'व्यय', 'ऋण', 'समिति', 'विस्तृत बही', 'अन्य वर्ष',
    ]);
    expect(text()).toContain('हमने बड़ा घाट बनाया।');
    expect(text()).toContain('बैनर — ₹8,670');
    expect(text()).toContain('(IST) तक');
    expect(text()).not.toContain('Banner');
    expect(document.head.querySelector('title')?.textContent).toBe('छठ पूजा 2025 — नवयुवक छठ पूजा समिति');
    const hrefs = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/hi/contributors', '/hi/expenses', '/hi/loans', '/hi/committee', '/hi/2024', '/hi/decade']);
  });

  it('live data written in Hindi uses the Hindi labels', () => {
    show(2025, 'hi');
    ready(dataWith(9999));
    flushSync();
    expect(text()).toContain('बैनर — ₹9,999');
    expect(text()).toContain('लाइव आँकड़े');
  });

  it('the no-records message is Hindi too', () => {
    show(2030, 'hi');
    ready(dataWith());
    flushSync();
    expect(text()).toContain('2030 के लिए अभी कोई रिकॉर्ड प्रकाशित नहीं है।');
  });
});

// ---------------------------------------------------------------------------------- names

describe('names', () => {
  it('no snapshot or live page, in either language, contains a person’s name, mobile number or ID', () => {
    const data = dataWith();
    for (const language of ['en', 'hi'] as const) {
      for (const y of [2025, 2024]) {
        document.head.innerHTML = '';
        putCarrier(y, data);
        show(y, language);
        const snap = host.innerHTML + document.head.innerHTML;
        ready(data);
        flushSync();
        const live = host.innerHTML;
        for (const n of NAMES) {
          expect(snap, `${language} ${y} snapshot: ${n}`).not.toContain(n);
          expect(live, `${language} ${y} live: ${n}`).not.toContain(n);
        }
        unmount(app!); app = null;
        portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
      }
    }
  });
});

// --------------------------------------------------------------------------------- the carrier

describe('the JSON the server leaves for the browser', () => {
  it('is an inert JSON block whose id matches the year', () => {
    const html = yearCarrierScript(2025, { asOf: '2026-10-14', pack: yearPack(dataWith(), 2025, NOW), years: [2025, 2024] });
    expect(html.startsWith('<script type="application/json" id="cpm-snapshot-year-2025">')).toBe(true);
    expect(html.endsWith('</script>')).toBe(true);
  });

  it('cannot be closed early by anything inside it — the committee’s story is free text', () => {
    const nasty = dataWith();
    const data = parsePortalData({
      ...nasty,
      journeyEntries: [{ year: 2025, title_en: 'T', title_hi: 'T', content_en: '</script><img src=x onerror=alert(1)>', content_hi: 'x' }],
    })!;
    const html = yearCarrierScript(2025, { asOf: '2026-10-14', pack: yearPack(data, 2025, NOW), years: [2025] });
    expect(html.slice('<script type="application/json" id="cpm-snapshot-year-2025">'.length, -'</script>'.length)).not.toContain('<');
    const holder = document.createElement('div');
    holder.innerHTML = html;
    expect(holder.children).toHaveLength(1);
    expect(JSON.parse(holder.firstElementChild!.textContent!).pack.story.content.en).toBe('</script><img src=x onerror=alert(1)>');
  });
});
