// ====== The text snapshot: what it says, and what it must never say ======
//
// The snapshot is the one part of this site that is copied by search engines and AI systems that
// keep what they read. So the tests are written around the two ways it can go wrong:
//
//  1. It says a PERSON. Every payload row below carries a name, a father's name, a mobile number
//     and a photo URL, and the assertions look for each of them in the JSON of the facts and in the
//     English and Hindi text, for every page.
//  2. It says something DIFFERENT from the live page. Snapshot and live text are built by the same
//     functions from the same data, so they can only differ in freshness; a test holds that.

import { describe, it, expect } from 'vitest';
import { parsePortalData, type PortalData } from '$lib/api/schema';
import { T } from '$lib/i18n';
import { computeFinancials } from '$lib/api/derive';
import {
  PAGE_KEYS, MIN_VILLAGE_CONTRIBUTORS, defaultYear, decadeFacts, expensesFacts, loansFacts,
  committeeFacts, contributorsFacts, homeFacts, factsForPage, type PageKey,
} from './facts';
import { accountsText, modelToMarkdown } from './text';
import { buildNameGuard } from './redact';
import { istDate, istYear, formatIstDate } from './ist';

const NOW = new Date('2026-10-14T06:00:00Z'); // 11:30 IST on 14 Oct 2026

// ---------------------------------------------------------------------------- the fixture

interface Person { id: string; name: string; nameHi: string; father: string; village: string; villageHi: string; mobile: string; photo: string }

function person(n: number, village: string, villageHi: string): Person {
  const id = `USER${String(n).padStart(4, '0')}`;
  return {
    id,
    name: `Person${n} Surname${n}`,
    nameHi: `व्यक्ति${n} उपनाम${n}`,
    father: `Father${n} Surname${n}`,
    village,
    villageHi,
    mobile: `98765${String(40000 + n)}`,
    photo: `https://files.example/photo-${n}.jpg`,
  };
}

// 7 in Shaharpura, 5 in Gardih (both reach the threshold), 2 in Tiny, 1 with no village.
const PEOPLE: Person[] = [
  ...Array.from({ length: 7 }, (_, i) => person(i + 1, 'Shaharpura', 'शहरपुरा')),
  ...Array.from({ length: 5 }, (_, i) => person(i + 8, 'Gardih', 'गरदीह')),
  ...Array.from({ length: 2 }, (_, i) => person(i + 13, 'Tinyvillage', 'छोटागाँव')),
  person(15, '', ''),
];

