// ====== Facts -> sentences ======
//
// Pure: facts + a language in, a small document model out. The Svelte component renders the model
// as HTML; `llms-full.txt` renders the same model as Markdown. Neither writes a sentence of its
// own, so the page, the file and (later) the Hindi pages cannot drift apart in wording.

import { t, type Lang } from '$lib/i18n';
import { fmt } from '$lib/utils/format';
import { formatIstDate } from './ist';
import type {
  CommitteeFacts,
  ContributorsFacts,
  DecadeFacts,
  ExpensesFacts,
  HomeFacts,
  LoansFacts,
  PageFacts,
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

function homeBlocks(f: HomeFacts, lang: Lang): Block[] {
  const T = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);
  const decade = p(T('acc_home_decade', {
    start: f.decade.startYear,
    entries: noun(lang, 'acc_n_contributor_entries', f.decade.grandContributors),
    years: noun(lang, 'acc_n_years', f.decade.recordedYears),
    grandTotal: fmt(f.decade.grandTotal),
  }));

  const empty =
    f.contributors === 0 && f.collected === 0 && f.expenseCount === 0 && f.loanCount === 0 && f.pastLoanReturned === 0;
  if (empty) return [p(T('acc_home_people_none', { year: f.year })), decade];

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
    decade,
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

function loansBlocks(f: LoansFacts, lang: Lang): Block[] {
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
  out.push(p(t(lang, 'acc_names_note')));
  return out;
}

function committeeBlocks(f: CommitteeFacts, lang: Lang): Block[] {
  if (f.count === 0) return [p(t(lang, 'acc_com_none', { year: f.year }))];
  return [
    p(t(lang, 'acc_com_total', { year: f.year, members: noun(lang, 'acc_n_members', f.count) })),
    list(f.roles.map((r) => `${lang === 'hi' ? r.role.hi : r.role.en}: ${r.count}`), t(lang, 'acc_com_roles_h')),
    p(t(lang, 'acc_names_note')),
  ];
}

function contributorsBlocks(f: ContributorsFacts, lang: Lang): Block[] {
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
  out.push(p(t(lang, 'acc_names_note')));
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

/** The written-up accounts for one page, in one language. */
export function accountsText(facts: PageFacts, lang: Lang, source: Source): TextModel {
  const scope = scopeOf(facts);
  const note =
    source.kind === 'live'
      ? t(lang, 'acc_note_live', { scope })
      : t(lang, `acc_note_${source.kind}`, { scope, date: formatIstDate(source.asOf, lang) });

  let blocks: Block[];
  let seeAlso: TextModel['seeAlso'];
  switch (facts.kind) {
    case 'home': blocks = homeBlocks(facts, lang); break;
    case 'expenses': blocks = expensesBlocks(facts, lang); break;
    case 'loans':
      blocks = loansBlocks(facts, lang);
      seeAlso = { href: '/loan-rules', label: t(lang, 'loan_rules_subtitle') };
      break;
    case 'committee': blocks = committeeBlocks(facts, lang); break;
    case 'contributors': blocks = contributorsBlocks(facts, lang); break;
    case 'decade': blocks = decadeBlocks(facts, lang); break;
  }
  return { heading: t(lang, 'acc_title'), note, blocks, seeAlso };
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
  if (model.seeAlso) {
    out.push(`${t(lang, 'acc_see_also')}: [${model.seeAlso.label}](${siteUrl.replace(/\/+$/, '')}${model.seeAlso.href})`, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
