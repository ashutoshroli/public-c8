/**
 * Dense ranking by amount: the Top 5 are the five highest AMOUNTS.
 *
 * Every different amount is one level, counted from the top: the highest amount is 1, the next
 * lower amount is 2, and so on. People who gave the same amount share a level, and the next
 * amount down is the very next level — no number is ever skipped:
 *
 *   amount   2100  2100  1501  1000  1000   786   600
 *   level       1     1     2     3     3     4     5
 *
 * "Top 5" is levels 1..5 (`maxTopRank`), not five people. Ties mean more than five people can
 * carry a badge — three people on level 2 are 2, 2, 2 — but the numbers 1, 2, 3, 4, 5 all appear
 * whenever there are five different amounts. Those in the Top 5 get the crown / gold / badge;
 * everyone else has none of it.
 *
 * It used to be competition ranking (1, 1, 3, 4, 4, 6 …), which counts the PEOPLE above you
 * instead of the amounts above you. A tie for second then left out the 3 — 1, 2, 2, 4, 5 — and in
 * 7 of the portal's 9 years at least one of 1..5 was missing. Nobody who had a badge loses it
 * with this rule (a level is never greater than the count of people above plus one); numbers only
 * get smaller, and people tied on the fifth amount come in.
 *
 * Pure and deterministic. It does not need its input sorted: a level depends on the amount alone,
 * and the result is in the order the entries came in.
 */

export const TOP_RANK_LIMIT = 5;

export interface Ranked<T> {
  item: T;
  /** 1-based level: 1 for the highest amount, 2 for the next different amount, … (always present, even outside the top N). */
  rank: number;
  /** True only when rank <= maxTopRank (gets crown / gold / badge). */
  isTop: boolean;
}

export function denseRank<T>(
  items: readonly T[],
  getAmount: (item: T) => number,
  maxTopRank: number = TOP_RANK_LIMIT
): Ranked<T>[] {
  // The different amounts, highest first; an amount's level is its place in that list.
  const levels = [...new Set(items.map(getAmount))].sort((a, b) => b - a);
  const levelOf = new Map<number, number>(levels.map((amount, i) => [amount, i + 1]));

  return items.map((item) => {
    const rank = levelOf.get(getAmount(item)) as number;
    return { item, rank, isTop: rank <= maxTopRank };
  });
}