function makeData(): PortalData {
  const users = PEOPLE.map((p) => ({
    ID: p.id, Name: p.name, 'Name (Hindi)': p.nameHi, Village: p.village, 'Village (Hindi)': p.villageHi,
    Designation: 'Member', "Father's Name": p.father, "Father's Name (Hindi)": p.father, Mobile: p.mobile, Photo: p.photo,
  }));
  // Real collection rows link to a user through `Name`, which holds the user's ID.
  const col = (id: string, year: number, amount: number, type = '1') =>
    ({ Name: id, Year: year, Amount: amount, 'Contribution Type': type, Detail: '', 'Is Resell': 'FALSE' });
  const collections = [
    ...PEOPLE.map((p, i) => col(p.id, 2025, 100 * (i + 1))),   // all 15 gave money in 2025
    col(PEOPLE[0].id, 2025, 50),                                // one of them gave twice
    col(PEOPLE[1].id, 2025, 0, '2'),                            // and one also gave materials
    { Name: PEOPLE[2].id, Year: 2025, Amount: 999, 'Contribution Type': '1', Detail: 'old tent', 'Is Resell': 'TRUE' },
    col(PEOPLE[0].id, 2024, 500), col(PEOPLE[1].id, 2024, 700),
  ];
  const expenses = [
    { Year: 2025, Discription: 'DJ & Lighting', 'Discription (Hindi)': 'डीजे और लाइटिंग', Amount: 24000 },
    { Year: 2025, Discription: 'Banner', 'Discription (Hindi)': 'बैनर', Amount: 8670 },
    { Year: 2025, Discription: 'Prasad', 'Discription (Hindi)': 'प्रसाद', Amount: 500 },
    { Year: 2025, Discription: `Paid to ${PEOPLE[3].name} for tent`, 'Discription (Hindi)': 'तम्बू', Amount: 3000 },
    { Year: 2025, Discription: 'Sound, call 9876543210', 'Discription (Hindi)': 'साउंड', Amount: 1200 },
    { Year: 2025, Discription: 'Mail receipts to a@b.example', 'Discription (Hindi)': 'रसीद', Amount: 100 },
    { Year: 2025, Discription: 'x'.repeat(80), 'Discription (Hindi)': '', Amount: 77 },
    { Year: 2024, Discription: 'Diesel', 'Discription (Hindi)': 'डीजल', Amount: 2000 },
  ];
  const loans = [
    { Year: 2025, Name: PEOPLE[4].id, Amount: 9970.8, 'Intrest Rate': 2.1, Tenure: 11, Status: 'Active', 'Loan ID': 'L25' },
    { Year: 2025, Name: PEOPLE[5].id, Amount: 5000, 'Intrest Rate': 2.6, Tenure: 10, Status: 'Repaid', 'Loan ID': 'L25b' },
    { Year: 2024, Name: PEOPLE[6].id, Amount: 10000, 'Intrest Rate': 2, Tenure: 10, Status: 'Repaid', 'Loan ID': 'L24' },
  ];
  const committee = [
    { ID: PEOPLE[0].id, Name: PEOPLE[0].id, Year: 2025, 'View Role': 'President', 'View Role (Hindi)': 'अध्यक्ष' },
    { ID: PEOPLE[1].id, Name: PEOPLE[1].id, Year: 2025, 'View Role': 'Secretary', 'View Role (Hindi)': 'सचिव' },
    { ID: PEOPLE[2].id, Name: PEOPLE[2].id, Year: 2025, 'View Role': 'Member', 'View Role (Hindi)': 'सदस्य' },
    { ID: PEOPLE[3].id, Name: PEOPLE[3].id, Year: 2025, 'View Role': 'member', 'View Role (Hindi)': 'सदस्य' },
  ];
  const guarantors = [{ Year: 2025, Loaner: PEOPLE[4].id, Guarantor: PEOPLE[7].id, 'Loan ID': 'L25' }];
  const parsed = parsePortalData({ users, collections, expenses, loans, committee, guarantors });
  if (!parsed) throw new Error('fixture failed to parse');
  return parsed;
}

const DATA = makeData();

/** Every string that would identify a person if it reached the page. */
const PERSONAL: string[] = PEOPLE.flatMap((p) => [p.name, p.nameHi, p.father, p.mobile, p.photo]);

// --------------------------------------------------------------------- 1. nothing personal

describe('the snapshot never names a person', () => {
  const facts = PAGE_KEYS.map((k) => factsForPage(k, DATA, 2025, NOW));

  it('the fixture really is full of people (guards against a vacuous pass)', () => {
    expect(PERSONAL.length).toBeGreaterThan(50);
    expect(DATA.users.length).toBe(15);
  });

  it('no name, father’s name, mobile number or photo URL is in any page’s facts', () => {
    const json = JSON.stringify(facts);
    for (const s of PERSONAL) expect(json, `"${s}" reached the facts`).not.toContain(s);
  });

  it('nor is a user ID, which is a key to a person’s record', () => {
    const json = JSON.stringify(facts);
    for (const p of PEOPLE) expect(json, p.id).not.toContain(p.id);
  });

  it('nor is any of it in the English or Hindi text, or in the Markdown', () => {
    for (const page of PAGE_KEYS) {
      for (const lang of ['en', 'hi'] as const) {
        const model = accountsText(factsForPage(page, DATA, 2025, NOW), lang, { kind: 'snapshot', asOf: '2026-10-14' });
        const flat = JSON.stringify(model) + modelToMarkdown(model, 'https://x.example', lang);
        for (const s of PERSONAL) expect(flat, `${page}/${lang}: "${s}"`).not.toContain(s);
      }
    }
  });

  it('no individual’s contribution amount is published either', () => {
    // 15 people gave 100, 200 … 1500 (and one 50 on top). A figure like that, with the person
    // removed, is still a fact about someone the village can identify.
    const json = JSON.stringify(contributorsFacts(DATA, 2025));
    expect(Object.keys(contributorsFacts(DATA, 2025)).sort()).toEqual([
      'average', 'collected', 'contributors', 'kind', 'materialGivers', 'moneyGivers',
      'otherVillages', 'serviceGivers', 'villages', 'year',
    ]);
    for (const amount of ['1500', '1400', '1300']) expect(json).not.toContain(`:${amount}`);
  });

  it('survives a JSON round trip unchanged (the facts travel to the browser as JSON)', () => {
    for (const f of facts) expect(JSON.parse(JSON.stringify(f))).toEqual(f);
  });
});

