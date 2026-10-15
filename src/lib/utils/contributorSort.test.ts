import { describe, it, expect } from 'vitest';
import { sortContributors, shownName, type ContributorSortKey } from './contributorSort';
import { denseRank, type Ranked } from './ranking';
import type { Contributor } from '$lib/api/derive';

// One contributor, with only the fields a sort can see filled in on purpose.
let seq = 0;
function person(over: Partial<Contributor> & { name: string }): Contributor {
  return {
    key: over.key ?? `K${seq}`,
    name: over.name,
    nameHindi: over.nameHindi ?? '',
    amount: over.amount ?? 0,
    village: '',
    villageHindi: '',
    designation: '',
    designationHindi: '',
    fatherName: '',
    fatherNameHindi: '',
    count: over.count ?? 1,
    order: over.order ?? seq++,
    hasMoney: over.hasMoney ?? true,
    kinds: new Set(over.hasMoney === false ? ['service'] : ['money']),
    detail: '',
    year: '2025',
    photo: '',
  };
}

// The way the page's data arrives: ledger order, with the rank of each person already worked out
// from the amounts (and never recomputed by a sort).
function ledger(people: Contributor[]): Ranked<Contributor>[] {
  const moneyOnly = people.filter((p) => p.hasMoney).sort((a, b) => b.amount - a.amount);
  const ranked = new Map(denseRank(moneyOnly, (p) => p.amount).map((r) => [r.item.key, r]));
  return people.map((p) => ranked.get(p.key) ?? { item: p, rank: 0, isTop: false });
}

const names = (l: Ranked<Contributor>[]) => l.map((r) => r.item.name);
const amounts = (l: Ranked<Contributor>[]) => l.map((r) => r.item.amount);

describe('sortContributors', () => {
  const people = () => {
    seq = 0;
    return ledger([
      person({ name: 'Mira', amount: 151 }),
      person({ name: 'Ravi', amount: 501 }),
      person({ name: 'Sita', amount: 301 }),
      person({ name: 'Dev', amount: 351 }),
      person({ name: 'Anu', amount: 351 }),
      person({ name: 'Zoya', amount: 1251 }),
      person({ name: 'Kiran', amount: 101 }),
    ]);
  };

  it('High → Low: the biggest gift first, ties A → Z', () => {
    const out = sortContributors(people(), 'amount_desc', 'en');
    expect(amounts(out)).toEqual([1251, 501, 351, 351, 301, 151, 101]);
    expect(names(out)).toEqual(['Zoya', 'Ravi', 'Anu', 'Dev', 'Sita', 'Mira', 'Kiran']);
  });

  it('Low → High: the smallest gift first, ties still A → Z (not reversed)', () => {
    const out = sortContributors(people(), 'amount_asc', 'en');
    expect(amounts(out)).toEqual([101, 151, 301, 351, 351, 501, 1251]);
    expect(names(out)).toEqual(['Kiran', 'Mira', 'Sita', 'Anu', 'Dev', 'Ravi', 'Zoya']);
  });

  it('Name: A → Z', () => {
    expect(names(sortContributors(people(), 'name', 'en'))).toEqual(['Anu', 'Dev', 'Kiran', 'Mira', 'Ravi', 'Sita', 'Zoya']);
  });

  it('is not the ledger order for any option (the bug: High → Low returned it untouched)', () => {
    const input = people();
    for (const key of ['amount_desc', 'amount_asc', 'name'] as ContributorSortKey[]) {
      expect(names(sortContributors(input, key, 'en')), key).not.toEqual(names(input));
    }
  });

  it('does not touch the list it is given', () => {
    const input = people();
    const before = names(input);
    const frozen = Object.freeze([...input]);
    expect(() => sortContributors(frozen, 'amount_desc', 'en')).not.toThrow();
    sortContributors(input, 'amount_asc', 'en');
    expect(names(input)).toEqual(before);
  });

  it('hands back the very same entries — rank and Top-5 flag travel with the person', () => {
    const input = people();
    const out = sortContributors(input, 'amount_desc', 'en');
    expect(out).toHaveLength(input.length);
    for (const entry of out) expect(input).toContain(entry); // same object, not a copy
    expect(out.filter((e) => e.isTop).map((e) => [e.item.name, e.rank])).toEqual([
      ['Zoya', 1], ['Ravi', 2], ['Anu', 3], ['Dev', 3], ['Sita', 4], ['Mira', 5],
    ]);
  });

  it('the Top-5 are the first ones listed under High → Low and the last ones under Low → High', () => {
    // five amounts are in the Top 5 — 1251, 501, 351, 301, 151 — and two people share 351: six people
    const desc = sortContributors(people(), 'amount_desc', 'en');
    expect(desc.slice(0, 6).every((e) => e.isTop)).toBe(true);
    expect(desc.slice(6).every((e) => !e.isTop)).toBe(true);
    const asc = sortContributors(people(), 'amount_asc', 'en');
    expect(asc.slice(0, 1).every((e) => !e.isTop)).toBe(true);
    expect(asc.slice(1).every((e) => e.isTop)).toBe(true);
  });

  it('gives the same answer however the input happens to be shuffled', () => {
    const input = people();
    const want = names(sortContributors(input, 'amount_desc', 'en'));
    for (let shift = 1; shift < input.length; shift++) {
      const rotated = [...input.slice(shift), ...input.slice(0, shift)];
      expect(names(sortContributors(rotated, 'amount_desc', 'en')), `shift ${shift}`).toEqual(want);
    }
    expect(names(sortContributors([...input].reverse(), 'amount_desc', 'en'))).toEqual(want);
  });

  it('an empty list and a single entry are fine', () => {
    expect(sortContributors([], 'amount_desc', 'en')).toEqual([]);
    const one = people().slice(0, 1);
    expect(sortContributors(one, 'amount_asc', 'hi')).toEqual(one);
  });
});

