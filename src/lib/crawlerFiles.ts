// ======= The plain-text files that crawlers and AI agents fetch by NAME =======
//
// `llms.txt` (a map of the site written for language models) and `/.well-known/security.txt`
// (where to report a problem, RFC 9116). Both are produced by prerendered endpoints at build
// time, from the same route table the sitemap and the canonical tags use, so a page added to
// `ROUTES` appears in all four without anyone remembering to edit a text file by hand — the way
// the hand-written sitemap drifted to 8 of the 12 routes before PR-42.
//
// The builders are pure functions of (siteUrl[, now]) so they can be tested without a build.

import { t, type Lang } from './i18n';
import { CONTACT_EMAIL } from './contact';
import { localePath } from './lang/url';
import { canonicalFor, indexableRoutes, metaFor, yearTitle, type RouteMeta } from './seo';
import { PAGE_KEYS, type PageKey, type Snapshot } from './snapshot/facts';
import { accountsText, modelToMarkdown, yearModelToMarkdown, yearText } from './snapshot/text';
import { formatIstDate } from './snapshot/ist';

/** Pages that are reference material rather than the portal's content; llms.txt lists them last. */
const SECONDARY_PATHS = new Set(['/privacy', '/terms']);

function line(r: RouteMeta, siteUrl: string): string {
  // The home page has no title of its own ('Chhath Puja'); "Home" is what a reader expects.
  const name = r.path === '' ? t('en', 'nav_home') : t('en', r.titleKey);
  return `- [${name}](${canonicalFor(siteUrl, r.path)}): ${r.description}`;
}

/**
 * llms.txt, in the shape proposed at https://llmstxt.org: an H1 with the site name, a blockquote
 * summary, then H2 sections of annotated links, the last being "Optional".
 *
 * It says only what is true of the pages as they are served. The figures on a page are loaded by
 * the browser from the committee’s public API, so they are not in the page’s own markup; what IS
 * in the markup is the accounts written out in words (lib/snapshot), and `llms-full.txt` is the
 * same text for every page in one file. It is linked only when a snapshot exists, so the link
 * never leads to a file that says there is nothing.
 *
 * `years` are the festival years that have a page of their own (/2025). Hindi is described in a
 * short section instead of being listed page by page: every page exists at the same address with
 * /hi in front, and listing them all again would only double the length of a file meant to be short.
 */
export function llmsTxt(siteUrl: string, opts: { fullTextAsOf?: string; years?: readonly number[] } = {}): string {
  const base = siteUrl.replace(/\/+$/, '');
  const routes = indexableRoutes();
  const main = routes.filter((r) => !SECONDARY_PATHS.has(r.path));
  const secondary = routes.filter((r) => SECONDARY_PATHS.has(r.path));
  const years = [...(opts.years ?? [])].sort((a, b) => b - a);
  const home = metaFor('')!;

  return [
    '# Chhath Puja Transparency Portal',
    '',
    '> Navyuvak Chhath Puja Samiti, a village Chhath Puja committee at Shaharpura, Gardih (Jharkhand, India), publishes its contributions, expenses, loans and committee roles on this read-only portal so that anyone can check where the money went. Pages are available in English and Hindi.',
    '',
    '- Organisation: Navyuvak Chhath Puja Samiti, established 2017',
    `- Contact for corrections and questions: ${CONTACT_EMAIL}`,
    '- The figures on each page are loaded live from the committee\u2019s public API when the page opens, and change as money is received and spent.',
    '- Every page is public and read-only. Nothing on the portal can be edited by a visitor.',
    '',
    '## Pages',
    '',
    ...(opts.fullTextAsOf
      ? [`- [The accounts in plain text](${base}/llms-full.txt): every figure on the portal written out as sentences, with no personal names, as of ${formatIstDate(opts.fullTextAsOf, 'en')} (IST)`]
      : []),
    ...main.map((r) => line(r, base)),
    '',
    ...(years.length > 0
      ? [
          '## Years',
          '',
          'One page for each festival year, with that year\u2019s contributions, expenses, loans and committee roles.',
          '',
          ...years.map((y) => `- [${yearTitle(y, 'en')}](${canonicalFor(base, `/${y}`)})`),
          '',
        ]
      : []),
    '## Hindi',
    '',
    'Every page above, and each year, also exists in Hindi at the same address with /hi in front of it.',
    '',
    `- [Home, in Hindi](${canonicalFor(base, localePath('/', 'hi'))}): ${home.descriptionHi}`,
    ...(opts.fullTextAsOf
      ? [`- [The accounts in plain text, in Hindi](${canonicalFor(base, '/hi/llms-full.txt')}): the same text in Hindi, as of ${formatIstDate(opts.fullTextAsOf, 'en')} (IST)`]
      : []),
    '',
    '## Optional',
    '',
    ...secondary.map((r) => line(r, base)),
    `- [Sitemap](${base}/sitemap.xml): every public page, in both languages, for crawlers`,
    '',
  ].join('\n');
}

