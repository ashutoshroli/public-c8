// ====== Facts -> sentences ======
//
// Pure: facts + a language in, a small document model out. The Svelte component renders the model
// as HTML; `llms-full.txt` renders the same model as Markdown. Neither writes a sentence of its
// own, so the page, the file and (later) the Hindi pages cannot drift apart in wording.

import { t, type Lang } from '$lib/i18n';
import { fmt } from '$lib/utils/format';
import { localePath } from '$lib/lang/url';
import { formatIstDate } from './ist';
import type {
  CommitteeFacts,
  ContributorsFacts,
  DecadeFacts,
  ExpensesFacts,
  HomeFacts,
  LoansFacts,
  PageFacts,
  YearPack,
} from './facts';
import { MIN_VILLAGE_CONTRIBUTORS } from './facts';

/**
 * Where the figures came from: the build-time snapshot, the data the visitor just loaded, or a
 * saved copy of it (the visitor is offline, or the Worker is serving its last-known-good data —
 * calling that "live" would be the one claim this section must never make falsely).
 */
export type Source =
  | { kind: 'snapshot'; asOf: string }
  | { kind: 'saved'; asOf: string }
  | { kind: 'live' }
  /** The same figures written into llms-full.txt, where "live figures replace these" would mean nothing. */
  | { kind: 'file'; asOf: string };

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; title?: string; items: string[] };

export interface TextModel {
  heading: string;
  /** Which figures these are and how fresh. */
  note: string;
  blocks: Block[];
  /** A single related page, e.g. the loan rules under the loans figures. */
  seeAlso?: { href: string; label: string };
  /** Links to the year pages, on the Home text. Hrefs are in the text's language. */
  years?: { title: string; items: { href: string; label: string }[] };
}

/** 2.1 -> "2.1", 2 -> "2", 2.456 -> "2.46": a rate is never padded with zeros. */
const num = (n: number) => String(Number(n.toFixed(2)));
const pct = (n: number) => `${n.toFixed(1)}%`;

/**
 * A counted noun phrase that agrees with its number: "137 people", "1 person". The phrase comes
 * whole from the dictionary (acc_n_* and acc_n_*_one), so a sentence only ever slots in a ready
 * phrase and never has to inflect — which also keeps Hindi, with its own agreement rules, out of
 * the code.
 */
function noun(lang: Lang, base: string, n: number): string {
  return t(lang, n === 1 ? `${base}_one` : base, { n });
}

const p = (text: string): Block => ({ kind: 'p', text });
const list = (items: string[], title?: string): Block => ({ kind: 'list', title, items });

function scopeOf(facts: PageFacts): string {
  return facts.kind === 'decade' ? `${facts.startYear} → ${facts.endYear}` : String(facts.year);
}

