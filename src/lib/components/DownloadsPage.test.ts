// ====== The Download Center page: pick a village, search a name, open a person's documents ======
//
// /hi/downloads found nobody in any village while /downloads worked: the village picker's values
// were the Hindi labels and the people were matched on the English name. The real page is mounted
// here against the real stores and driven the way a visitor drives it — choose a village, type a
// name — in both languages. (The test the unit tests could not be: whether the <option> values the
// page really renders are the ones the search really understands.)
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Downloads from '../../routes/downloads/+page.svelte';
import { portalState, year } from '$lib/stores/portal';
import { lang } from '$lib/stores/lang';
import { parsePortalData, EMPTY_PORTAL_DATA, type PortalData } from '$lib/api/schema';

const user = (ID: string, Name: string, NameHi: string, Village: string, VillageHi: string) =>
  ({ ID, Name, 'Name (Hindi)': NameHi, Village, 'Village (Hindi)': VillageHi });

const DATA: PortalData = parsePortalData({
  users: [
    user('U1', 'Ravi Verma', 'रवि वर्मा', 'Shaharpura', ''),
    user('U2', 'Sita Devi', 'सीता देवी', 'Shaharpura', 'शहरपुरा'),
    user('U3', 'Mohan Das', 'मोहन दास', 'Gardih', 'गरडीह'),
    user('U5', 'Baghai Person', 'बघई व्यक्ति', 'Baghaidih', ''),
  ],
  collections: [
    { __rowIndex: 12, Year: 2025, Name: 'U2', Amount: 500, 'Contribution Type': '1', 'Is Resell': 'FALSE' },
  ],
  generatedFiles: [
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-12', public_link: 'https://files.example/2025/receipt-12.pdf' },
  ],
})!;

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;

const select = () => host.querySelector('select') as HTMLSelectElement;
const search = () => host.querySelector('input[type="search"]') as HTMLInputElement | null;
// The name of each person listed (the avatar's initials are in the row too, and are not the name).
const rows = () => [...host.querySelectorAll('ul.rows > li')].map((li) => li.querySelector('span.truncate')?.textContent?.trim() ?? '');
const optionTexts = () => [...select().options].filter((o) => o.value).map((o) => [o.value, o.textContent?.trim()]);

function chooseVillage(value: string) {
  select().value = value;
  select().dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}
function typeName(q: string) {
  const input = search()!;
  input.value = q;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

function show(language: 'en' | 'hi') {
  lang.set(language);
  portalState.set({ status: 'ready', data: DATA, stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network' });
  app = mount(Downloads, { target: host });
  flushSync();
}

beforeEach(() => {
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
});

describe('English', () => {
  it('offers the villages by their English names, and a search finds people', () => {
    show('en');
    expect(optionTexts()).toEqual([['Baghaidih', 'Baghaidih'], ['Gardih', 'Gardih'], ['Shaharpura', 'Shaharpura']]);
    chooseVillage('Shaharpura');
    typeName('sita');
    expect(rows()).toEqual(['Sita Devi']);
  });
});

describe('Hindi (/hi/downloads) — the page that was broken', () => {
  it('offers the villages by their Hindi names, with values that are the same as in English', () => {
    show('hi');
    expect(optionTexts()).toEqual([
      ['Gardih', 'गरडीह'],
      ['Shaharpura', 'शहरपुरा'],
      ['Baghaidih', 'Baghaidih'], // nobody in it has a Hindi spelling on file; it is still there
    ]);
  });

  it('choosing a village and typing a Hindi name finds the person', () => {
    show('hi');
    chooseVillage('Shaharpura');
    typeName('सीता');
    expect(rows()).toEqual(['सीता देवी']);
  });

  it('typing the English name works on the Hindi page too', () => {
    show('hi');
    chooseVillage('Shaharpura');
    typeName('ravi');
    expect(rows()).toEqual(['रवि वर्मा']);
  });

  it('every village on offer leads to its people — the old page showed none for any', () => {
    show('hi');
    const someoneThere: Record<string, string> = { Shaharpura: 'ravi', Gardih: 'mohan', Baghaidih: 'baghai' };
    const offered = optionTexts().map(([value]) => value as string);
    expect(offered.sort()).toEqual(Object.keys(someoneThere).sort());
    for (const value of offered) {
      chooseVillage(value);
      typeName(someoneThere[value]);
      expect(rows().length, value).toBe(1);
    }
  });

  it('the picker ahead of a search says what to do, and a name that is not there says so', () => {
    show('hi');
    chooseVillage('Gardih');
    typeName('zzz');
    expect(rows()).toEqual([]);
    expect(host.textContent).toContain('कोई परिणाम नहीं मिला।');
  });

  it('opening a person shows their documents, and the download link is the issued file', () => {
    show('hi');
    chooseVillage('Shaharpura');
    typeName('सीता');
    (host.querySelector('ul.rows button') as HTMLButtonElement).click();
    flushSync();
    expect(host.textContent).toContain('सीता देवी');
    const link = host.querySelector('a[target="_blank"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://files.example/2025/receipt-12.pdf');
    expect(link.textContent?.trim()).toBe('डाउनलोड');
  });
});
