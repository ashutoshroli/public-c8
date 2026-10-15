// ====== The Top 5 are the five highest AMOUNTS ======
//
// The badge used to count PEOPLE: everyone on the same amount shared a number and the next number
// was the count of people above. So a tie for second left out the 3 — 1, 2, 2, 4, 5 — and in
// 7 of the portal's 9 years at least one of 1..5 was missing. It counts AMOUNTS now: one number
// per different amount, counted from the top. Ties share a number; the next amount down is the
// very next number; more than five people can carry a badge, but the numbers 1..5 all appear.

import { describe, it, expect } from 'vitest';
import { denseRank, TOP_RANK_LIMIT } from './ranking';

const amounts = (list: number[]) => list.map((a) => ({ a }));
const ranksOf = (list: number[], max?: number) => denseRank(amounts(list), (x) => x.a, max).map((r) => r.rank);
const topOf = (list: number[], max?: number) => denseRank(amounts(list), (x) => x.a, max).map((r) => r.isTop);

/** What the site did before: the number is 1 + the count of PEOPLE above. Kept here to compare. */
function competition(list: number[]): number[] {
  return list.map((a) => 1 + list.filter((b) => b > a).length);
}

describe('denseRank', () => {
  it('different amounts: 1, 2, 3, 4, 5, 6 — the sixth is not in the Top 5', () => {
    expect(ranksOf([60, 50, 40, 30, 20, 10])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(topOf([60, 50, 40, 30, 20, 10])).toEqual([true, true, true, true, true, false]);
  });

  it('two on the same amount share a number, and the 3 is not left out: 1, 2, 2, 3, 4, 5', () => {
    // the committee's example (it used to give 1, 2, 2, 4, 5, 6)
    expect(ranksOf([1551, 1151, 1151, 1111, 1100, 1001, 1000])).toEqual([1, 2, 2, 3, 4, 5, 6]);
    expect(topOf([1551, 1151, 1151, 1111, 1100, 1001, 1000])).toEqual([true, true, true, true, true, true, false]);
  });

  it('three or more on one amount share it: 2, 2, 2', () => {
    expect(ranksOf([900, 800, 800, 800, 700, 600, 500, 400])).toEqual([1, 2, 2, 2, 3, 4, 5, 6]);
  });

  it('a tie at the top: the next amount is 2, not 5', () => {
    expect(ranksOf([500, 500, 500, 500, 400, 300, 300, 251, 250, 201])).toEqual([1, 1, 1, 1, 2, 3, 3, 4, 5, 6]);
  });

  it('a tie on the fifth amount takes every one of them in, and the amount after them is out', () => {
    expect(ranksOf([90, 80, 70, 60, 50, 50, 50, 40])).toEqual([1, 2, 3, 4, 5, 5, 5, 6]);
    expect(topOf([90, 80, 70, 60, 50, 50, 50, 40])).toEqual([true, true, true, true, true, true, true, false]);
  });

  it('so the Top 5 are five AMOUNTS: the number of people in it varies', () => {
    const count = (list: number[]) => topOf(list).filter(Boolean).length;
    expect(count([60, 50, 40, 30, 20, 10])).toBe(5);
    expect(count([1551, 1151, 1151, 1111, 1100, 1001, 1000])).toBe(6);
    expect(count([500, 500, 500, 500, 400, 300, 300, 251, 250, 201])).toBe(9);
  });

  it('fewer than five different amounts: everyone has a number, with no gap', () => {
    expect(ranksOf([300, 300, 200, 100])).toEqual([1, 1, 2, 3]);
    expect(topOf([300, 300, 200, 100])).toEqual([true, true, true, true]);
    expect(ranksOf([100])).toEqual([1]);
  });

  it('everyone on the same amount is first', () => {
    expect(ranksOf([70, 70, 70])).toEqual([1, 1, 1]);
  });

  it('nothing at all', () => {
    expect(denseRank([], () => 0)).toEqual([]);
  });

  it('an amount of nought is an amount like any other', () => {
    expect(ranksOf([50, 0, 0])).toEqual([1, 2, 2]);
  });

  it('the Top 5 are five, and the limit can be asked for', () => {
    expect(TOP_RANK_LIMIT).toBe(5);
    expect(topOf([60, 50, 40, 30, 20, 10], 3)).toEqual([true, true, true, false, false, false]);
    expect(topOf([60, 50, 50, 30, 20, 10], 2)).toEqual([true, true, true, false, false, false]);
  });

  it('keeps the entries it is given, in the order it is given them', () => {
    const items = [{ a: 5, id: 'x' }, { a: 9, id: 'y' }, { a: 5, id: 'z' }, { a: 7, id: 'w' }];
    const out = denseRank(items, (i) => i.a);
    expect(out.map((r) => r.item)).toEqual(items);
    for (const r of out) expect(items).toContain(r.item); // the very same objects
    expect(out.map((r) => r.rank)).toEqual([3, 1, 3, 2]);
  });

  it('does not need its input sorted: a number depends on the amount alone', () => {
    const sorted = [1551, 1151, 1151, 1111, 1100, 1001, 1000];
    const shuffled = [1111, 1000, 1151, 1551, 1001, 1151, 1100];
    const level = (list: number[]) => Object.fromEntries(denseRank(amounts(list), (x) => x.a).map((r) => [r.item.a, r.rank]));
    expect(level(shuffled)).toEqual(level(sorted));
  });
});

describe('what changes for the people who have a badge today', () => {
  // A seeded generator, so the lists are random but the test is the same every run.
  let seed = 20260415;
  const next = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const randomList = () => {
    const n = 1 + Math.floor(next() * 40);
    const distinct = 1 + Math.floor(next() * 14); // few different amounts, so ties are common
    return Array.from({ length: n }, () => 50 * (1 + Math.floor(next() * distinct))).sort((a, b) => b - a);
  };

  it('no number from 1 up to the last one in the Top 5 is ever skipped (500 random lists)', () => {
    for (let t = 0; t < 500; t++) {
      const list = randomList();
      const used = [...new Set(ranksOf(list).filter((r) => r <= 5))].sort((a, b) => a - b);
      expect(used, JSON.stringify(list)).toEqual([1, 2, 3, 4, 5].slice(0, used.length));
      // …and with five different amounts or more, all five numbers are there
      if (new Set(list).size >= 5) expect(used).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('nobody who has a badge today loses it, and no number goes UP (500 random lists)', () => {
    for (let t = 0; t < 500; t++) {
      const list = randomList();
      const before = competition(list);
      const after = ranksOf(list);
      const kept = topOf(list);
      list.forEach((_, i) => {
        expect(after[i], `${JSON.stringify(list)} @${i}`).toBeLessThanOrEqual(before[i]);
        if (before[i] <= 5) expect(kept[i]).toBe(true);
      });
    }
  });

  it('is the same as before when nothing ties among the five highest amounts', () => {
    // 2021 and 2025 of the portal's data: five different amounts at the top
    for (const list of [[2100, 801, 551, 521, 501, 500, 351], [1251, 1100, 1001, 666, 612, 611, 555]]) {
      expect(ranksOf(list).slice(0, 5)).toEqual(competition(list).slice(0, 5));
      expect(ranksOf(list).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('different people on the same amount always get the same number (500 random lists)', () => {
    for (let t = 0; t < 500; t++) {
      const list = randomList();
      const r = ranksOf(list);
      list.forEach((a, i) => list.forEach((b, j) => { if (a === b) expect(r[i]).toBe(r[j]); else expect(r[i] === r[j]).toBe(false); }));
    }
  });
});