function homeBlocks(f: HomeFacts, lang: Lang, withDecade = true): Block[] {
  const T = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);
  const decade = p(T('acc_home_decade', {
    start: f.decade.startYear,
    entries: noun(lang, 'acc_n_contributor_entries', f.decade.grandContributors),
    years: noun(lang, 'acc_n_years', f.decade.recordedYears),
    grandTotal: fmt(f.decade.grandTotal),
  }));

  const empty =
    f.contributors === 0 && f.collected === 0 && f.expenseCount === 0 && f.loanCount === 0 && f.pastLoanReturned === 0;
  if (empty) return [p(T('acc_home_people_none', { year: f.year })), ...(withDecade ? [decade] : [])];

  return [
    f.contributors === 0
      ? p(T('acc_home_people_none', { year: f.year }))
      : f.moneyGivers === 0
        ? p(T('acc_home_people_nomoney', { year: f.year, people: noun(lang, 'acc_n_people', f.contributors) }))
        : p(T(f.moneyGivers === f.contributors ? 'acc_home_people_allmoney' : 'acc_home_people', {
            year: f.year,
            people: noun(lang, 'acc_n_people', f.contributors),
            moneyPeople: noun(lang, 'acc_n_people', f.moneyGivers),
            contributed: fmt(f.contributed),
            average: fmt(f.average),
          })),
    // The budget starts from everything collected, resold items included. When that differs from
    // what contributors gave, say so, or the next sentence's budget would not add up.
    ...(f.collected !== f.contributed ? [p(T('acc_home_collected', { collected: fmt(f.collected) }))] : []),
    f.pastLoanReturned > 0
      ? p(T('acc_home_budget', { pastLoanReturned: fmt(f.pastLoanReturned), budget: fmt(f.budget) }))
      : p(T('acc_home_budget_none', { budget: fmt(f.budget) })),
    f.expenseCount === 0
      ? p(T('acc_home_spend_none', { year: f.year }))
      : f.budget > 0
        ? p(T('acc_home_spend', {
            expenses: fmt(f.expenses),
            entries: noun(lang, 'acc_n_entries', f.expenseCount),
            utilizedPct: pct(f.utilizedPct),
          }))
        : p(T('acc_home_spend_nobudget', { expenses: fmt(f.expenses), entries: noun(lang, 'acc_n_entries', f.expenseCount) })),
    f.loanCount > 0
      ? p(T('acc_home_loans', { year: f.year, loanCount: f.loanCount, loanGiven: fmt(f.loanGiven) }))
      : p(T('acc_home_loans_none', { year: f.year })),
    f.available >= 0
      ? p(T('acc_home_available', { available: fmt(f.available) }))
      : p(T('acc_home_overspent', { overspent: fmt(-f.available) })),
    // A year page is about one year; the ten-year line belongs to the Home text.
    ...(withDecade ? [decade] : []),
  ];
}

function expensesBlocks(f: ExpensesFacts, lang: Lang): Block[] {
  if (f.count === 0) return [p(t(lang, 'acc_home_spend_none', { year: f.year }))];
  const items = f.items.map((i) => `${lang === 'hi' ? i.label.hi : i.label.en} — ${fmt(i.amount)}`);
  if (f.folded.count > 0) items.push(`${t(lang, 'acc_exp_other', { count: f.folded.count })} — ${fmt(f.folded.total)}`);
  return [
    p(t(lang, 'acc_exp_total', { count: f.count, year: f.year, total: fmt(f.total) })),
    list(items, t(lang, 'acc_exp_items_h')),
  ];
}

function loansBlocks(f: LoansFacts, lang: Lang, namesNote: boolean): Block[] {
  if (f.count === 0) return [p(t(lang, 'acc_home_loans_none', { year: f.year }))];
  const out: Block[] = [
    p(t(lang, 'acc_loans_total', { year: f.year, count: f.count, principal: fmt(f.principal) })),
    p(t(lang, 'acc_loans_status', { active: f.active, repaid: f.repaid })),
  ];
  if (f.rate && f.tenure) {
    const rate = f.rate.min === f.rate.max
      ? `${num(f.rate.min)}%`
      : t(lang, 'acc_range', { min: `${num(f.rate.min)}%`, max: `${num(f.rate.max)}%` });
    const tenure = f.tenure.min === f.tenure.max
      ? t(lang, 'acc_months', { n: num(f.tenure.min) })
      : t(lang, 'acc_months_range', { min: num(f.tenure.min), max: num(f.tenure.max) });
    out.push(p(t(lang, 'acc_loans_terms', { rate, tenure })));
  }
  out.push(p(t(lang, 'acc_loans_repayable', { repayable: fmt(f.repayable) })));
  if (namesNote) out.push(p(t(lang, 'acc_names_note')));
  return out;
}

function committeeBlocks(f: CommitteeFacts, lang: Lang, namesNote: boolean): Block[] {
  if (f.count === 0) return [p(t(lang, 'acc_com_none', { year: f.year }))];
  return [
    p(t(lang, 'acc_com_total', { year: f.year, members: noun(lang, 'acc_n_members', f.count) })),
    list(f.roles.map((r) => `${lang === 'hi' ? r.role.hi : r.role.en}: ${r.count}`), t(lang, 'acc_com_roles_h')),
    ...(namesNote ? [p(t(lang, 'acc_names_note'))] : []),
  ];
}

