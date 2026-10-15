// ====== Which years are final: the lock the committee sets in the management portal ======
//
// A locked year takes no more add/edit/delete, so its records are final. The public Worker now
// publishes the locked years as `lockedYears`, and these are the rules the site applies to them:
//
//  * a list — even an empty one — is an ANSWER: exactly those years are final, whatever the calendar;
//  * no list at all means "not told" (an older Worker, a copy saved before the field existed, the
//    empty payload before the first load). That is NOT "nothing is locked": it falls back to what
//    the page did before the lock was public — every year but the current one is final;
//  * the lock changes which years are marked final and NOTHING else: no figure moves.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parsePortalData, EMPTY_PORTAL_DATA } from './schema';
import { lockedYearSet, isYearFinal, decadeStats, DECADE_START_YEAR } from './derive';
import { t } from '$lib/i18n';

const base = {
  users: [{ ID: 'U1', Name: 'Ravi Verma' }],
  collections: [
    { Name: 'U1', Year: 2017, Amount: 100, 'Contribution Type': '1' },
    { Name: 'U1', Year: 2018, Amount: 200, 'Contribution Type': '1' },
    { Name: 'U1', Year: 2025, Amount: 500, 'Contribution Type': '1' },
  ],
};
const withLocks = (lockedYears?: unknown) => parsePortalData(lockedYears === undefined ? base : { ...base, lockedYears })!;

beforeEach(() => {
  // decadeStats reads the calendar year from the clock; pin it so "the current year" is 2026.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T06:00:00Z'));
});
afterEach(() => vi.useRealTimers());

// ------------------------------------------------------------------------------------ the field

describe('lockedYears in the payload', () => {
  it('is kept as sent: numbers, or numbers written as text', () => {
    expect(withLocks([2017, 2018]).lockedYears).toEqual([2017, 2018]);
    expect(withLocks(['2017', '2018']).lockedYears).toEqual(['2017', '2018']);
  });

  it('an empty list stays an empty list — it is an answer, not a gap', () => {
    expect(withLocks([]).lockedYears).toEqual([]);
  });

  it('is simply absent from a payload that does not carry it', () => {
    expect(withLocks().lockedYears).toBeUndefined();
    expect(EMPTY_PORTAL_DATA.lockedYears).toBeUndefined();
  });

  it('a value of the wrong shape reads as absent — and never costs the visitor the rest of the payload', () => {
    for (const bad of [null, '2017', 2017, {}, { 2017: true }, [{}], [null], [[2017]], true]) {
      const parsed = withLocks(bad);
      expect(parsed.lockedYears, JSON.stringify(bad)).toBeUndefined();
      expect(parsed.collections, 'the rest of the payload parses').toHaveLength(3);
    }
  });
});

describe('lockedYearSet', () => {
  it('is null when the payload does not say, and an empty set when it says "none"', () => {
    expect(lockedYearSet(withLocks())).toBeNull();
    expect(lockedYearSet(EMPTY_PORTAL_DATA)).toBeNull();
    expect(lockedYearSet(withLocks([]))).toEqual(new Set());
  });

  it('collects whole years, whether sent as numbers or as text, and drops anything else', () => {
    expect(lockedYearSet(withLocks([2018, '2019', ' 2020 ', 2018]))).toEqual(new Set([2018, 2019, 2020]));
    expect(lockedYearSet(withLocks([0, -1, 'abc', '', '2018.5', 2018.5, '  ']))).toEqual(new Set());
  });
});

describe('isYearFinal', () => {
  it('when the locked years are known: exactly those, whatever the calendar says', () => {
    const locked = new Set([2017, 2026]);
    expect(isYearFinal(2017, 2026, locked)).toBe(true);
    expect(isYearFinal(2026, 2026, locked)).toBe(true); // the current year, locked: final
    expect(isYearFinal(2025, 2026, locked)).toBe(false); // a past year nobody locked: not final
    expect(isYearFinal(2025, 2026, new Set())).toBe(false); // nothing locked: nothing is final
  });

  it('when they are not: every year but the current one — what the page did before', () => {
    expect(isYearFinal(2025, 2026, null)).toBe(true);
    expect(isYearFinal(2017, 2026, null)).toBe(true);
    expect(isYearFinal(2026, 2026, null)).toBe(false);
  });
});

// ------------------------------------------------------------------------------------ the page

