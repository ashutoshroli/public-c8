// ====== The numbers behind "the accounts in words" ======
//
// ONE function turns portal data into the facts a text summary is written from, and it is used
// twice: at build time on the data fetched from the API (the snapshot a crawler reads in the
// HTML), and in the browser on the data the visitor loaded (the live text that replaces it). A
// snapshot and a live page built from the same data therefore agree to the rupee by construction,
// and a test holds them to it. They differ only in how fresh the data is.
//
// WHAT IS NEVER IN HERE
// ---------------------
// A person. No contributor, committee member, borrower or guarantor name; no father's name, photo
// or mobile number; and no individual's amount. Everything is a count, a total, a role or a village
// with enough people in it not to point at one of them. `facts.test.ts` feeds in a payload full of
// names and asserts none of them survives into the JSON.
//
// Facts carry BOTH languages' labels (role, village, expense line) so a single facts object can be
// written up in English or Hindi without another pass over the data.

import {
  DECADE_START_YEAR,
  availableYears,
  buildUserMap,
  collectionsForYear,
  committeeForYear,
  computeFinancials,
  computeSummary,
  contributorsForYear,
  expenseItems,
  journeyEntries,
  isRepaidLoan,
  loanTotalWithInterest,
  loansForYear,
  type YearSel,
} from '$lib/api/derive';
import { parseAmt } from '$lib/utils/format';
import type { PortalData } from '$lib/api/schema';
import { buildNameGuard, MAX_LINE_CHARS } from './redact';
import { istYear } from './ist';

export type PageKey = 'home' | 'expenses' | 'loans' | 'committee' | 'contributors' | 'decade';
export const PAGE_KEYS: readonly PageKey[] = ['home', 'expenses', 'loans', 'committee', 'contributors', 'decade'];

/** A village is only named when at least this many different people gave from it. */
export const MIN_VILLAGE_CONTRIBUTORS = 5;

export interface Bilingual { en: string; hi: string }

export interface DecadeRow {
  year: number;
  total: number;
  contributors: number;
  isCurrent: boolean;
  /** false for a year with no contribution recorded at all */
  hasRecords: boolean;
}

export interface DecadeFacts {
  kind: 'decade';
  startYear: number;
  endYear: number;
  years: DecadeRow[];
  /** How many of those years have any contribution on record (the open year may have none yet). */
  recordedYears: number;
  grandTotal: number;
  grandContributors: number;
}

export interface HomeFacts {
  kind: 'home';
  year: number;
  contributors: number;
  moneyGivers: number;
  /** Money given by contributors (the "Total Collected" card). */
  contributed: number;
  /** Everything collected in the year, resold items included (the "Collected" line of the budget). */
  collected: number;
  average: number;
  pastLoanReturned: number;
  budget: number;
  expenses: number;
  expenseCount: number;
  /**
   * Expenses as a share of the budget. NOT clamped to 100: the budget bar on the page stops at
   * full, but a ledger that overspent should say by how much, not that it is exactly 100% spent.
   */
  utilizedPct: number;
  loanGiven: number;
  loanCount: number;
  available: number;
  decade: Pick<DecadeFacts, 'startYear' | 'endYear' | 'recordedYears' | 'grandTotal' | 'grandContributors'>;
  /** Years that have records, newest first: the Home text links a page for each. */
  years: number[];
}

export interface ExpensesFacts {
  kind: 'expenses';
  year: number;
  count: number;
  total: number;
  /** Lines published as written, largest first. */
  items: { label: Bilingual; amount: number }[];
  /** Lines whose words were withheld (see redact.ts); their amounts are still in `total`. */
  folded: { count: number; total: number };
}

export interface LoansFacts {
  kind: 'loans';
  year: number;
  count: number;
  principal: number;
  interest: number;
  repayable: number;
  active: number;
  repaid: number;
  /** per-month rate, % */
  rate: { min: number; max: number } | null;
  /** months */
  tenure: { min: number; max: number } | null;
}

