// ====== The decade page: which years say "not final yet" ======
//
// The note used to follow the calendar — it was on the current year and on no other. The committee
// now marks a year final by LOCKING it in the management portal, and the public Worker publishes
// the locked years, so the page follows that instead:
//
//   * a locked year has no note and no • marker, whatever year it is — the current year too;
//   * every other year has both. The current year keeps its own sentence (its Chhath really is not
//     over); an earlier year gets one that says what is actually missing — the committee locking
//     its records — and never claims that a festival long past "is not yet complete";
//   * a payload that does not say which years are locked ("not told") is NOT "nothing is locked":
//     the page does what it did before — the current year only;
//   * until the live data arrives the page is drawn from nothing, but which years are final comes
//     from the facts the build wrote (the same ones as the "accounts in words"), so a visitor does
//     not watch the notes appear or disappear and the HTML a crawler reads is right. Once the data
//     is here, it is the data's.
//
// The real page is mounted against the real stores and read the way a visitor reads it.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Decade from '../../routes/decade/+page.svelte';
import { portalState, year } from '$lib/stores/portal';
import { lang } from '$lib/stores/lang';
import { parsePortalData, EMPTY_PORTAL_DATA, type PortalData } from '$lib/api/schema';
import { factsForPage } from '$lib/snapshot/facts';
import { carrierScript } from '$lib/snapshot/runtime';

const NOW = new Date('2026-10-14T06:00:00Z');
const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const base = {
  users: [{ ID: 'U1', Name: 'Ravi Verma', 'Name (Hindi)': 'रवि वर्मा' }],
  collections: [
    { Name: 'U1', Year: 2017, Amount: 100, 'Contribution Type': '1' },
    { Name: 'U1', Year: 2018, Amount: 200, 'Contribution Type': '1' },
    { Name: 'U1', Year: 2025, Amount: 500, 'Contribution Type': '1' },
  ],
};
const dataWith = (extra: Record<string, unknown> = {}): PortalData => parsePortalData({ ...base, ...extra })!;