describe('decadeStats marks each year final or not', () => {
  const finals = (data: Parameters<typeof decadeStats>[0]) =>
    Object.fromEntries(decadeStats(data).years.map((y) => [y.year, y.final]));
  const notFinal = (data: Parameters<typeof decadeStats>[0]) =>
    decadeStats(data).years.filter((y) => !y.final).map((y) => y.year);

  it('with locks: the locked years are final, every other year — the current one too — is not', () => {
    const d = decadeStats(withLocks([2017, 2019]));
    expect(d.years.map((y) => y.year)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(finals(withLocks([2017, 2019]))).toEqual({
      2017: true, 2018: false, 2019: true, 2020: false, 2021: false,
      2022: false, 2023: false, 2024: false, 2025: false, 2026: false,
    });
  });

  it('locks sent as text mean the same', () => {
    expect(notFinal(withLocks(['2017']))).toEqual(notFinal(withLocks([2017])));
  });

  it('nothing locked: no year is final', () => {
    expect(notFinal(withLocks([]))).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it('the current year, once locked, is final even though it is still the current year', () => {
    const d = decadeStats(withLocks([2026]));
    const y2026 = d.years.at(-1)!;
    expect(y2026).toMatchObject({ year: 2026, isCurrent: true, final: true });
    expect(notFinal(withLocks([2026]))).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it('every year locked: nothing is left to mark', () => {
    const all = Array.from({ length: 10 }, (_, i) => DECADE_START_YEAR + i);
    expect(notFinal(withLocks(all))).toEqual([]);
  });

  it('a locked year outside the range does no harm', () => {
    expect(decadeStats(withLocks([2017, 2099, 1999])).years).toHaveLength(10);
    expect(notFinal(withLocks([2017, 2099]))).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it('when the payload does not say: only the current year is not final, exactly as before', () => {
    expect(notFinal(withLocks())).toEqual([2026]);
    expect(notFinal(EMPTY_PORTAL_DATA)).toEqual([2026]);
    // …and `isCurrent` is the calendar, untouched by any of this.
    expect(decadeStats(withLocks()).years.filter((y) => y.isCurrent).map((y) => y.year)).toEqual([2026]);
    expect(decadeStats(withLocks([2017])).years.filter((y) => y.isCurrent).map((y) => y.year)).toEqual([2026]);
  });

  it('moves no figure: the lock decides what is marked final and nothing about what is counted', () => {
    const strip = (data: Parameters<typeof decadeStats>[0]) => {
      const d = decadeStats(data);
      return { ...d, years: d.years.map(({ final: _final, ...rest }) => rest) };
    };
    const without = strip(withLocks());
    expect(strip(withLocks([]))).toEqual(without);
    expect(strip(withLocks([2017, 2018, 2025]))).toEqual(without);
    expect(strip(withLocks([2017, 2018, 2025, 2026]))).toEqual(without);
    expect(without.grandTotal).toBe(800);
  });
});

// -------------------------------------------------------------------------------------- the words

describe('the words for a year that is not final', () => {
  it('the paragraph for an earlier year does not claim that its Chhath is not over', () => {
    const en = t('en', 'decade_open_note_p', { year: 2024 });
    expect(en).toBe(
      'The 2024 records have not been locked by the committee yet, so these figures can still be corrected. ' +
        'They will be treated as final once the 2024 records are locked.'
    );
    expect(en).not.toMatch(/not yet complete|updated live/);
    expect(t('en', 'decade_current_note_p', { year: 2026 })).toContain('Chhath 2026 is not yet complete');
  });

  it('fills the year into every place it is mentioned, in both languages', () => {
    for (const lang of ['en', 'hi'] as const) {
      const text = t(lang, 'decade_open_note_p', { year: 2024 });
      expect(text, lang).not.toContain('{year}');
      expect((text.match(/2024/g) || []).length, lang).toBeGreaterThanOrEqual(1);
    }
    expect((t('en', 'decade_open_note_p', { year: 2024 }).match(/2024/g) || []).length).toBe(2);
    expect(t('hi', 'decade_open_note_p', { year: 2024 })).toBe(
      'समिति ने 2024 के records अभी lock नहीं किए हैं, इसलिए इन figures में अभी सुधार हो सकता है। records lock होने के बाद इन्हें final माना जाएगा।'
    );
  });

  it('the heading is the one every not-final year shares', () => {
    expect(t('en', 'decade_current_note_h', { year: 2024 })).toBe('The 2024 financial records are not final yet');
    expect(t('hi', 'decade_current_note_h', { year: 2024 })).toBe('2024 के financial records अभी final नहीं हैं');
  });
});
