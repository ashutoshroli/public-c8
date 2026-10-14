// ====== "The accounts in words" in the browser: snapshot first, live once it loads ======
//
// The section has one job that is easy to get wrong in a way nobody notices: show ONE set of
// figures at a time, and never show the build-time snapshot as if it were live. These tests mount
// the real component against the real stores and check each hand-over — snapshot while the data
// loads, live when it arrives, "saved" when what arrived is an old copy — plus that the HTML it
// hydrates is the HTML the server wrote, and that nobody's name ever appears in it.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import AccountsText from './AccountsText.svelte';
import { portalState, year } from '$lib/stores/portal';
import { lang } from '$lib/stores/lang';
import { parsePortalData, EMPTY_PORTAL_DATA, type PortalData } from '$lib/api/schema';
import { factsForPage, type PageKey } from '$lib/snapshot/facts';
import { carrierScript } from '$lib/snapshot/runtime';

const NOW = new Date('2026-10-14T06:00:00Z');

function dataWith(bannerAmount: number): PortalData {
  return parsePortalData({
    users: [{ ID: 'USER0001', Name: 'Ravi Verma', 'Name (Hindi)': 'रवि वर्मा', Village: 'Shaharpura', Mobile: '9876500001' }],
    collections: [{ Name: 'USER0001', Year: 2025, Amount: 500, 'Contribution Type': '1' }],
    expenses: [
      { Year: 2025, Discription: 'Banner', 'Discription (Hindi)': 'बैनर', Amount: bannerAmount },
      { Year: 2025, Discription: 'Diesel', 'Discription (Hindi)': 'डीजल', Amount: 100 },
    ],
    loans: [{ Year: 2025, Name: 'USER0001', Amount: 1000, 'Intrest Rate': 2, Tenure: 10, Status: 'Active', 'Loan ID': 'L1' }],
  })!;
}

/** What the server leaves in <head> for the page: the facts built from a build-time payload. */
function putCarrier(page: PageKey, data: PortalData, asOf = '2026-10-14') {
  const holder = document.createElement('div');
  holder.innerHTML = carrierScript(page, { asOf, facts: factsForPage(page, data, 2025, NOW) });
  document.head.appendChild(holder.firstElementChild!);
}