// ------------------------------------------------------------------------ 2. villages

describe('villages are named only when enough people give from them', () => {
  const f = contributorsFacts(DATA, 2025);

  it('lists a village at the threshold and not one below it', () => {
    expect(MIN_VILLAGE_CONTRIBUTORS).toBe(5);
    expect(f.villages.map((v) => [v.name.en, v.count])).toEqual([['Shaharpura', 7], ['Gardih', 5]]);
    expect(JSON.stringify(f)).not.toContain('Tinyvillage');
    expect(JSON.stringify(f)).not.toContain('छोटागाँव');
  });

  it('puts everyone else — small villages and no village — under Other, so the counts add up', () => {
    expect(f.otherVillages).toBe(3);
    expect(f.villages.reduce((s, v) => s + v.count, 0) + f.otherVillages).toBe(f.contributors);
  });

  it('carries the Hindi name beside the English one', () => {
    expect(f.villages[0].name).toEqual({ en: 'Shaharpura', hi: 'शहरपुरा' });
  });

  it('omits the table altogether when no village is large enough', () => {
    const small = contributorsFacts(DATA, 2024);
    expect(small.villages).toEqual([]);
    const text = accountsText(small, 'en', { kind: 'live' });
    expect(JSON.stringify(text)).not.toContain('Other villages');
  });
});

// -------------------------------------------------------------------------- 3. expenses

describe('expense lines are published as written, unless they name someone', () => {
  const f = expensesFacts(DATA, 2025);

  it('keeps ordinary lines, largest first', () => {
    expect(f.items.map((i) => [i.label.en, i.amount])).toEqual([
      ['DJ & Lighting', 24000], ['Banner', 8670], ['Prasad', 500],
    ]);
    expect(f.items[0].label.hi).toBe('डीजे और लाइटिंग');
  });

  it('keeps "Prasad": an offering is not a person, whoever else is called that', () => {
    const guard = buildNameGuard([{ Name: 'Ram Prasad Gupta' }]);
    expect(guard.mentionsPersonOrContact('Prasad')).toBe(false);
  });

  it('holds back a line naming a known person, a phone number, an email, or running to prose', () => {
    expect(f.folded.count).toBe(4);
    const published = JSON.stringify(f.items);
    for (const s of [PEOPLE[3].name, '9876543210', 'a@b.example', 'xxxxxxxxxx']) expect(published).not.toContain(s);
  });

  it('never loses money: held-back lines are still in the totals', () => {
    expect(f.folded.total).toBe(3000 + 1200 + 100 + 77);
    const lines = f.items.reduce((s, i) => s + i.amount, 0);
    expect(lines + f.folded.total).toBe(f.total);
    expect(f.total).toBe(24000 + 8670 + 500 + 3000 + 1200 + 100 + 77);
    expect(f.count).toBe(7);
  });

  it('says so in the text, with the amount', () => {
    const text = JSON.stringify(accountsText(f, 'en', { kind: 'live' }));
    expect(text).toContain('Other items (4)');
  });

  it('the guard catches a name by its full form and by a distinctive word, in either script', () => {
    const guard = buildNameGuard(DATA.users);
    expect(guard.mentionsPersonOrContact(`Tent from ${PEOPLE[0].name}`)).toBe(true);
    expect(guard.mentionsPersonOrContact('Surname3 ji')).toBe(true);
    expect(guard.mentionsPersonOrContact('उपनाम9 को भुगतान')).toBe(true);
    expect(guard.mentionsPersonOrContact('Tent, banner and lights')).toBe(false);
    expect(guard.mentionsPersonOrContact('')).toBe(false);
  });
});