function contributorsBlocks(f: ContributorsFacts, lang: Lang, namesNote: boolean): Block[] {
  if (f.contributors === 0) return [p(t(lang, 'acc_home_people_none', { year: f.year }))];
  const out: Block[] = [p(t(lang, 'acc_con_total', { year: f.year, people: noun(lang, 'acc_n_people', f.contributors) }))];
  if (f.moneyGivers > 0) {
    out.push(p(t(lang, f.moneyGivers === f.contributors ? 'acc_con_money_all' : 'acc_con_money', {
      moneyGivers: f.moneyGivers,
      collected: fmt(f.collected),
      average: fmt(f.average),
    })));
  }
  out.push(p(t(lang, 'acc_con_kinds', {
    moneyGivers: f.moneyGivers,
    materialGivers: f.materialGivers,
    serviceGivers: f.serviceGivers,
  })));
  if (f.villages.length > 0) {
    const items = f.villages.map((v) => `${lang === 'hi' ? v.name.hi : v.name.en}: ${v.count}`);
    if (f.otherVillages > 0) items.push(`${t(lang, 'acc_con_other_villages')}: ${f.otherVillages}`);
    out.push(list(items, t(lang, 'acc_con_villages_h', { min: MIN_VILLAGE_CONTRIBUTORS })));
  }
  if (namesNote) out.push(p(t(lang, 'acc_names_note')));
  return out;
}

function decadeBlocks(f: DecadeFacts, lang: Lang): Block[] {
  const items = f.years.map((r) => {
    if (r.contributors === 0 && !r.hasRecords) {
      return t(lang, r.isCurrent ? 'acc_dec_open' : 'acc_dec_norecords', { year: r.year });
    }
    return t(lang, 'acc_dec_year', { year: r.year, total: fmt(r.total), contributors: noun(lang, 'acc_n_contributors', r.contributors) });
  });
  return [
    list(items, t(lang, 'acc_dec_h', { start: f.startYear, end: f.endYear })),
    p(t(lang, 'acc_dec_total', { grandTotal: fmt(f.grandTotal), entries: noun(lang, 'acc_n_contributor_entries', f.grandContributors) })),
  ];
}

function noteFor(scope: string, lang: Lang, source: Source): string {
  return source.kind === 'live'
    ? t(lang, 'acc_note_live', { scope })
    : t(lang, `acc_note_${source.kind}`, { scope, date: formatIstDate(source.asOf, lang) });
}

/**
 * The sentences for one page's facts.
 *
 * A year page stitches five of these together, so it asks for two things to be left out: the
 * ten-year line (that belongs to the Home text) and the "names are not repeated" note, which it
 * says once for the whole page instead of under each of three sections.
 */
export function blocksOf(facts: PageFacts, lang: Lang, opts: { decade?: boolean; namesNote?: boolean } = {}): Block[] {
  const namesNote = opts.namesNote !== false;
  switch (facts.kind) {
    case 'home': return homeBlocks(facts, lang, opts.decade !== false);
    case 'expenses': return expensesBlocks(facts, lang);
    case 'loans': return loansBlocks(facts, lang, namesNote);
    case 'committee': return committeeBlocks(facts, lang, namesNote);
    case 'contributors': return contributorsBlocks(facts, lang, namesNote);
    case 'decade': return decadeBlocks(facts, lang);
  }
}

/** The years of the decade that have a contribution on record, newest first. */
function recordedYears(f: DecadeFacts): number[] {
  return f.years.filter((r) => r.hasRecords).map((r) => r.year).sort((a, b) => b - a);
}