describe('people with no money amount', () => {
  const mixed = () => {
    seq = 0;
    return ledger([
      person({ name: 'Goods Giver', hasMoney: false }),
      person({ name: 'Small', amount: 51 }),
      person({ name: 'Service Giver', hasMoney: false }),
      person({ name: 'Big', amount: 2100 }),
      person({ name: 'Gave Zero', amount: 0 }), // a money entry that came to ₹0 still HAS an amount (₹0)
    ]);
  };

  it('come after everyone with an amount on High → Low, A → Z among themselves', () => {
    expect(names(sortContributors(mixed(), 'amount_desc', 'en'))).toEqual(['Big', 'Small', 'Gave Zero', 'Goods Giver', 'Service Giver']);
  });

  it('and ALSO after everyone with an amount on Low → High', () => {
    expect(names(sortContributors(mixed(), 'amount_asc', 'en'))).toEqual(['Gave Zero', 'Small', 'Big', 'Goods Giver', 'Service Giver']);
  });

  it('are in their A → Z place on Name', () => {
    expect(names(sortContributors(mixed(), 'name', 'en'))).toEqual(['Big', 'Gave Zero', 'Goods Giver', 'Service Giver', 'Small']);
  });

  it('a list of only such people is still ordered, by name', () => {
    seq = 0;
    const only = ledger([person({ name: 'B', hasMoney: false }), person({ name: 'A', hasMoney: false })]);
    expect(names(sortContributors(only, 'amount_desc', 'en'))).toEqual(['A', 'B']);
    expect(names(sortContributors(only, 'amount_asc', 'en'))).toEqual(['A', 'B']);
  });
});

