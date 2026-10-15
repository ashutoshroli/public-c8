// ====== A contributor on the Contributors page is a row, and its name is never cut ======
//
// The page was a grid of small cards, three across on a phone, with the name clamped to one line at
// 12px: on a 360px phone 100 of 137 names were cut off after about twelve letters. The cards are
// rows now (see ContributorRow.svelte). jsdom has no layout, so whether a name really fits is
// measured in a browser (the PR description has it); what is pinned here is what makes that true —
// the name is rendered whole, in an element that has no way to clip it — and what else a row says.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ContributorRow from './ContributorRow.svelte';
import { lang } from '$lib/stores/lang';
import type { Contributor } from '$lib/api/derive';
import type { Ranked } from '$lib/utils/ranking';

function entry(over: Partial<Contributor> = {}, rank: { rank: number; isTop: boolean } = { rank: 0, isTop: false }): Ranked<Contributor> {
  const item: Contributor = {
    key: 'U1', name: 'Anil Mishra', nameHindi: 'अनिल मिश्र', amount: 501, village: 'Shaharpura', villageHindi: 'शहरपुरा',
    designation: '', designationHindi: '', fatherName: '', fatherNameHindi: '', count: 1, order: 0, hasMoney: true,
    kinds: new Set(['money']), detail: '', year: '2025', photo: '', ...over,
  };
  return { item, ...rank };
}

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;
const text = (p: string) => host.querySelector(`[data-part="${p}"]`)?.textContent?.trim() ?? null;
const all = (p: string) => [...host.querySelectorAll(`[data-part="${p}"]`)].map((e) => e.textContent!.trim());

function show(e: Ranked<Contributor>, language: 'en' | 'hi' = 'en', onclick?: () => void) {
  lang.set(language);
  app = mount(ContributorRow, { target: host, props: { entry: e, onclick } });
  flushSync();
}

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  if (app) { unmount(app); app = null; }
  lang.set('en');
  vi.restoreAllMocks();
});

describe('the name', () => {
  it('is shown whole, however long it is', () => {
    const long = 'Dhaneshwar Prasad Verma Ji Sahab ke Putra Shri Ramkishore Prasad';
    show(entry({ name: long }));
    expect(text('name')).toBe(long);
  });

  it('is in an element that cannot clip it: it wraps, and nothing truncates, clamps or hides overflow', () => {
    show(entry());
    const name = host.querySelector('[data-part="name"]')!;
    const classes = name.className;
    expect(classes).toContain('break-words');
    expect(classes, 'a single line with an ellipsis is the bug').not.toMatch(/\btruncate\b/);
    expect(classes).not.toMatch(/line-clamp/);
    expect(classes).not.toMatch(/overflow-hidden|whitespace-nowrap|text-ellipsis/);
    // …and nothing around it clips either: the column it sits in can shrink below its content
    // (min-w-0, so a long word wraps instead of pushing the amount out) but does not hide it.
    for (let el: Element | null = name.parentElement; el && el !== host; el = el.parentElement) {
      expect(el.className, el.tagName).not.toMatch(/overflow-hidden|line-clamp|\btruncate\b/);
    }
  });

  it('is large enough to read: 14px, bold', () => {
    show(entry());
    expect(host.querySelector('[data-part="name"]')!.className).toMatch(/\btext-sm\b/);
    expect(host.querySelector('[data-part="name"]')!.className).toMatch(/\bfont-bold\b/);
  });

  it('is the Hindi name on the Hindi page, and the English one when there is no Hindi name', () => {
    show(entry(), 'hi');
    expect(text('name')).toBe('अनिल मिश्र');
    unmount(app!); app = null; host.innerHTML = '';
    show(entry({ nameHindi: '' }), 'hi');
    expect(text('name')).toBe('Anil Mishra');
    unmount(app!); app = null; host.innerHTML = '';
    show(entry(), 'en');
    expect(text('name')).toBe('Anil Mishra');
  });
});