export interface CommitteeFacts {
  kind: 'committee';
  year: number;
  count: number;
  roles: { role: Bilingual; count: number }[];
}

export interface ContributorsFacts {
  kind: 'contributors';
  year: number;
  contributors: number;
  moneyGivers: number;
  materialGivers: number;
  serviceGivers: number;
  collected: number;
  average: number;
  /** Villages with at least MIN_VILLAGE_CONTRIBUTORS contributors, largest first. */
  villages: { name: Bilingual; count: number }[];
  /** Contributors from every other village, or with none recorded. */
  otherVillages: number;
}

export type PageFacts = HomeFacts | ExpensesFacts | LoansFacts | CommitteeFacts | ContributorsFacts | DecadeFacts;

/**
 * Everything the page for ONE year says (/2025, /hi/2025): the same facts the individual pages
 * use, for that year, plus the committee's one-paragraph story of it when there is one.
 */
export interface YearPack {
  year: number;
  home: HomeFacts;
  contributors: ContributorsFacts;
  expenses: ExpensesFacts;
  loans: LoansFacts;
  committee: CommitteeFacts;
  /** The year's entry from "Our Journey", unless it named someone; both languages. */
  story: { title: Bilingual; content: Bilingual } | null;
}

/**
 * What a build keeps of the data it fetched: the facts for each page, for the year shown by
 * default, and a pack for every year that has a page of its own. Names never get this far — see
 * the note at the top of this file.
 */
export interface Snapshot {
  /** The IST date the data was fetched on ('YYYY-MM-DD'). */
  asOf: string;
  /** The instant it was fetched (ISO, UTC). */
  builtAt: string;
  /** The year the page facts are for. */
  year: number;
  /** The API's data-version token at fetch time, when it gave one. */
  version: string;
  pages: Record<PageKey, PageFacts>;
  /** Years with a page of their own, newest first. */
  years: number[];
  /** The year pages, by year. */
  byYear: Record<number, YearPack>;
}

// -------------------------------------------------------------------------- which year

/**
 * The years that deserve a page of their own: any year with a contribution, a loan, a committee
 * or an expense on record. (`availableYears` covers the first three; the portal's year selector is
 * built from it. A year with only expenses is rare but real, and not one to lose.)
 */
export function yearsWithRecords(data: PortalData): number[] {
  const ys = new Set<number>(availableYears(data).filter((y) => collectionsForYear(data, y).length + loansForYear(data, y).length + committeeForYear(data, y).length > 0));
  for (const e of data.expenses ?? []) {
    const y = parseInt(String(e.Year ?? ''), 10);
    if (Number.isFinite(y)) ys.add(y);
  }
  return [...ys].sort((a, b) => b - a);
}

/**
 * The year shown before the visitor picks one — the same rule `initPortal` applies in the
 * browser: this calendar year if the data has it, otherwise the newest year that has any. (In
 * India, so a build at 19:00 UTC on 31 December already shows the new year.)
 */
export function defaultYear(data: PortalData, now: Date): number {
  const years = availableYears(data);
  const current = istYear(now);
  return years.includes(current) ? current : years[0];
}

// ---------------------------------------------------------------------------- the pages

export function decadeFacts(data: PortalData, now: Date): DecadeFacts {
  const present = availableYears(data);
  const dataMax = present.length ? Math.max(...present) : istYear(now);
  const currentYear = istYear(now);
  const endYear = Math.max(DECADE_START_YEAR, dataMax, currentYear);
  const userMap = buildUserMap(data);

  const years: DecadeRow[] = [];
  let grandTotal = 0;
  let grandContributors = 0;
  for (let y = DECADE_START_YEAR; y <= endYear; y++) {
    const s = computeSummary(data, y, userMap);
    years.push({
      year: y,
      total: s.totalCollected,
      contributors: s.contributors,
      isCurrent: y === currentYear,
      hasRecords: collectionsForYear(data, y).length > 0,
    });
    grandTotal += s.totalCollected;
    grandContributors += s.contributors;
  }
  const recordedYears = years.filter((r) => r.hasRecords).length;
  return { kind: 'decade', startYear: DECADE_START_YEAR, endYear, years, recordedYears, grandTotal, grandContributors };
}

