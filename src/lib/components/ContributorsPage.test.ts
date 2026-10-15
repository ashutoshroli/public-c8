// ====== The Contributors page: "Amount: High → Low" has to put the biggest gift first ======
//
// "Amount: High → Low" (the option the page opens with) showed the contributors in the order they
// were ENTERED in the ledger — ₹151, ₹501, ₹301, ₹351, … — with the Top-5 badges scattered down the
// list. The page applied no sort for that option at all: it relied on whatever order
// `rankedContributors()` hands back, and that function returns EVERYONE in entry (SL No.) order on
// purpose, because the home rail and the list popup are meant to show the ledger order. So the
// label said one thing and the list did another.
//
// The real page is mounted here against the real stores and driven the way a visitor drives it —
// pick an option in the dropdown — in both languages. The fixture is arranged so that the ledger
// (entry) order matches NEITHER the amount order NOR the name order, and so that the Hindi names
// sort differently from their English spellings: a list that is still in ledger order, or sorted
// by the wrong name, cannot pass by accident.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Contributors from '../../routes/contributors/+page.svelte';
import { portalState, year } from '$lib/stores/portal';
import { lang } from '$lib/stores/lang';
import { parsePortalData, EMPTY_PORTAL_DATA, type PortalData } from '$lib/api/schema';

const user = (ID: string, Name: string, NameHi: string, Village: string) =>
  ({ ID, Name, 'Name (Hindi)': NameHi, Village, 'Village (Hindi)': '' });
const money = (ID: string, Amount: number) =>
  ({ Year: 2025, ID, Amount, 'Contribution Type': '1', 'Is Resell': 'FALSE' });
const inKind = (ID: string, type: '2' | '3', Detail: string) =>
  ({ Year: 2025, ID, Amount: 0, 'Contribution Type': type, Detail, 'Is Resell': 'FALSE' });

// English alphabetical order:  Anil, Asha, Bimal, Chandan, Deepak, Esha, Farhan, Gopal, Hari, Umesh
// Devanagari order of the Hindi names:  अनिल, आशा, ईशा, उमेश, गोपाल, चंदन, दीपक, फरहान, बिमल, हरि
// (Bimal sorts before Chandan and Deepak in English and after both in Hindi.)
const DATA: PortalData = parsePortalData({
  users: [
    user('U01', 'Asha Devi', 'आशा देवी', 'Shaharpura'),
    user('U02', 'Bimal Kumar', 'बिमल कुमार', 'Gardih'),
    user('U03', 'Chandan Rai', 'चंदन राय', 'Shaharpura'),
    user('U04', 'Deepak Singh', 'दीपक सिंह', 'Gardih'),
    user('U05', 'Esha Verma', 'ईशा वर्मा', 'Shaharpura'),
    user('U06', 'Farhan Ali', 'फरहान अली', 'Gardih'),
    user('U07', 'Gopal Das', 'गोपाल दास', 'Gardih'),
    user('U08', 'Hari Om', 'हरि ओम', 'Shaharpura'),
    user('U09', 'Anil Mishra', 'अनिल मिश्र', 'Shaharpura'),
    user('U10', 'Umesh Roy', 'उमेश रॉय', 'Gardih'),
  ],
  // The LEDGER order (this is the order the page used to show for "High → Low"):
  //   Asha, Chandan, Anil, Deepak, Farhan, Gopal, Esha, Hari, Bimal, Umesh   (Farhan gave twice)
  collections: [
    money('U01', 500),
    money('U03', 101),
    money('U09', 2100),
    money('U04', 101),
    money('U06', 300),
    inKind('U07', '2', 'Bamboo'), // gave goods, not money: no amount, no rank
    money('U05', 1000),
    money('U08', 51),
    money('U02', 101),
    inKind('U10', '3', 'Sound system'), // gave a service, not money: no amount, no rank
    money('U06', 900), // Farhan's second gift: 300 + 900 = ₹1,200 (shown "2×")
  ],
})!;