describe('what else the row says', () => {
  it('the amount, on the right', () => {
    show(entry({ amount: 1251 }));
    expect(text('amount')).toBe('₹1,251');
  });

  it('the village under the name, in the reader’s language', () => {
    show(entry());
    expect(text('village')).toBe('Shaharpura');
    unmount(app!); app = null; host.innerHTML = '';
    show(entry(), 'hi');
    expect(text('village')).toBe('शहरपुरा');
    unmount(app!); app = null; host.innerHTML = '';
    show(entry({ villageHindi: '' }), 'hi');
    expect(text('village'), 'no Hindi spelling on file: the English one').toBe('Shaharpura');
  });

  it('says "2×" for someone who gave twice, and nothing for someone who gave once', () => {
    show(entry({ count: 2 }));
    expect(text('times')).toBe('2×');
    unmount(app!); app = null; host.innerHTML = '';
    show(entry({ count: 1 }));
    expect(text('times')).toBeNull();
  });

  it('with no village and a single gift there is no second line at all', () => {
    show(entry({ village: '', villageHindi: '', count: 1 }));
    expect(text('village')).toBeNull();
    expect(text('times')).toBeNull();
    expect(host.querySelectorAll('[data-part="name"] ~ span')).toHaveLength(0);
  });

  it('someone who gave goods or a service, and no money, has tags where the amount would be', () => {
    show(entry({ amount: 0, hasMoney: false, kinds: new Set(['material', 'service']) }));
    expect(text('amount')).toBeNull();
    expect(all('tag')).toEqual(['Material', 'Service']);
    unmount(app!); app = null; host.innerHTML = '';
    show(entry({ amount: 0, hasMoney: false, kinds: new Set(['service']) }), 'hi');
    expect(all('tag')).toEqual(['सेवा']);
  });

  it('someone who gave money AND goods shows both', () => {
    show(entry({ amount: 300, kinds: new Set(['money', 'material']) }));
    expect(text('amount')).toBe('₹300');
    expect(all('tag')).toEqual(['Material']);
  });
});

describe('the Top 5', () => {
  it('have the gold border, the rank on the avatar, and the label', () => {
    show(entry({ amount: 1251 }, { rank: 1, isTop: true }));
    const row = host.querySelector('button')!;
    expect(row.className).toContain('border-gold');
    expect(text('rank')).toBe('1');
    expect(host.querySelector('[aria-label="Rank 1"]')).toBeTruthy();
    expect(text('top')).toBe('Top 5');
  });

  it('a tie shares its rank, as before', () => {
    show(entry({}, { rank: 3, isTop: true }));
    expect(text('rank')).toBe('3');
    expect(host.querySelector('[aria-label="Rank 3"]')).toBeTruthy();
  });

  it('everyone else has none of it', () => {
    show(entry({}, { rank: 12, isTop: false }));
    expect(host.querySelector('button')!.className).toContain('border-line');
    expect(host.querySelector('button')!.className).not.toContain('border-gold');
    expect(text('rank')).toBeNull();
    expect(text('top')).toBeNull();
    expect(host.querySelector('[aria-label^="Rank"]')).toBeNull();
  });

  it('the label is in Hindi on the Hindi page', () => {
    show(entry({}, { rank: 2, isTop: true }), 'hi');
    expect(text('top')).toBe('टॉप 5');
  });
});

describe('it is a button', () => {
  it('that opens the person when pressed', () => {
    const open = vi.fn();
    show(entry(), 'en', open);
    const button = host.querySelector('button')!;
    expect(button.getAttribute('type')).toBe('button');
    button.click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('whose accessible text carries the name, the village and the amount', () => {
    show(entry({ amount: 501 }));
    const t = host.querySelector('button')!.textContent!.replace(/\s+/g, ' ');
    expect(t).toContain('Anil Mishra');
    expect(t).toContain('Shaharpura');
    expect(t).toContain('₹501');
  });

  it('draws the photo through the one Avatar component, never its own <img>', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/components/ContributorRow.svelte'), 'utf8');
    expect(src).toContain('<Avatar');
    expect(src).not.toContain('<img');
  });
});