/** The written-up accounts for one page, in one language. */
export function accountsText(facts: PageFacts, lang: Lang, source: Source): TextModel {
  const model: TextModel = {
    heading: t(lang, 'acc_title'),
    note: noteFor(scopeOf(facts), lang, source),
    blocks: blocksOf(facts, lang),
  };
  if (facts.kind === 'loans') model.seeAlso = { href: localePath('/loan-rules', lang), label: t(lang, 'loan_rules_subtitle') };
  // Each year has a page of its own; the Home and Decade texts are where a reader (or a crawler)
  // is sent to find them.
  const linked = facts.kind === 'home' ? facts.years : facts.kind === 'decade' ? recordedYears(facts) : [];
  if (linked.length > 0) {
    model.years = {
      title: t(lang, 'acc_by_year_h'),
      items: linked.map((y) => ({ href: localePath(`/${y}`, lang), label: String(y) })),
    };
  }
  return model;
}

// ----------------------------------------------------------------------------- a year page

export interface YearTextModel {
  /** "Chhath Puja 2025" */
  heading: string;
  note: string;
  /** Said once for the whole page: no names are repeated here. */
  footnote: string;
  /** The committee's paragraph about the year, when it has one. */
  story: { title: string; content: string } | null;
  sections: { id: 'overview' | 'contributors' | 'expenses' | 'loans' | 'committee'; title: string; blocks: Block[] }[];
}

/** The page for one year: every section the individual pages have, for that year, in one place. */
export function yearText(pack: YearPack, lang: Lang, source: Source): YearTextModel {
  const pick = (v: { en: string; hi: string }) => (lang === 'hi' ? v.hi : v.en);
  return {
    heading: t(lang, 'year_title', { year: pack.year }),
    note: noteFor(String(pack.year), lang, source),
    footnote: t(lang, 'acc_names_note'),
    story: pack.story ? { title: pick(pack.story.title), content: pick(pack.story.content) } : null,
    // The section titles are the short nav words (Contributors, Expenses, Loans, Committee): on a
    // page about ONE year, "Active Committee" or "Surplus Loan Distribution" would be the wrong size.
    sections: [
      { id: 'overview', title: t(lang, 'year_overview_h'), blocks: blocksOf(pack.home, lang, { decade: false }) },
      { id: 'contributors', title: t(lang, 'summary_contributors'), blocks: blocksOf(pack.contributors, lang, { namesNote: false }) },
      { id: 'expenses', title: t(lang, 'nav_expenses'), blocks: blocksOf(pack.expenses, lang) },
      { id: 'loans', title: t(lang, 'nav_loans'), blocks: blocksOf(pack.loans, lang, { namesNote: false }) },
      { id: 'committee', title: t(lang, 'nav_committee'), blocks: blocksOf(pack.committee, lang, { namesNote: false }) },
    ],
  };
}

/**
 * The same model as Markdown, for llms-full.txt. `siteUrl` makes the see-also link absolute: a
 * file read outside the site has no "current page" to resolve a relative link against.
 */
export function modelToMarkdown(model: TextModel, siteUrl: string, lang: Lang): string {
  const out: string[] = [`_${model.note}_`, ''];
  for (const b of model.blocks) {
    if (b.kind === 'p') out.push(b.text, '');
    else {
      if (b.title) out.push(`**${b.title}**`, '');
      for (const i of b.items) out.push(`- ${i}`);
      out.push('');
    }
  }
  const base = siteUrl.replace(/\/+$/, '');
  if (model.years) {
    out.push(`**${model.years.title}**`, '');
    out.push(model.years.items.map((i) => `[${i.label}](${base}${i.href})`).join(' · '), '');
  }
  if (model.seeAlso) {
    out.push(`${t(lang, 'acc_see_also')}: [${model.seeAlso.label}](${base}${model.seeAlso.href})`, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** A year page as Markdown (for llms-full.txt): an H3 per section, under the caller's H2. */
export function yearModelToMarkdown(model: YearTextModel): string {
  const out: string[] = [`_${model.note}_`, ''];
  if (model.story) out.push(`**${model.story.title}**`, '', model.story.content, '');
  for (const sec of model.sections) {
    out.push(`### ${sec.title}`, '');
    for (const b of sec.blocks) {
      if (b.kind === 'p') out.push(b.text, '');
      else {
        if (b.title) out.push(`**${b.title}**`, '');
        for (const i of b.items) out.push(`- ${i}`);
        out.push('');
      }
    }
  }
  out.push(model.footnote, '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
