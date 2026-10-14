// ====== The language is in the address ======
//
//   /expenses       English        /hi/expenses       Hindi
//   /               English        /hi                Hindi
//   /2025           English        /hi/2025           Hindi
//
// Until now the language was a preference kept in the browser (localStorage), so ONE address
// served two languages: whichever a visitor had chosen. A crawler has no such preference, so it
// only ever saw English, and Hindi — the language most of this village reads — was invisible to
// search engines and could not be linked, shared or bookmarked. With the language in the address
// each language page exists on its own, can be prerendered with its own text, and can say so to a
// search engine (hreflang) so that a Hindi query finds the Hindi page.
//
// Files stay at their one address (/robots.txt, /sitemap.xml, /llms.txt …); only PAGES have a
// Hindi twin.

import type { Lang } from '$lib/i18n';

const PREFIX = '/hi';

/** Which language an address is in. */
export function langOfPath(pathname: string): Lang {
  return pathname === PREFIX || pathname.startsWith(`${PREFIX}/`) ? 'hi' : 'en';
}

/** The address with its language prefix taken off: '/hi/expenses' -> '/expenses', '/hi' -> '/'. */
export function stripLang(pathname: string): string {
  if (pathname === PREFIX) return '/';
  if (pathname.startsWith(`${PREFIX}/`)) return pathname.slice(PREFIX.length);
  return pathname;
}

/** A request for a file ('/robots.txt', '/icons/a.png', '/.well-known/…'), not for a page. */
export function isFilePath(pathname: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(pathname) || pathname.startsWith('/.well-known/');
}

/**
 * The address of `path` in `lang`. Keeps a `?query` and a `#hash`, never prefixes a file, and
 * accepts a path that is already prefixed ('/hi/x' in English becomes '/x').
 */
export function localePath(path: string, lang: Lang): string {
  const m = /^([^?#]*)(.*)$/.exec(path)!;
  const base = stripLang(m[1] === '' ? '/' : m[1]);
  const tail = m[2];
  if (isFilePath(base)) return `${base}${tail}`;
  if (lang === 'en') return `${base}${tail}`;
  return `${base === '/' ? PREFIX : `${PREFIX}${base}`}${tail}`;
}

/** The same page in the other language, from the current address. */
export function otherLanguagePath(pathname: string, search = '', hash = ''): { lang: Lang; path: string } {
  const other: Lang = langOfPath(pathname) === 'hi' ? 'en' : 'hi';
  return { lang: other, path: localePath(`${stripLang(pathname)}${search}${hash}`, other) };
}

/** '/2025' -> 2025; anything else -> null. Takes a language-stripped path. */
export function yearOfPath(strippedPath: string): number | null {
  const m = /^\/(20\d{2})\/?$/.exec(strippedPath);
  return m ? Number(m[1]) : null;
}