export function homeFacts(data: PortalData, year: YearSel, now: Date): HomeFacts {
  const fin = computeFinancials(data, year);
  const sum = computeSummary(data, year);
  const money = contributorsForYear(data, year).filter((c) => c.hasMoney).length;
  const dec = decadeFacts(data, now);
  return {
    kind: 'home',
    year,
    contributors: sum.contributors,
    moneyGivers: money,
    contributed: sum.totalCollected,
    collected: fin.collection,
    average: sum.average,
    pastLoanReturned: fin.pastLoanReturned,
    budget: fin.totalBudget,
    expenses: fin.totalExpense,
    expenseCount: expenseItems(data, year).length,
    utilizedPct: fin.totalBudget > 0 ? (fin.totalExpense / fin.totalBudget) * 100 : 0,
    loanGiven: fin.loanGiven,
    loanCount: loansForYear(data, year).length,
    available: fin.available,
    years: yearsWithRecords(data),
    decade: {
      startYear: dec.startYear,
      endYear: dec.endYear,
      recordedYears: dec.recordedYears,
      grandTotal: dec.grandTotal,
      grandContributors: dec.grandContributors,
    },
  };
}

export function expensesFacts(data: PortalData, year: YearSel): ExpensesFacts {
  const guard = buildNameGuard(data.users);
  const all = expenseItems(data, year);
  const items: ExpensesFacts['items'] = [];
  const folded = { count: 0, total: 0 };
  let total = 0;

  for (const e of all) {
    total += e.amount;
    const en = e.description.trim();
    const hi = e.descriptionHindi.trim();
    const holdBack =
      !en ||
      [...en].length > MAX_LINE_CHARS ||
      [...hi].length > MAX_LINE_CHARS ||
      guard.mentionsPersonOrContact(en) ||
      guard.mentionsPersonOrContact(hi);
    if (holdBack) {
      folded.count += 1;
      folded.total += e.amount;
    } else {
      items.push({ label: { en, hi: hi || en }, amount: e.amount });
    }
  }
  items.sort((a, b) => b.amount - a.amount || a.label.en.localeCompare(b.label.en));
  return { kind: 'expenses', year, count: all.length, total, items, folded };
}

export function loansFacts(data: PortalData, year: YearSel): LoansFacts {
  const loans = loansForYear(data, year);
  let principal = 0;
  let interest = 0;
  let repaid = 0;
  const rates: number[] = [];
  const tenures: number[] = [];
  for (const l of loans) {
    const calc = loanTotalWithInterest(l);
    principal += calc.principal;
    interest += calc.interest;
    if (isRepaidLoan(l)) repaid += 1;
    const rate = parseAmt(l['Intrest Rate'] ?? l['Interest Rate']);
    const tenure = parseAmt(l.Tenure);
    if (rate > 0) rates.push(rate);
    if (tenure > 0) tenures.push(tenure);
  }
  const span = (xs: number[]) => (xs.length ? { min: Math.min(...xs), max: Math.max(...xs) } : null);
  return {
    kind: 'loans',
    year,
    count: loans.length,
    principal,
    interest,
    repayable: principal + interest,
    active: loans.length - repaid,
    repaid,
    rate: span(rates),
    tenure: span(tenures),
  };
}

export function committeeFacts(data: PortalData, year: YearSel): CommitteeFacts {
  const members = committeeForYear(data, year);
  const byRole = new Map<string, { role: Bilingual; count: number }>();
  for (const m of members) {
    const en = m.role.trim() || 'Member';
    const hi = m.roleHindi.trim() || (m.role.trim() ? m.role.trim() : 'सदस्य');
    const key = en.toLowerCase();
    const hit = byRole.get(key);
    if (hit) hit.count += 1;
    else byRole.set(key, { role: { en, hi }, count: 1 });
  }
  // First-seen order: the ledger lists the office-bearers before the members.
  return { kind: 'committee', year, count: members.length, roles: [...byRole.values()] };
}