function ready(data: PortalData, over: Partial<Parameters<typeof portalState.set>[0]> = {}) {
  portalState.set({ status: 'ready', data, stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network', ...over });
}

/** What the server leaves in <head> for the decade page: the facts built from a build-time payload. */
function putCarrier(data: PortalData) {
  const holder = document.createElement('div');
  holder.innerHTML = carrierScript('decade', { asOf: '2026-10-14', facts: factsForPage('decade', data, 2025, NOW) });
  document.head.appendChild(holder.firstElementChild!);
}

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;

const OPEN = /have not been locked|lock नहीं किए/; // the sentence for an earlier year that is not final
const CURRENT = /is not yet complete|अभी पूरा नहीं हुआ/; // the sentence for the current year
const HEADING = /financial records are not final yet|financial records अभी final नहीं हैं/;

interface Card { year: number; dot: boolean; note: 'none' | 'current' | 'open'; heading: boolean }
/** The ten year cards of "Year by year" — the first list on the page. */
const cards = (): Card[] =>
  [...host.querySelector('section ol')!.querySelectorAll(':scope > li')].map((li) => {
    const label = li.querySelector('span.text-xs.font-bold')!.textContent!.replace(/\s+/g, ' ').trim();
    const text = li.textContent!.replace(/\s+/g, ' ');
    const note = CURRENT.test(text) ? 'current' : OPEN.test(text) ? 'open' : 'none';
    return { year: Number(label.slice(0, 4)), dot: label.includes('•'), note, heading: HEADING.test(text) };
  });
/** The rows of the figures table. */
const rows = () =>
  [...host.querySelectorAll('[role="table"] [role="row"]')].slice(1).map((r) => {
    const cell = r.querySelector('[role="cell"]')!.textContent!.replace(/\s+/g, ' ').trim();
    return { year: Number(cell.slice(0, 4)), dot: cell.includes('•') };
  });
const notFinal = () => cards().filter((c) => c.note !== 'none').map((c) => c.year);

function show(language: 'en' | 'hi' = 'en') {
  lang.set(language);
  app = mount(Decade, { target: host });
  flushSync();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
  year.set(2025);
});
afterEach(() => {
  if (app) { unmount(app); app = null; }
  lang.set('en');
  vi.useRealTimers();
});

// -------------------------------------------------------------------------------- with the lock

describe('the live data says which years are locked', () => {
  it('a locked year has no note and no marker; every other year has both', () => {
    show();
    ready(dataWith({ lockedYears: [2017, 2019] }));
    flushSync();
    expect(cards().map((c) => c.year)).toEqual(YEARS);
    expect(notFinal()).toEqual([2018, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    for (const c of cards()) {
      expect(c.dot, `${c.year} marker`).toBe(c.note !== 'none');
      expect(c.heading, `${c.year} heading`).toBe(c.note !== 'none');
    }
    // the table under it marks the same years
    expect(rows().filter((r) => r.dot).map((r) => r.year)).toEqual([2018, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(rows().map((r) => r.year)).toEqual(YEARS);
  });

  it('the current year keeps its own sentence; an earlier year gets the one about the lock', () => {
    show();
    ready(dataWith({ lockedYears: [2017] }));
    flushSync();
    const byYear = Object.fromEntries(cards().map((c) => [c.year, c.note]));
    expect(byYear[2026]).toBe('current');
    for (const y of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]) expect(byYear[y], String(y)).toBe('open');
    expect(byYear[2017]).toBe('none');
  });

  it('an earlier year is never told that its Chhath "is not yet complete"', () => {
    show();
    ready(dataWith({ lockedYears: [] }));
    flushSync();
    const items = [...host.querySelector('section ol')!.querySelectorAll(':scope > li')];
    const text = (y: number) => items[YEARS.indexOf(y)].textContent!.replace(/\s+/g, ' ');
    expect(text(2024)).toContain('The 2024 records have not been locked by the committee yet');
    expect(text(2024)).not.toMatch(/not yet complete|updated live during the year/);
    expect(text(2024)).toContain('once the 2024 records are locked');
    expect(text(2026)).toContain('Chhath 2026 is not yet complete');
    expect(text(2026)).not.toContain('have not been locked');
  });

  it('nothing locked: every year is not final', () => {
    show();
    ready(dataWith({ lockedYears: [] }));
    flushSync();
    expect(notFinal()).toEqual(YEARS);
  });

  it('every year locked: no note and no marker anywhere on the page', () => {
    show();
    ready(dataWith({ lockedYears: YEARS }));
    flushSync();
    expect(notFinal()).toEqual([]);
    expect(cards().some((c) => c.dot)).toBe(false);
    expect(rows().some((r) => r.dot)).toBe(false);
    expect(host.textContent).not.toMatch(HEADING);
    expect(host.textContent).not.toMatch(OPEN);
    expect(host.textContent).not.toMatch(CURRENT);
  });

  it('locking the current year takes its note away, though it is still the current year — unlocking brings it back', () => {
    show();
    ready(dataWith({ lockedYears: [2017] }));
    flushSync();
    expect(cards().find((c) => c.year === 2026)!.note).toBe('current');

    ready(dataWith({ lockedYears: [2017, 2026] }));
    flushSync();
    expect(cards().find((c) => c.year === 2026)).toMatchObject({ dot: false, note: 'none', heading: false });

    ready(dataWith({ lockedYears: [2017] }));
    flushSync();
    expect(cards().find((c) => c.year === 2026)).toMatchObject({ dot: true, note: 'current', heading: true });
  });

  it('the figures are the same whether a year is locked or not', () => {
    const figures = () => [...host.querySelectorAll('[role="table"] [role="row"]')].slice(1)
      .map((r) => [...r.querySelectorAll('[role="cell"]')].slice(1).map((c) => c.textContent!.trim()).join(' | '));
    show();
    ready(dataWith());
    flushSync();
    const before = figures();
    ready(dataWith({ lockedYears: [2017, 2018, 2025] }));
    flushSync();
    expect(figures()).toEqual(before);
    expect(before[0]).toBe('₹100 | 1');
    expect(before[8]).toBe('₹500 | 1');
  });
});

// ---------------------------------------------------------------------------------- not told

describe('the data does not say which years are locked', () => {
  it('only the current year is marked, exactly as the page did before the lock was public', () => {
    show();
    ready(dataWith()); // no lockedYears key at all (an older Worker, or a copy saved earlier)
    flushSync();
    expect(notFinal()).toEqual([2026]);
    expect(cards().find((c) => c.year === 2026)!.note).toBe('current');
    expect(cards().filter((c) => c.dot).map((c) => c.year)).toEqual([2026]);
    expect(rows().filter((r) => r.dot).map((r) => r.year)).toEqual([2026]);
  });

  it('a lockedYears of the wrong shape is "not told" too — it does not mark every year', () => {
    show();
    ready(dataWith({ lockedYears: 'all of them' }));
    flushSync();
    expect(notFinal()).toEqual([2026]);
  });

  it('before anything has loaded and with no build-time facts, it is the same: the current year only', () => {
    show();
    expect(notFinal()).toEqual([2026]);
  });
});

// ------------------------------------------------------------------------- before the data lands

describe('the facts the build wrote carry the page until the live data arrives', () => {
  it('draws the notes from them, so the HTML is right before any JavaScript has run', () => {
    putCarrier(dataWith({ lockedYears: [2017, 2018] }));
    show();
    expect(notFinal()).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(cards().filter((c) => c.dot).map((c) => c.year)).toEqual(notFinal());
    // and the "accounts in words" below is made of the very same facts
    expect(host.textContent).toContain('2025: ₹500 from 1 contributor (not final yet)');
  });

  it('when the live data lands, the data decides — in either direction', () => {
    putCarrier(dataWith({ lockedYears: [2017, 2018] }));
    show();
    ready(dataWith({ lockedYears: [2017] })); // 2018 was unlocked after the build
    flushSync();
    expect(cards().find((c) => c.year === 2018)!.note).toBe('open');

    ready(dataWith({ lockedYears: [2017, 2018, 2019, 2020] })); // and two more were locked
    flushSync();
    expect(notFinal()).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it('live data that does not say (an old copy) falls back to the calendar — not to the build’s facts', () => {
    putCarrier(dataWith({ lockedYears: [2017, 2018] }));
    show();
    ready(dataWith()); // no lockedYears in what arrived
    flushSync();
    expect(notFinal()).toEqual([2026]);
  });

  it('if loading fails outright, it keeps what the build wrote rather than going back to guessing', () => {
    putCarrier(dataWith({ lockedYears: [2017, 2018] }));
    show();
    portalState.set({ status: 'error', data: EMPTY_PORTAL_DATA, stale: true, savedAt: 0, version: '', failed: true, source: 'empty' });
    flushSync();
    expect(notFinal()).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it('data that is flagged failed is not live data, even in a state that says "ready"', () => {
    // The store never produces this (a failure is status "error"), but the "accounts in words" on
    // the same page refuses it too, and the two must not disagree about whether data is live.
    putCarrier(dataWith({ lockedYears: [2017, 2018] }));
    show();
    ready(dataWith({ lockedYears: [2017, 2018, 2019, 2020] }), { failed: true });
    flushSync();
    expect(notFinal()).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it('reads the facts at the start even when the page is first drawn from live data', () => {
    // A page can be drawn from live data first and lose it later (a refresh that fails). The
    // block is gone from <head> by then, so the facts have to have been read at the start.
    putCarrier(dataWith({ lockedYears: [2017, 2018] }));
    ready(dataWith({ lockedYears: [2017, 2018, 2019, 2020] }));
    show();
    expect(notFinal()).toEqual([2021, 2022, 2023, 2024, 2025, 2026]); // the live data decides
    document.getElementById('cpm-snapshot-decade')?.remove();
    portalState.set({ status: 'error', data: EMPTY_PORTAL_DATA, stale: true, savedAt: 0, version: '', failed: true, source: 'empty' });
    flushSync();
    expect(notFinal()).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]); // back to what the build wrote
  });

  it('reads the facts once at the start: it survives the block leaving the document', () => {
    // Svelte removes the server's <head> nodes while it hydrates, so a later read would find none.
    putCarrier(dataWith({ lockedYears: [2017, 2018] }));
    show();
    document.getElementById('cpm-snapshot-decade')?.remove();
    portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
    flushSync();
    expect(notFinal()).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it('ignores a block that is for another page, or damaged', () => {
    const other = document.createElement('div');
    other.innerHTML = carrierScript('expenses', { asOf: '2026-10-14', facts: factsForPage('expenses', dataWith(), 2025, NOW) });
    document.head.appendChild(other.firstElementChild!);
    const bad = document.createElement('script');
    bad.type = 'application/json';
    bad.id = 'cpm-snapshot-decade';
    bad.textContent = '{not json';
    document.head.appendChild(bad);
    show();
    expect(notFinal()).toEqual([2026]);
  });
});

// ------------------------------------------------------------------------------------ Hindi

describe('in Hindi (/hi/decade)', () => {
  it('the same years carry the notes, in Hindi', () => {
    show('hi');
    ready(dataWith({ lockedYears: [2017] }));
    flushSync();
    expect(notFinal()).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    const items = [...host.querySelector('section ol')!.querySelectorAll(':scope > li')];
    const text = (y: number) => items[YEARS.indexOf(y)].textContent!.replace(/\s+/g, ' ');
    expect(text(2024)).toContain('2024 के financial records अभी final नहीं हैं');
    expect(text(2024)).toContain('समिति ने 2024 के records अभी lock नहीं किए हैं');
    expect(text(2024)).not.toContain('अभी पूरा नहीं हुआ');
    expect(text(2026)).toContain('Chhath 2026 अभी पूरा नहीं हुआ है');
    expect(text(2017)).not.toMatch(HEADING);
  });

  it('the words below the table agree, in Hindi too', () => {
    show('hi');
    ready(dataWith({ lockedYears: [2017] }));
    flushSync();
    expect(host.textContent).toContain('2025: 1 योगदानकर्ता से ₹500 (अभी final नहीं)');
    expect(host.textContent).toContain('2017: 1 योगदानकर्ता से ₹100');
    expect(host.textContent).not.toContain('2017: 1 योगदानकर्ता से ₹100 (अभी final नहीं)');
  });
});

// ------------------------------------------------------- the text can still be edited in mgmt

describe('the committee’s own wording (Journey Content in the management portal)', () => {
  const custom = (en: Record<string, string>) => dataWith({ lockedYears: [2017], journeyPageText: { en, hi: {} } });

  it('replaces the shared heading, and each of the two sentences, where one is set', () => {
    show();
    ready(custom({
      current_note_h: 'Heads up: {year} is open',
      current_note_p: 'Live now: {year}.',
      open_note_p: 'Still to lock: {year}.',
    }));
    flushSync();
    const items = [...host.querySelector('section ol')!.querySelectorAll(':scope > li')];
    const text = (y: number) => items[YEARS.indexOf(y)].textContent!.replace(/\s+/g, ' ');
    expect(text(2026)).toContain('Heads up: 2026 is open');
    expect(text(2026)).toContain('Live now: 2026.');
    expect(text(2024)).toContain('Heads up: 2024 is open');
    expect(text(2024)).toContain('Still to lock: 2024.');
    expect(text(2017)).not.toContain('Heads up');
  });

  it('where nothing is set, the built-in wording is used', () => {
    show();
    ready(custom({ current_note_p: 'Live now: {year}.' })); // only the current-year sentence is edited
    flushSync();
    const items = [...host.querySelector('section ol')!.querySelectorAll(':scope > li')];
    expect(items[YEARS.indexOf(2026)].textContent).toContain('Live now: 2026.');
    expect(items[YEARS.indexOf(2024)].textContent).toContain('The 2024 records have not been locked by the committee yet');
  });
});

// ------------------------------------------------------------------------------------ privacy

describe('names', () => {
  it('nothing the lock adds to the page carries a person’s name', () => {
    putCarrier(dataWith({ lockedYears: [2017] }));
    show();
    const snap = host.innerHTML;
    ready(dataWith({ lockedYears: [2017] }));
    flushSync();
    for (const n of ['Ravi Verma', 'रवि वर्मा', 'U1']) {
      expect(snap, `build facts: ${n}`).not.toContain(n);
      expect(host.innerHTML, `live: ${n}`).not.toContain(n);
    }
  });
});