describe('ties and repeat entries', () => {
  it('a big tie group (24 people on one amount, as in the real 2025 list) is A → Z, not ledger order', () => {
    seq = 0;
    const letters = 'QWERTYUIOPASDFGHJKLZXCVB'.split('');
    const tied = ledger(letters.map((n) => person({ name: n, amount: 101 })));
    const expected = [...letters].sort();
    expect(names(sortContributors(tied, 'amount_desc', 'en'))).toEqual(expected);
    expect(names(sortContributors(tied, 'amount_asc', 'en'))).toEqual(expected);
  });

  it('two people with the same name and amount keep their ledger order, every time', () => {
    seq = 0;
    const twins = ledger([
      person({ key: 'first', name: 'Ram Kumar', amount: 101, order: 0 }),
      person({ key: 'second', name: 'Ram Kumar', amount: 101, order: 1 }),
      person({ key: 'third', name: 'Ram Kumar', amount: 101, order: 2 }),
    ]);
    const keys = (l: Ranked<Contributor>[]) => l.map((r) => r.item.key);
    expect(keys(sortContributors(twins, 'amount_desc', 'en'))).toEqual(['first', 'second', 'third']);
    expect(keys(sortContributors([...twins].reverse(), 'amount_desc', 'en'))).toEqual(['first', 'second', 'third']);
    expect(keys(sortContributors([...twins].reverse(), 'name', 'en'))).toEqual(['first', 'second', 'third']);
  });

  it('a sum that beats a single bigger-looking gift is placed by the sum', () => {
    seq = 0;
    const list = ledger([
      person({ name: 'One Big', amount: 1000 }),
      person({ name: 'Gave Twice', amount: 1200, count: 2 }), // 700 + 500
    ]);
    expect(names(sortContributors(list, 'amount_desc', 'en'))).toEqual(['Gave Twice', 'One Big']);
    expect(names(sortContributors(list, 'amount_asc', 'en'))).toEqual(['One Big', 'Gave Twice']);
  });
});

describe('names are compared as the reader sees them', () => {
  const people = () => {
    seq = 0;
    return ledger([
      person({ name: 'Bimal', nameHindi: 'बिमल', amount: 100 }),
      person({ name: 'Chandan', nameHindi: 'चंदन', amount: 100 }),
      person({ name: 'Anil', nameHindi: 'अनिल', amount: 100 }),
      person({ name: 'Esha', nameHindi: 'ईशा', amount: 100 }),
    ]);
  };

  it('English page: by the English name', () => {
    expect(names(sortContributors(people(), 'name', 'en'))).toEqual(['Anil', 'Bimal', 'Chandan', 'Esha']);
  });

  it('Hindi page: by the Hindi name — बिमल comes after चंदन although Bimal is before Chandan', () => {
    const out = sortContributors(people(), 'name', 'hi');
    expect(out.map((r) => r.item.nameHindi)).toEqual(['अनिल', 'ईशा', 'चंदन', 'बिमल']);
  });

  it('Hindi page: equal amounts are put in Devanagari order too', () => {
    const out = sortContributors(people(), 'amount_desc', 'hi');
    expect(out.map((r) => r.item.nameHindi)).toEqual(['अनिल', 'ईशा', 'चंदन', 'बिमल']);
  });

  it('Hindi page: someone with no Hindi name is shown (and so sorted) by the English one', () => {
    seq = 0;
    const list = ledger([
      person({ name: 'Zed', amount: 5 }), // no Hindi name on file
      person({ name: 'Anil', nameHindi: 'अनिल', amount: 5 }),
      person({ name: 'Amy', amount: 5 }), // nor this one
    ]);
    expect(list.map((r) => shownName(r.item, 'hi'))).toEqual(['Zed', 'अनिल', 'Amy']);

    for (const key of ['name', 'amount_desc', 'amount_asc'] as ContributorSortKey[]) {
      const out = sortContributors(list, key, 'hi');
      // Sorted by what is on the cards, whatever the engine's collation puts between scripts:
      const shown = out.map((r) => shownName(r.item, 'hi'));
      expect(shown, key).toEqual([...shown].sort(new Intl.Collator('hi').compare));
      // …and the two with only an English name are in A → Z order. (Ordering them by the
      // empty Hindi field would have left them in ledger order: Zed first.)
      expect(names(out).indexOf('Amy'), key).toBeLessThan(names(out).indexOf('Zed'));
    }
  });

  it('shownName is the English name on the English page even when a Hindi one exists', () => {
    expect(shownName({ name: 'Anil', nameHindi: 'अनिल' }, 'en')).toBe('Anil');
    expect(shownName({ name: 'Anil', nameHindi: 'अनिल' }, 'hi')).toBe('अनिल');
    expect(shownName({ name: 'Anil', nameHindi: '' }, 'hi')).toBe('Anil');
  });
});