function ready(data: PortalData, over: Partial<Parameters<typeof portalState.set>[0]> = {}) {
  portalState.set({ status: 'ready', data, stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network', ...over });
}

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;

const text = () => host.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const section = () => host.querySelector('section[data-accounts-text]');

function show(page: PageKey) {
  app = mount(AccountsText, { target: host, props: { page } });
  flushSync();
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
  year.set(2025);
  lang.set('en');
});

afterEach(() => {
  if (app) { unmount(app); app = null; }
  lang.set('en');
});

// ------------------------------------------------------------------------------ the hand-over

describe('snapshot, then live', () => {
  it('while the data loads, shows what the server wrote, labelled with its date', () => {
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    expect(section()).toBeTruthy();
    expect(text()).toContain('The accounts in words');
    expect(text()).toContain('as of 14 Oct 2026 (IST)');
    expect(text()).toContain('Banner — ₹8,670');
    expect(text()).toContain('Expenses recorded for 2025: 2, totalling ₹8,770.');
    expect(text()).not.toContain('Live figures for');
  });

  it('when live data arrives, replaces it — the live number wins and the label says live', () => {
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    expect(text()).toContain('Banner — ₹8,670');

    ready(dataWith(9999)); // the ledger moved on after the build
    flushSync();
    expect(text()).toContain('Banner — ₹9,999');
    expect(text()).not.toContain('₹8,670');
    expect(text()).toContain('Live figures for 2025');
    expect(text()).not.toContain('as of 14 Oct 2026');
  });

  it('never shows both: one section, one set of totals', () => {
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    ready(dataWith(9999));
    flushSync();
    expect(host.querySelectorAll('section[data-accounts-text]')).toHaveLength(1);
    expect((text().match(/totalling/g) || []).length).toBe(1);
  });

  it('follows the year the visitor picks', () => {
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    ready(dataWith(9999));
    year.set(2024);
    flushSync();
    expect(text()).toContain('No expenses have been recorded for 2024 yet.');
    expect(text()).toContain('Live figures for 2024');
  });

  it('a saved copy (offline, or the Worker’s last-known-good) is called saved, never live', () => {
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    ready(dataWith(9100), { source: 'snapshot', stale: true, savedAt: new Date('2026-10-10T08:00:00Z').getTime() });
    flushSync();
    expect(text()).toContain('Saved figures for 2025, last updated 10 Oct 2026');
    expect(text()).not.toContain('Live figures');
    expect(text()).toContain('Banner — ₹9,100');
  });

  it('a Worker-flagged stale payload is saved too, even though it arrived over the network', () => {
    show('expenses');
    ready(dataWith(9100), { source: 'network', stale: true });
    flushSync();
    expect(text()).toContain('Saved figures');
  });

  it('if loading fails outright it keeps the snapshot rather than going blank', () => {
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    portalState.set({ status: 'error', data: EMPTY_PORTAL_DATA, stale: true, savedAt: 0, version: '', failed: true, source: 'empty' });
    flushSync();
    expect(text()).toContain('Banner — ₹8,670');
    expect(text()).toContain('as of 14 Oct 2026');
  });

  it('read the snapshot once at the start: it survives the carrier leaving the document', () => {
    // Svelte removes the server's <head> nodes while it hydrates, so a later read would find none.
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    document.getElementById('cpm-snapshot-expenses')?.remove();
    portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
    flushSync();
    expect(text()).toContain('Banner — ₹8,670');
  });
});

// ------------------------------------------------------------------------- without a snapshot

describe('no snapshot (dev, the escape hatch, or arriving by client-side navigation)', () => {
  it('shows nothing while loading — never an invented zero', () => {
    show('expenses');
    expect(section()).toBeNull();
    expect(text()).toBe('');
  });

  it('shows the live text as soon as there is data', () => {
    show('expenses');
    ready(dataWith(8670));
    flushSync();
    expect(text()).toContain('Banner — ₹8,670');
    expect(text()).toContain('Live figures for 2025');
  });

  it('ignores a carrier that is for another page, or is damaged', () => {
    putCarrier('loans', dataWith(1));
    const bad = document.createElement('script');
    bad.type = 'application/json';
    bad.id = 'cpm-snapshot-expenses';
    bad.textContent = '{not json';
    document.head.appendChild(bad);
    show('expenses');
    expect(section()).toBeNull();
  });
});

// ----------------------------------------------------------------------------------- language

describe('language', () => {
  it('follows the visitor’s language, snapshot and live alike', () => {
    putCarrier('committee', parsePortalData({
      users: [{ ID: 'U1', Name: 'Ravi Verma' }],
      collections: [{ Name: 'U1', Year: 2025, Amount: 1 }],
      committee: [{ ID: 'U1', Name: 'U1', Year: 2025, 'View Role': 'President', 'View Role (Hindi)': 'अध्यक्ष' }],
    })!);
    show('committee');
    expect(text()).toContain('President: 1');
    lang.set('hi');
    flushSync();
    expect(text()).toContain('हिसाब शब्दों में');
    expect(text()).toContain('अध्यक्ष: 1');
    expect(text()).toContain('(IST) तक');
    expect(text()).not.toContain('President');
  });
});

// -------------------------------------------------------------------------- the year pages

describe('links to the pages of each year', () => {
  const yearLinks = () => [...host.querySelectorAll('nav a')].map((a) => [a.textContent, a.getAttribute('href')]);

  it('the Home text offers a page for each year with records, newest first', () => {
    const data = dataWith(8670);
    putCarrier('home', data);
    show('home');
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Chhath Puja, year by year');
    expect(yearLinks()).toEqual([['2025', '/2025']]);
  });

  it('in Hindi they are the Hindi pages', () => {
    putCarrier('home', dataWith(8670));
    show('home');
    lang.set('hi');
    flushSync();
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('छठ पूजा, वर्ष-दर-वर्ष');
    expect(yearLinks()).toEqual([['2025', '/hi/2025']]);
  });

  it('the live text links the years of the live data, so a new year appears without a rebuild', () => {
    putCarrier('home', dataWith(8670));
    show('home');
    ready(parsePortalData({
      users: [{ ID: 'U1', Name: 'A B' }],
      collections: [{ Name: 'U1', Year: 2025, Amount: 1 }, { Name: 'U1', Year: 2026, Amount: 2 }],
    })!);
    flushSync();
    expect(yearLinks()).toEqual([['2026', '/2026'], ['2025', '/2025']]);
  });

  it('the Decade text links the years that have contributions, and the other pages link none', () => {
    putCarrier('decade', dataWith(8670));
    show('decade');
    expect(yearLinks()).toEqual([['2025', '/2025']]);
    unmount(app!); app = null;
    document.head.innerHTML = '';
    putCarrier('expenses', dataWith(8670));
    show('expenses');
    expect(host.querySelector('nav')).toBeNull();
  });
});

// ----------------------------------------------------------------------------------- privacy

describe('names', () => {
  const NAMES = ['Ravi Verma', 'रवि वर्मा', '9876500001', 'USER0001'];

  it('no page’s text, snapshot or live, contains a person’s name, mobile number or ID', () => {
    const data = dataWith(8670);
    for (const page of ['home', 'expenses', 'loans', 'committee', 'contributors', 'decade'] as PageKey[]) {
      document.head.innerHTML = '';
      putCarrier(page, data);
      show(page);
      const snap = host.innerHTML;
      ready(data);
      flushSync();
      const live = host.innerHTML;
      for (const n of NAMES) {
        expect(snap, `${page} snapshot: ${n}`).not.toContain(n);
        expect(live, `${page} live: ${n}`).not.toContain(n);
      }
      unmount(app!); app = null;
      portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
    }
  });
});

// ------------------------------------------------------------------------------- the carrier

describe('the JSON the server leaves for the browser', () => {
  it('is an inert JSON block whose id matches the page', () => {
    const html = carrierScript('expenses', { asOf: '2026-10-14', facts: factsForPage('expenses', dataWith(1), 2025, NOW) });
    expect(html.startsWith('<script type="application/json" id="cpm-snapshot-expenses">')).toBe(true);
    expect(html.endsWith('</script>')).toBe(true);
  });

  it('cannot be closed early by anything inside it', () => {
    const facts = factsForPage('expenses', parsePortalData({
      expenses: [{ Year: 2025, Discription: '</script><img src=x onerror=alert(1)>', Amount: 5 }],
      collections: [{ Name: 'a', Year: 2025, Amount: 1 }],
    })!, 2025, NOW);
    const html = carrierScript('expenses', { asOf: '2026-10-14', facts });
    // The opening and closing tags are the only '<' left in it.
    expect(html.slice('<script type="application/json" id="cpm-snapshot-expenses">'.length, -'</script>'.length)).not.toContain('<');
    const holder = document.createElement('div');
    holder.innerHTML = html;
    expect(holder.children).toHaveLength(1);
    expect(JSON.parse(holder.firstElementChild!.textContent!).facts.kind).toBe('expenses');
  });
});