export function contributorsFacts(data: PortalData, year: YearSel): ContributorsFacts {
  const list = contributorsForYear(data, year);
  const sum = computeSummary(data, year);

  const byVillage = new Map<string, { name: Bilingual; count: number }>();
  for (const c of list) {
    const en = c.village.trim();
    if (!en) continue;
    const key = en.toLowerCase();
    const hit = byVillage.get(key);
    if (hit) hit.count += 1;
    else byVillage.set(key, { name: { en, hi: c.villageHindi.trim() || en }, count: 1 });
  }
  // A village of two or three people can be read as naming them. Only larger ones are listed.
  const named = [...byVillage.values()]
    .filter((v) => v.count >= MIN_VILLAGE_CONTRIBUTORS)
    .sort((a, b) => b.count - a.count || a.name.en.localeCompare(b.name.en));
  const namedTotal = named.reduce((s, v) => s + v.count, 0);

  return {
    kind: 'contributors',
    year,
    contributors: sum.contributors,
    moneyGivers: list.filter((c) => c.hasMoney).length,
    materialGivers: list.filter((c) => c.kinds.has('material')).length,
    serviceGivers: list.filter((c) => c.kinds.has('service')).length,
    collected: sum.totalCollected,
    average: sum.average,
    villages: named,
    otherVillages: sum.contributors - namedTotal,
  };
}

/** The facts for one page. `now` fixes "this year" and the decade's open year, for tests and builds. */
export function factsForPage(page: PageKey, data: PortalData, year: YearSel, now: Date): PageFacts {
  switch (page) {
    case 'home': return homeFacts(data, year, now);
    case 'expenses': return expensesFacts(data, year);
    case 'loans': return loansFacts(data, year);
    case 'committee': return committeeFacts(data, year);
    case 'contributors': return contributorsFacts(data, year);
    case 'decade': return decadeFacts(data, now);
  }
}

// ------------------------------------------------------------------------------ one year

/**
 * Reads the committee's story of a year ("Our Journey") and decides whether it may be published:
 * not if it names a person (the WHOLE name of someone in the users table), or holds a phone number
 * or an email. `withheld` says it was held back for that reason, so a build can report it.
 */
function readStory(data: PortalData, year: YearSel): { story: YearPack['story']; withheld: boolean } {
  const entry = journeyEntries(data).find((e) => e.year === year);
  if (!entry) return { story: null, withheld: false };
  const title = { en: entry.titleEn.trim(), hi: (entry.titleHi || entry.titleEn).trim() };
  const content = { en: entry.contentEn.trim(), hi: (entry.contentHi || entry.contentEn).trim() };
  if (!title.en && !content.en) return { story: null, withheld: false };
  const guard = buildNameGuard(data.users);
  const named = [entry.titleEn, entry.titleHi, entry.contentEn, entry.contentHi].some((x) => guard.mentionsFullNameOrContact(x));
  return named ? { story: null, withheld: true } : { story: { title, content }, withheld: false };
}

/** The committee's story of a year, unless it names a person, a phone or an email. */
export function storyFor(data: PortalData, year: YearSel): YearPack['story'] {
  return readStory(data, year).story;
}

/** True when the year has a story that was held back because it names someone. */
export function storyWithheld(data: PortalData, year: YearSel): boolean {
  return readStory(data, year).withheld;
}

/** Everything the page for one year says, from the same functions the individual pages use. */
export function yearPack(data: PortalData, year: YearSel, now: Date): YearPack {
  return {
    year,
    home: homeFacts(data, year, now),
    contributors: contributorsFacts(data, year),
    expenses: expensesFacts(data, year),
    loans: loansFacts(data, year),
    committee: committeeFacts(data, year),
    story: storyFor(data, year),
  };
}