// ---------------------------------------------------------------- 4. the figures are right

describe('the figures are the portal’s own', () => {
  it('home carries computeFinancials’ numbers, to the rupee', () => {
    const fin = computeFinancials(DATA, 2025);
    const h = homeFacts(DATA, 2025, NOW);
    expect(h.collected).toBe(fin.collection);
    expect(h.contributed).toBe(12050);
    expect(h.budget).toBe(fin.totalBudget);
    expect(h.expenses).toBe(fin.totalExpense);
    expect(h.available).toBe(fin.available);
    expect(h.loanGiven).toBe(fin.loanGiven);
    // The 2024 loan is Repaid, so it flows into 2025's budget: 10000 + 10000*2%*10 = 12000.
    expect(h.pastLoanReturned).toBe(12000);
    expect(h.budget).toBe(h.collected + 12000);
  });

  it('counts contributors the way the page does: resold items are not contributors', () => {
    const h = homeFacts(DATA, 2025, NOW);
    expect(h.contributors).toBe(15);
    expect(h.moneyGivers).toBe(15);
    // 100 + 200 + … + 1500 = 12,000; one person's second gift adds 50; the materials row is no money.
    expect(h.contributed).toBe(12050);
    // The budget's "Collected (incl. resold items)" adds the 999 the committee got for the old tent.
    expect(h.collected).toBe(12050 + 999);
    expect(h.average).toBe(Math.round(12050 / 15));
  });

  it('loans: counts, statuses, and the span of rates and tenures', () => {
    const l = loansFacts(DATA, 2025);
    expect(l.count).toBe(2);
    expect([l.active, l.repaid]).toEqual([1, 1]);
    expect(l.principal).toBeCloseTo(9970.8 + 5000, 6);
    expect(l.rate).toEqual({ min: 2.1, max: 2.6 });
    expect(l.tenure).toEqual({ min: 10, max: 11 });
    expect(l.repayable).toBeCloseTo(l.principal + l.interest, 6);
  });

  it('committee: roles are grouped without regard to case, in the order the ledger lists them', () => {
    const c = committeeFacts(DATA, 2025);
    expect(c.count).toBe(4);
    expect(c.roles.map((r) => [r.role.en, r.count])).toEqual([['President', 1], ['Secretary', 1], ['Member', 2]]);
    expect(c.roles[0].role.hi).toBe('अध्यक्ष');
  });

  it('contributors: kinds are counted by person', () => {
    const c = contributorsFacts(DATA, 2025);
    expect([c.contributors, c.moneyGivers, c.materialGivers, c.serviceGivers]).toEqual([15, 15, 1, 0]);
  });

  it('decade: runs from 2017 to the current year, with this year marked open', () => {
    const d = decadeFacts(DATA, NOW);
    expect([d.startYear, d.endYear]).toEqual([2017, 2026]);
    expect(d.years).toHaveLength(10);
    const y2026 = d.years.at(-1)!;
    expect(y2026).toMatchObject({ year: 2026, isCurrent: true, hasRecords: false, contributors: 0, total: 0 });
    expect(d.years.find((y) => y.year === 2025)).toMatchObject({ contributors: 15, hasRecords: true });
    expect(d.recordedYears, '2024 and 2025 have records; 2026 is open and has none').toBe(2);
    expect(d.grandContributors).toBe(d.years.reduce((s, y) => s + y.contributors, 0));
    expect(d.grandTotal).toBe(d.years.reduce((s, y) => s + y.total, 0));
  });
});

// ------------------------------------------------------------------------ 5. which year