// What a visitor should see, top to bottom, for each option (English names).
const HIGH_TO_LOW = ['Anil Mishra', 'Farhan Ali', 'Esha Verma', 'Asha Devi', 'Bimal Kumar', 'Chandan Rai', 'Deepak Singh', 'Hari Om', 'Gopal Das', 'Umesh Roy'];
const LOW_TO_HIGH = ['Hari Om', 'Bimal Kumar', 'Chandan Rai', 'Deepak Singh', 'Asha Devi', 'Esha Verma', 'Farhan Ali', 'Anil Mishra', 'Gopal Das', 'Umesh Roy'];
const A_TO_Z = ['Anil Mishra', 'Asha Devi', 'Bimal Kumar', 'Chandan Rai', 'Deepak Singh', 'Esha Verma', 'Farhan Ali', 'Gopal Das', 'Hari Om', 'Umesh Roy'];

// The same, as the Hindi page shows them. (In Devanagari order उमेश comes before गोपाल — the
// reverse of Umesh/Gopal in English — so the two goods/service givers swap places too.)
const HI_HIGH_TO_LOW = ['अनिल मिश्र', 'फरहान अली', 'ईशा वर्मा', 'आशा देवी', 'चंदन राय', 'दीपक सिंह', 'बिमल कुमार', 'हरि ओम', 'उमेश रॉय', 'गोपाल दास'];
const HI_LOW_TO_HIGH = ['हरि ओम', 'चंदन राय', 'दीपक सिंह', 'बिमल कुमार', 'आशा देवी', 'ईशा वर्मा', 'फरहान अली', 'अनिल मिश्र', 'उमेश रॉय', 'गोपाल दास'];
const HI_A_TO_Z = ['अनिल मिश्र', 'आशा देवी', 'ईशा वर्मा', 'उमेश रॉय', 'गोपाल दास', 'चंदन राय', 'दीपक सिंह', 'फरहान अली', 'बिमल कुमार', 'हरि ओम'];

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;

interface Card { name: string; amount: number | null; badge: number | null; times: string | null }
// The rows of the list: one button per contributor, in a list.
const rowButtons = () => [...host.querySelectorAll('ul > li > button')];
const part = (row: Element, p: string) => row.querySelector(`[data-part="${p}"]`);
const cards = (): Card[] =>
  rowButtons().map((b) => {
    const amount = part(b, 'amount')?.textContent ?? null;
    const badge = part(b, 'rank')?.textContent ?? null;
    return {
      name: part(b, 'name')?.textContent?.trim() ?? '',
      amount: amount === null ? null : Number(amount.replace(/[^0-9]/g, '')),
      badge: badge === null ? null : Number(badge.trim()),
      times: part(b, 'times')?.textContent?.trim() ?? null,
    };
  });
const names = () => cards().map((c) => c.name);
const amounts = () => cards().map((c) => c.amount);