/** The route each section of text belongs to. The ORDER in llms-full.txt is the route table's. */
const FULL_TEXT_ROUTE: Record<PageKey, string> = {
  home: '',
  contributors: '/contributors',
  expenses: '/expenses',
  loans: '/loans',
  committee: '/committee',
  decade: '/decade',
};

/**
 * llms-full.txt: the accounts, written out, for every data page and every year in one file.
 *
 * Each section is the very model the page renders (lib/snapshot/text.ts), turned into Markdown, so
 * this file and the HTML cannot say different things. It names no one: see lib/snapshot/facts.ts.
 * When the build had no snapshot, it says so plainly and sends the reader to the pages.
 *
 * `lang` picks the language of the whole file: the English one is served at /llms-full.txt and the
 * Hindi one at /hi/llms-full.txt, each linking the pages of its own language.
 */
export function llmsFullTxt(siteUrl: string, snapshot: Snapshot | null, lang: Lang = 'en'): string {
  const base = siteUrl.replace(/\/+$/, '');
  const T = (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);
  const head = [`# ${T('llms_full_title')}`, ''];

  if (!snapshot) {
    return [...head, `> ${T('llms_full_none')}`, `> ${T('llms_full_none_where', { url: `${base}/llms.txt` })}`, ''].join('\n');
  }

  const pageUrl = (route: string) => canonicalFor(base, localePath(route === '' ? '/' : route, lang));
  const out = [...head, `> ${T('llms_full_intro', { date: formatIstDate(snapshot.asOf, lang) })}`, ''];

  const keyForPath = new Map(PAGE_KEYS.map((k) => [FULL_TEXT_ROUTE[k], k] as const));
  for (const meta of indexableRoutes().filter((r) => r.data)) {
    const key = keyForPath.get(meta.path);
    if (!key) continue;
    const route = meta.path;
    const title = route === '' ? T('nav_home') : T(meta.titleKey);
    const facts = snapshot.pages[key];
    const scope = facts.kind === 'decade' ? `${facts.startYear} → ${facts.endYear}` : String(facts.year);
    out.push(`## ${title} — ${scope}`, '', `${T('llms_full_page')}: ${pageUrl(route)}`, '');
    out.push(modelToMarkdown(accountsText(facts, lang, { kind: 'file', asOf: snapshot.asOf }), base, lang), '');
  }

  // One section for each festival year that has a page of its own (/2025), newest first.
  for (const y of snapshot.years) {
    const pack = snapshot.byYear[y];
    if (!pack) continue;
    const model = yearText(pack, lang, { kind: 'file', asOf: snapshot.asOf });
    out.push(`## ${model.heading}`, '', `${T('llms_full_page')}: ${pageUrl(`/${y}`)}`, '', yearModelToMarkdown(model), '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** RFC 9116 asks for an expiry under a year away so a stale file does not outlive its owner. */
const SECURITY_TXT_VALID_DAYS = 360;

/**
 * security.txt. `Contact` and `Expires` are the two fields the RFC requires.
 *
 * `Expires` is computed from the build time, and the file is regenerated on every build, so the
 * committee's habit of redeploying keeps it from lapsing without anyone editing a date by hand.
 */
export function securityTxt(siteUrl: string, now: Date = new Date()): string {
  const base = siteUrl.replace(/\/+$/, '');
  const expires = new Date(now.getTime() + SECURITY_TXT_VALID_DAYS * 24 * 60 * 60 * 1000);
  return [
    '# How to report a security problem with the Chhath Puja Transparency Portal (RFC 9116).',
    '# Please write to the address below and give us a reasonable time to respond before sharing details.',
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en, hi',
    `Canonical: ${base}/.well-known/security.txt`,
    '',
  ].join('\n');
}