describe('which year is shown before a visitor picks one', () => {
  it('is this year in India when the data has it, else the newest year with data', () => {
    expect(defaultYear(DATA, NOW)).toBe(2025);                              // no 2026 data yet
    const withNow = parsePortalData({ ...DATA, collections: [...DATA.collections, { Name: 'USER0001', Year: 2026, Amount: 1 }] })!;
    expect(defaultYear(withNow, NOW)).toBe(2026);
  });

  it('IST decides the year: 19:00 UTC on 31 December is already 1 January in India', () => {
    const late = new Date('2026-12-31T19:00:00Z');
    expect(istDate(late)).toBe('2027-01-01');
    expect(istYear(late)).toBe(2027);
    expect(istYear(new Date('2026-12-31T18:29:00Z'))).toBe(2026);
    expect(decadeFacts(DATA, late).endYear, 'the decade reaches the new year too').toBe(2027);
  });

  it('prints dates in both languages without moving them a day', () => {
    expect(formatIstDate('2026-10-14', 'en')).toBe('14 Oct 2026');
    expect(formatIstDate('2026-10-14', 'hi')).toMatch(/^14 .+ 2026$/u);
    expect(formatIstDate('not a date', 'en')).toBe('not a date');
  });
});

// ------------------------------------------------------------------------- 6. the text