const select = () => host.querySelector('select') as HTMLSelectElement;
function sortBy(value: 'amount_desc' | 'amount_asc' | 'name') {
  select().value = value;
  select().dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

function show(language: 'en' | 'hi') {
  lang.set(language);
  portalState.set({ status: 'ready', data: DATA, stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network' });
  app = mount(Contributors, { target: host });
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
  vi.useRealTimers();
});

describe('English', () => {
  it('opens on "Amount: High → Low" — and that is what the list shows, not the ledger order', () => {
    show('en');
    expect(select().value).toBe('amount_desc');
    expect(names()).toEqual(HIGH_TO_LOW);
  });

  it('High → Low: the amounts only ever go down (anyone who gave goods or a service, with no amount, comes last)', () => {
    show('en');
    expect(amounts()).toEqual([2100, 1200, 1000, 500, 101, 101, 101, 51, null, null]);
  });

  it('Low → High: the amounts only ever go up, and the people with no amount are still last', () => {
    show('en');
    sortBy('amount_asc');
    expect(names()).toEqual(LOW_TO_HIGH);
    expect(amounts()).toEqual([51, 101, 101, 101, 500, 1000, 1200, 2100, null, null]);
  });

  it('people who gave the same amount are in A → Z order in BOTH directions, not in ledger order', () => {
    show('en');
    const tied = (rows: string[]) => rows.filter((n) => ['Bimal Kumar', 'Chandan Rai', 'Deepak Singh'].includes(n));
    expect(tied(names())).toEqual(['Bimal Kumar', 'Chandan Rai', 'Deepak Singh']);
    sortBy('amount_asc');
    expect(tied(names())).toEqual(['Bimal Kumar', 'Chandan Rai', 'Deepak Singh']);
  });

  it('a person who gave twice is placed by the SUM of the gifts, and says so', () => {
    show('en');
    const farhan = cards().find((c) => c.name === 'Farhan Ali')!;
    expect(farhan.amount).toBe(1200);
    expect(farhan.times).toBe('2×');
    expect(cards().filter((c) => c.times !== null).map((c) => c.name)).toEqual(['Farhan Ali']);
    expect(names().indexOf('Farhan Ali')).toBe(1); // below the ₹2,100 gift, above the ₹1,000 one
  });

  it('Name (A → Z) still sorts by name', () => {
    show('en');
    sortBy('name');
    expect(names()).toEqual(A_TO_Z);
  });

  it('the Top-5 come first under High → Low, and each keeps the rank the amounts give them', () => {
    show('en');
    const top = cards().filter((c) => c.badge !== null);
    // 1, 2, 3, 4, then the three-way tie on the fifth amount: all three are 5.
    expect(top.map((c) => [c.name, c.badge])).toEqual([
      ['Anil Mishra', 1], ['Farhan Ali', 2], ['Esha Verma', 3], ['Asha Devi', 4],
      ['Bimal Kumar', 5], ['Chandan Rai', 5], ['Deepak Singh', 5],
    ]);
    // …and they are the first seven cards: no badge sits further down the list.
    expect(cards().slice(0, 7).every((c) => c.badge !== null)).toBe(true);
    expect(cards().slice(7).every((c) => c.badge === null)).toBe(true);
  });

  it('a rank belongs to the person, not to the sort: the same people carry the same badges in every order', () => {
    show('en');
    const badges = () => Object.fromEntries(cards().filter((c) => c.badge !== null).map((c) => [c.name, c.badge]));
    const first = badges();
    expect(Object.keys(first).length).toBe(7);
    sortBy('amount_asc');
    expect(badges()).toEqual(first);
    sortBy('name');
    expect(badges()).toEqual(first);
    sortBy('amount_desc');
    expect(badges()).toEqual(first);
  });

  it('going round the options and back lands on exactly the same list', () => {
    show('en');
    const start = names();
    sortBy('amount_asc');
    sortBy('name');
    sortBy('amount_desc');
    expect(names()).toEqual(start);
  });

  it('every option lists everyone exactly once', () => {
    show('en');
    for (const key of ['amount_desc', 'amount_asc', 'name'] as const) {
      sortBy(key);
      expect([...names()].sort(), key).toEqual([...A_TO_Z].sort());
      expect(host.textContent, key).toContain('10 contributions');
    }
  });

  it('a search narrows the list, keeps the chosen order, and does not change anybody\'s rank', () => {
    vi.useFakeTimers();
    show('en');
    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'shaharpura'; // a village: Asha, Chandan, Esha, Hari, Anil
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    vi.advanceTimersByTime(300);
    flushSync();
    expect(names()).toEqual(['Anil Mishra', 'Esha Verma', 'Asha Devi', 'Chandan Rai', 'Hari Om']);
    // Esha is third overall, so she is "3" here too — not "2" because Farhan was filtered out.
    expect(cards().map((c) => c.badge)).toEqual([1, 3, 4, 5, null]);
    sortBy('amount_asc');
    expect(names()).toEqual(['Hari Om', 'Chandan Rai', 'Asha Devi', 'Esha Verma', 'Anil Mishra']);
  });
});

// ------------------------------------------------------------------ ties and the Top 5
//
// "Top 5" is the five highest AMOUNTS. People on the same amount share a number, and the next
// amount down is the very next number — nothing is skipped. (It used to count people instead, so
// a tie for second left out the 3: 1, 2, 2, 4, 5.) More than five people can carry a badge.

/** Givers of the given amounts (fake people), entered in the order given. */
function givers(list: Array<[string, number]>): PortalData {
  return parsePortalData({
    users: list.map(([name], i) => user(`T${i}`, name, name, 'Shaharpura')),
    collections: list.map(([, amount], i) => money(`T${i}`, amount)),
  })!;
}
function showWith(data: PortalData, language: 'en' | 'hi' = 'en') {
  lang.set(language);
  portalState.set({ status: 'ready', data, stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network' });
  app = mount(Contributors, { target: host });
  flushSync();
}
const badges = () => cards().map((c) => c.badge);
const topLabels = () => host.querySelectorAll('[data-part="top"]').length;
const badgeOf = () => Object.fromEntries(cards().map((c) => [c.name, c.badge]));

// The committee's example: two people on the same amount in second place.
const SECOND_PLACE_TIE = givers([
  ['Gita Rai', 1000], ['Chitra Devi', 1151], ['Alka Rai', 1551], ['Esha Rai', 1100],
  ['Bela Devi', 1151], ['Farida Rai', 1001], ['Dinesh Rai', 1111],
]);

describe('the Top 5 are the five highest amounts: ties share a number and no number is skipped', () => {
  it('two on the same amount: 1, 2, 2, 3, 4, 5 — the 3 is not left out', () => {
    showWith(SECOND_PLACE_TIE);
    expect(cards().map((c) => [c.name, c.amount])).toEqual([
      ['Alka Rai', 1551], ['Bela Devi', 1151], ['Chitra Devi', 1151], ['Dinesh Rai', 1111],
      ['Esha Rai', 1100], ['Farida Rai', 1001], ['Gita Rai', 1000],
    ]);
    expect(badges()).toEqual([1, 2, 2, 3, 4, 5, null]);
  });

  it('so six people are in the Top 5 here, and every one of them says so', () => {
    showWith(SECOND_PLACE_TIE);
    expect(topLabels()).toBe(6);
    expect(rowButtons().filter((b) => b.className.includes('border-gold'))).toHaveLength(6);
    // the sixth amount is out, however close it is
    expect(part(rowButtons()[6], 'rank')).toBeNull();
    expect(part(rowButtons()[6], 'top')).toBeNull();
  });

  it('three on one amount: 2, 2, 2', () => {
    showWith(givers([
      ['Zed Rai', 700], ['Hira Lal', 800], ['Amar Rai', 800], ['Kiran Rai', 1000],
      ['Bhim Rai', 800], ['Om Rai', 600], ['Pal Rai', 500], ['Raj Rai', 400],
    ]));
    expect(cards().map((c) => c.name)).toEqual(['Kiran Rai', 'Amar Rai', 'Bhim Rai', 'Hira Lal', 'Zed Rai', 'Om Rai', 'Pal Rai', 'Raj Rai']);
    expect(badges()).toEqual([1, 2, 2, 2, 3, 4, 5, null]);
    expect(topLabels()).toBe(7);
  });

  it('a tie at the top: the next amount is 2, not 5', () => {
    showWith(givers([
      ['A Rai', 500], ['B Rai', 500], ['C Rai', 500], ['D Rai', 500], ['E Rai', 400], ['F Rai', 300],
      ['G Rai', 300], ['H Rai', 251], ['I Rai', 250], ['J Rai', 201],
    ]));
    expect(badges()).toEqual([1, 1, 1, 1, 2, 3, 3, 4, 5, null]);
  });

  it('a tie on the fifth amount takes all of them in', () => {
    showWith(givers([['A Rai', 900], ['B Rai', 800], ['C Rai', 700], ['D Rai', 600], ['E Rai', 500], ['F Rai', 500], ['G Rai', 500], ['H Rai', 400]]));
    expect(badges()).toEqual([1, 2, 3, 4, 5, 5, 5, null]);
  });

  it('fewer than five different amounts: everyone has a number and there is still no gap', () => {
    showWith(givers([['A Rai', 300], ['B Rai', 300], ['C Rai', 200], ['D Rai', 100]]));
    expect(badges()).toEqual([1, 1, 2, 3]);
    expect(topLabels()).toBe(4);
  });

  it('a person has the same number whatever the sort and whatever the language', () => {
    showWith(SECOND_PLACE_TIE);
    const wanted = { 'Alka Rai': 1, 'Bela Devi': 2, 'Chitra Devi': 2, 'Dinesh Rai': 3, 'Esha Rai': 4, 'Farida Rai': 5, 'Gita Rai': null };
    expect(badgeOf()).toEqual(wanted);
    sortBy('amount_asc');
    expect(badgeOf()).toEqual(wanted);
    sortBy('name');
    expect(badgeOf()).toEqual(wanted);
    unmount(app!); app = null; host.innerHTML = '';
    showWith(SECOND_PLACE_TIE, 'hi');
    expect(badgeOf()).toEqual(wanted);
  });

  it('a search keeps the numbers of the whole list: filtering never renumbers anyone', () => {
    vi.useFakeTimers();
    showWith(SECOND_PLACE_TIE);
    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'rai'; // Alka, Dinesh, Esha, Farida, Gita — not the two Devis
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    vi.advanceTimersByTime(300);
    flushSync();
    expect(cards().map((c) => c.name)).toEqual(['Alka Rai', 'Dinesh Rai', 'Esha Rai', 'Farida Rai', 'Gita Rai']);
    expect(badges()).toEqual([1, 3, 4, 5, null]); // 3 stays 3: the two on 2 are only hidden
  });
});

describe('the list is rows, not cards', () => {
  it('is a real list: one item per contributor, each holding one button', () => {
    show('en');
    const list = host.querySelector('ul')!;
    expect(list).toBeTruthy();
    expect(list.querySelectorAll(':scope > li')).toHaveLength(10);
    for (const li of list.querySelectorAll(':scope > li')) expect(li.querySelectorAll('button')).toHaveLength(1);
    // and it is THE list of contributors: the first list on the page, ahead of the accounts text
    expect(list.querySelector('button [data-part="name"]')).toBeTruthy();
  });

  it('is one column on a phone, two on a tablet, three on a wide screen — and no longer the grid of tiny cards', () => {
    show('en');
    const classes = host.querySelector('ul')!.className;
    expect(classes).toContain('grid-cols-1');
    expect(classes).toContain('md:grid-cols-2');
    expect(classes).toContain('xl:grid-cols-3');
    // the old grid was three across on a phone, up to six on a tablet: ~105px per name
    expect(classes).not.toMatch(/(^|\s)grid-cols-3(\s|$)|xs:grid-cols|sm:grid-cols-5|md:grid-cols-6/);
  });

  it('each item is a flex box around its row, so in two or three columns the row fills the cell', () => {
    // jsdom has no layout; the measured proof is in the PR (boxes sharing a grid row are the same
    // height). Without `flex` the button keeps its content's height and the bottoms are ragged.
    show('en');
    // (the page has other lists — the years nav under "the accounts in words" — so only the
    // items that hold a contributor's button are looked at)
    const items = [...host.querySelectorAll('ul > li')].filter((li) => li.querySelector(':scope > button'));
    expect(items).toHaveLength(10);
    for (const li of items) expect(li.className).toMatch(/(^|\s)flex(\s|$)/);
  });

  it('keeps the page’s controls and the count above the list', () => {
    show('en');
    expect(host.querySelector('input[type="search"]')).toBeTruthy();
    expect(host.querySelector('select')).toBeTruthy();
    expect(host.textContent).toContain('10 contributions');
  });

  it('a row opens the person’s details when pressed', () => {
    show('en');
    (rowButtons()[0] as HTMLButtonElement).click();
    flushSync();
    // the detail card names the person it opened
    expect(document.body.textContent).toContain('Anil Mishra');
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('while loading, shows placeholder rows rather than an empty page', () => {
    lang.set('en');
    portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
    app = mount(Contributors, { target: host });
    flushSync();
    expect(host.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(host.querySelector('ul')).toBeNull();
  });
});

describe('Hindi (/hi/contributors)', () => {
  it('High → Low: same amount order, the Hindi names shown, equal gifts in Devanagari order', () => {
    show('hi');
    expect(names()).toEqual(HI_HIGH_TO_LOW);
    expect(amounts()).toEqual([2100, 1200, 1000, 500, 101, 101, 101, 51, null, null]);
  });

  it('Low → High', () => {
    show('hi');
    sortBy('amount_asc');
    expect(names()).toEqual(HI_LOW_TO_HIGH);
    expect(amounts()).toEqual([51, 101, 101, 101, 500, 1000, 1200, 2100, null, null]);
  });

  it('नाम (अ → ज्ञ) sorts by the Hindi name the reader sees — not by its English spelling', () => {
    show('hi');
    sortBy('name');
    expect(names()).toEqual(HI_A_TO_Z);
    // The old order (English spelling) put बिमल before चंदन, दीपक, ईशा and फरहान. It must not.
    expect(names().indexOf('बिमल कुमार')).toBeGreaterThan(names().indexOf('फरहान अली'));
  });

  it('the same people carry the same badges as on the English page', () => {
    show('hi');
    expect(cards().filter((c) => c.badge !== null).map((c) => [c.name, c.badge])).toEqual([
      ['अनिल मिश्र', 1], ['फरहान अली', 2], ['ईशा वर्मा', 3], ['आशा देवी', 4],
      ['चंदन राय', 5], ['दीपक सिंह', 5], ['बिमल कुमार', 5],
    ]);
  });
});
