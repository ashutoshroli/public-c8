// ====== The contributors popup numbers the Top 5 the same way as the page and the rail ======
//
// The Top 5 are the five highest AMOUNTS: a tie shares a number, none is skipped, and more than
// five people can carry one. The popup reads the same ranked list as the home rail and the
// contributors page, so it must show the same numbers — and the crown on exactly those people.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import ContributorsListModal from './ContributorsListModal.svelte';
import { portalState, year } from '$lib/stores/portal';
import { lang } from '$lib/stores/lang';
import { parsePortalData, EMPTY_PORTAL_DATA } from '$lib/api/schema';

// Entered in this order. Two people gave ₹1,151: second place is shared and the 3 is not left out.
const GIVEN: Array<[string, number]> = [
  ['Gita Rai', 1000], ['Chitra Devi', 1151], ['Alka Rai', 1551], ['Esha Rai', 1100],
  ['Bela Devi', 1151], ['Farida Rai', 1001], ['Dinesh Rai', 1111],
];

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  lang.set('en');
  year.set(2025);
  portalState.set({
    status: 'ready',
    data: parsePortalData({
      users: GIVEN.map(([name], i) => ({ ID: `T${i}`, Name: name })),
      collections: GIVEN.map(([, amount], i) => ({ Year: 2025, ID: `T${i}`, Amount: String(amount), 'Contribution Type': '1' })),
    })!,
    stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network',
  });
});
afterEach(() => {
  if (app) { unmount(app); app = null; }
  document.body.innerHTML = '';
  portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
});

describe('the popup', () => {
  it('numbers the Top 5 by amount — 1, 2, 2, 3, 4, 5 — with a crown on each of the six', () => {
    app = mount(ContributorsListModal, { target: document.body, props: { open: true, onclose: () => {} } });
    flushSync();
    const rows = [...document.querySelectorAll('ul > li > button')];
    expect(rows).toHaveLength(7);
    // (the badge is the small gold circle on the avatar; the crown is the icon after the name)
    const badge = (row: Element) => row.querySelector('span.bg-gold')?.textContent?.trim() ?? null;
    const crown = (row: Element) => row.querySelector('svg.lucide-crown') !== null;
    const byName = (name: string) => rows.find((r) => r.textContent?.includes(name))!;

    expect(badge(byName('Alka Rai'))).toBe('1');
    expect(badge(byName('Bela Devi'))).toBe('2');
    expect(badge(byName('Chitra Devi'))).toBe('2');
    expect(badge(byName('Dinesh Rai'))).toBe('3');
    expect(badge(byName('Esha Rai'))).toBe('4');
    expect(badge(byName('Farida Rai'))).toBe('5');
    expect(badge(byName('Gita Rai')), 'the sixth amount is out').toBeNull();

    expect(rows.filter(crown)).toHaveLength(6);
    expect(crown(byName('Gita Rai'))).toBe(false);
  });
});