describe('the text', () => {
  const accKeys = (lang: 'en' | 'hi') => Object.keys(T[lang]).filter((k) => k.startsWith('acc_')).sort();

  it('has every sentence in both languages', () => {
    expect(accKeys('en').length).toBeGreaterThan(30);
    expect(accKeys('hi')).toEqual(accKeys('en'));
  });

  it('leaves no placeholder unfilled, on any page, in either language, empty or full', () => {
    const sparse = parsePortalData({ users: [], collections: [{ Name: 'x', Year: 2030, Amount: 1 }] })!;
    const blank = parsePortalData({})!;
    for (const data of [DATA, sparse, blank]) {
      for (const page of PAGE_KEYS) {
        for (const lang of ['en', 'hi'] as const) {
          const m = accountsText(factsForPage(page, data, defaultYear(data, NOW), NOW), lang, { kind: 'snapshot', asOf: '2026-10-14' });
          const flat = [m.heading, m.note, ...m.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : [b.title ?? '', ...b.items]))].join('\n');
          expect(flat, `${page}/${lang}`).not.toMatch(/\{[a-zA-Z]+\}/);
          expect(flat, `${page}/${lang}`).not.toMatch(/undefined|NaN|Infinity/);
        }
      }
    }
  });

  it('home reads as sentences with the real numbers', () => {
    const m = accountsText(homeFacts(DATA, 2025, NOW), 'en', { kind: 'snapshot', asOf: '2026-10-14' });
    const text = m.blocks.map((b) => (b.kind === 'p' ? b.text : '')).join(' ');
    expect(text).toContain('In 2025, 15 people contributed, all of them with money: ₹12,050 in total, an average of ₹803 each.');
    expect(text).toContain('Including resold items and other receipts, the total collected is ₹13,049.');
    expect(text).toContain('Expenses so far:');
    expect(text).toMatch(/Past loans returned into this year’s fund came to ₹12,000/);
    expect(m.note).toBe('Figures for 2025, as of 14 Oct 2026 (IST), from the committee’s ledger. Live figures replace these as soon as they load.');
  });

  it('does not say "all of them" when someone gave only materials or service', () => {
    const mixed = parsePortalData({
      ...DATA,
      users: [...DATA.users, { ID: 'USER0099', Name: 'Extra Person', Village: 'Shaharpura' }],
      collections: [...DATA.collections, { Name: 'USER0099', Year: 2025, Amount: 0, 'Contribution Type': '3', 'Is Resell': 'FALSE' }],
    })!;
    const h = homeFacts(mixed, 2025, NOW);
    expect([h.contributors, h.moneyGivers]).toEqual([16, 15]);
    const home = accountsText(h, 'en', { kind: 'live' }).blocks.map((b) => (b.kind === 'p' ? b.text : '')).join(' ');
    expect(home).toContain('In 2025, 16 people contributed. 15 people gave money: ₹12,050 in total');
    expect(home).not.toContain('all of them');
    const con = JSON.stringify(accountsText(contributorsFacts(mixed, 2025), 'en', { kind: 'live' }).blocks);
    expect(con).toContain('Of these, 15 gave money');
    expect(JSON.stringify(accountsText(contributorsFacts(DATA, 2025), 'en', { kind: 'live' }).blocks)).toContain('All of them gave money');
  });

  it('a file note does not talk about "live figures replacing" anything', () => {
    const f = homeFacts(DATA, 2025, NOW);
    const note = accountsText(f, 'en', { kind: 'file', asOf: '2026-10-14' }).note;
    expect(note).toBe('Figures for 2025, as of 14 Oct 2026 (IST), from the committee’s ledger.');
    expect(accountsText(f, 'en', { kind: 'saved', asOf: '2026-10-10' }).note).toContain('Saved figures for 2025, last updated 10 Oct 2026');
  });

  it('says so when the ledger has spent more than the budget, instead of "100% used" and a minus sign', () => {
    const over = parsePortalData({
      users: [], collections: [{ Name: 'a', Year: 2025, Amount: 1000 }],
      expenses: [{ Year: 2025, Discription: 'Stage', Amount: 1500 }],
    })!;
    const h = homeFacts(over, 2025, NOW);
    expect(h.utilizedPct).toBeCloseTo(150, 6);
    const text = accountsText(h, 'en', { kind: 'live' }).blocks.map((b) => (b.kind === 'p' ? b.text : '')).join(' ');
    expect(text).toContain('Expenses so far: ₹1,500 in 1 entry, which is 150.0% of the budget.');
    expect(text).toContain('Expenses and loans together exceed the budget by ₹500.');
    expect(text).not.toContain('Still available');
    expect(text).not.toMatch(/-₹/);
  });

  it('with expenses but no budget at all, it gives the amount and skips the percentage', () => {
    const none = parsePortalData({ users: [], expenses: [{ Year: 2025, Discription: 'Stage', Amount: 1500 }], collections: [{ Name: 'a', Year: 2020, Amount: 1 }] })!;
    const text = accountsText(homeFacts(none, 2025, NOW), 'en', { kind: 'live' }).blocks.map((b) => (b.kind === 'p' ? b.text : '')).join(' ');
    expect(text).toContain('Expenses so far: ₹1,500 in 1 entry.');
    expect(text).not.toMatch(/%/);
  });

  it('says plainly when there is nothing yet, instead of printing zeros as if they were results', () => {
    const none = parsePortalData({ users: [], collections: [{ Name: 'x', Year: 2020, Amount: 1 }] })!;
    const text = (page: PageKey) =>
      JSON.stringify(accountsText(factsForPage(page, none, 2026, NOW), 'en', { kind: 'live' }).blocks);
    expect(text('committee')).toContain('No committee has been published for 2026 yet.');
    expect(text('expenses')).toContain('No expenses have been recorded for 2026 yet.');
    expect(text('loans')).toContain('No loan was given in 2026.');
    expect(text('contributors')).toContain('No contributions have been recorded for 2026 yet.');
    expect(text('home')).toContain('No contributions have been recorded for 2026 yet.');
  });

  it('loans quote one rate when they agree and a range when they do not', () => {
    const one = accountsText(loansFacts(parsePortalData({ ...DATA, loans: [DATA.loans[0]] })!, 2025), 'en', { kind: 'live' });
    expect(JSON.stringify(one)).toContain('2.1% per month');
    expect(JSON.stringify(one)).toContain('for 11 months');
    const two = accountsText(loansFacts(DATA, 2025), 'en', { kind: 'live' });
    expect(JSON.stringify(two)).toContain('2.1% to 2.6% per month');
    expect(JSON.stringify(two)).toContain('for 10 to 11 months');
  });

  it('the loans text points at the loan rules', () => {
    const m = accountsText(loansFacts(DATA, 2025), 'en', { kind: 'live' });
    expect(m.seeAlso).toEqual({ href: '/loan-rules', label: 'Loan rules and process' });
    expect(modelToMarkdown(m, 'https://chhath.shaharpura.com/', 'en')).toContain('[Loan rules and process](https://chhath.shaharpura.com/loan-rules)');
  });

  it('Hindi uses the Hindi labels', () => {
    const m = accountsText(committeeFacts(DATA, 2025), 'hi', { kind: 'live' });
    const flat = JSON.stringify(m);
    expect(flat).toContain('अध्यक्ष: 1');
    expect(flat).not.toContain('President');
    const e = JSON.stringify(accountsText(expensesFacts(DATA, 2025), 'hi', { kind: 'live' }));
    expect(e).toContain('डीजे और लाइटिंग');
  });
});

