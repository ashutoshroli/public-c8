// ======= The plain-text files that crawlers and AI agents fetch by NAME =======
//
// `llms.txt` (a map of the site written for language models) and `/.well-known/security.txt`
// (where to report a problem, RFC 9116). Both are produced by prerendered endpoints at build
// time, from the same route table the sitemap and the canonical tags use, so a page added to
// `ROUTES` appears in all four without anyone remembering to edit a text file by hand — the way
// the hand-written sitemap drifted to 8 of the 12 routes before PR-42.
//
// The builders are pure functions of (siteUrl[, now]) so they can be tested without a build.

import { t } from './i18n';
import { CONTACT_EMAIL } from './contact';
import { canonicalFor, indexableRoutes, type RouteMeta } from './seo';

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
 * It says only what is true of the pages as they are served. In particular it does not claim the
 * figures are in the page text: they are loaded by the browser from the committee's public API.
 */
export function llmsTxt(siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const routes = indexableRoutes();
  const main = routes.filter((r) => !SECONDARY_PATHS.has(r.path));
  const secondary = routes.filter((r) => SECONDARY_PATHS.has(r.path));

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
    ...main.map((r) => line(r, base)),
    '',
    '## Optional',
    '',
    ...secondary.map((r) => line(r, base)),
    `- [Sitemap](${base}/sitemap.xml): every public page, for crawlers`,
    '',
  ].join('\n');
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