describe('counted nouns agree with their number, in both languages', () => {
  const one = parsePortalData({
    users: [{ ID: 'U1', Name: 'A B', Village: 'V' }],
    collections: [{ Name: 'U1', Year: 2025, Amount: 100 }],
    expenses: [{ Year: 2025, Discription: 'Banner', Amount: 50 }],
    committee: [{ ID: 'U1', Name: 'U1', Year: 2025, 'View Role': 'President', 'View Role (Hindi)': 'अध्यक्ष' }],
  })!;
  const flat = (page: PageKey, lang: 'en' | 'hi') =>
    JSON.stringify(accountsText(factsForPage(page, one, 2025, NOW), lang, { kind: 'live' }).blocks);

  it('says "1 person" and "1 entry", never "1 people" or "1 entries"', () => {
    const all = (['home', 'expenses', 'committee', 'contributors', 'decade'] as PageKey[]).map((k) => flat(k, 'en')).join(' ');
    expect(all).toContain('1 person contributed');
    expect(all).toContain('1 person contributed, all of them with money');
    expect(all).toContain('1 entry');
    expect(all).toContain('has 1 member');
    expect(all).toContain('from 1 contributor');
    expect(all).not.toMatch(/\b1 (people|entries|members|contributors|years|contributor entries)\b/);
  });

  it('and the Hindi has its own singular', () => {
    expect(flat('home', 'hi')).toContain('1 व्यक्ति ने योगदान दिया');
    expect(flat('home', 'hi')).toContain('1 प्रविष्टि');
    expect(flat('committee', 'hi')).toContain('1 सदस्य');
  });

  it('the plural is the default for every other number, zero included', () => {
    const zero = JSON.stringify(accountsText(factsForPage('committee', parsePortalData({})!, 2025, NOW), 'en', { kind: 'live' }));
    expect(zero).not.toContain('1 member');
    expect(JSON.stringify(accountsText(homeFacts(DATA, 2025, NOW), 'en', { kind: 'live' }))).toContain('15 people');
  });

  it('every _one phrase has a plural twin, in both languages', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const key of Object.keys(T[lang]).filter((k) => /^acc_n_.+_one$/.test(k))) {
        expect(T[lang][key.replace(/_one$/, '')], `${lang}: ${key} has no plural`).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------- 7. snapshot and live are the same thing

describe('a snapshot and the live text cannot disagree', () => {
  it('built twice from the same data, they are identical', () => {
    for (const page of PAGE_KEYS) {
      expect(factsForPage(page, DATA, 2025, NOW)).toEqual(factsForPage(page, DATA, 2025, NOW));
    }
  });

  it('data that has been through JSON (the build payload) gives the same facts as the original', () => {
    const viaJson = parsePortalData(JSON.parse(JSON.stringify(DATA)))!;
    for (const page of PAGE_KEYS) {
      expect(factsForPage(page, viaJson, 2025, NOW)).toEqual(factsForPage(page, DATA, 2025, NOW));
    }
  });

  it('the only difference between the two modes is the note', () => {
    const f = factsForPage('home', DATA, 2025, NOW);
    const snap = accountsText(f, 'en', { kind: 'snapshot', asOf: '2026-10-14' });
    const live = accountsText(f, 'en', { kind: 'live' });
    expect(snap.blocks).toEqual(live.blocks);
    expect(snap.note).not.toBe(live.note);
  });
});
