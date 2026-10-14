// ============ ONE SOURCE OF TRUTH FOR ROUTE METADATA (audit PR-42) ============
//
// Three things went wrong because there was no such source:
//
//  1. `+layout.svelte` emitted `<link rel="canonical" href={config.siteUrl} />` on EVERY page.
//     A canonical pointing at `/` from `/expenses` tells Google that /expenses is a duplicate
//     of the home page — so it drops it from the index and shows the home page instead. Every
//     inner page of the portal was, in effect, asking not to be found.
//
//  2. The Open Graph tags in app.html are static, so every share of any page previewed as the
//     home page, and there was no `og:url` at all.
//
//  3. `static/sitemap.xml` was hand-maintained and had drifted: 8 of the 12 public routes.
//     /decade, /donate, /guide and /verify were simply absent. A hand-written sitemap next to a
//     routes directory always drifts, so the sitemap is GENERATED from this table now and a test
//     asserts the table covers the routes on disk.
//
// Descriptions are in the language of the ADDRESS. They used to be English only, for a reason that
// no longer holds: both languages were served from one path, so a description that followed the
// visitor's language would have made the indexed text depend on whichever visitor was crawled. The
// language is in the address now (/hi/… is Hindi, see lib/lang/url.ts), every URL has exactly one
// language, and the Hindi page can have a Hindi description, title, canonical and hreflang pair.

import { CONTACT_EMAIL } from './contact';
import { t, type Lang } from './i18n';
import { localePath, stripLang, yearOfPath } from './lang/url';

export interface RouteMeta {
  /** Path, no trailing slash. '' is the home page. */
  path: string;
  /** i18n key for the human title. The home page uses the site name itself. */
  titleKey: string;
  /** Indexable description, English, <= ~155 chars so it is not truncated mid-sentence. */
  description: string;
  /** The same, in Hindi, for the /hi/… page. */
  descriptionHi: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
  /**
   * A utility page that must stay OUT of search results and the sitemap. It is still in this
   * table (so it gets a title, a description and a canonical like every other page) and it is
   * deliberately NOT blocked in robots.txt: a crawler can only obey `noindex` on a page it is
   * allowed to fetch.
   */
  noindex?: boolean;
  /**
   * The page's HTML carries the accounts snapshot (lib/snapshot), which changes with every build.
   * Only these routes get a sitemap `lastmod`: for the rest the build date would be a lie.
   */
  data?: boolean;
}

export const ROUTES: RouteMeta[] = [
  {
    path: '',
    descriptionHi:
      'हर योगदान सबके सामने, हर खर्च का हिसाब। नवयुवक छठ पूजा समिति, शहरपुरा, गरडीह की लाइव वित्तीय पारदर्शिता।',
    data: true,
    titleKey: 'app_title',
    description:
      'Every contribution visible, every expense accountable. Live financial transparency for Navyuvak Chhath Puja Samiti, Shaharpura, Gardih.',
    changefreq: 'daily',
    priority: '1.0',
  },
  {
    path: '/contributors',
    descriptionHi:
      'नवयुवक छठ पूजा समिति के योगदानकर्ताओं की पूरी सूची, राशि और वर्ष के साथ, ठीक वैसी जैसी समिति की बही में दर्ज है।',
    data: true,
    titleKey: 'contributors_list',
    description:
      'The full list of contributors to Navyuvak Chhath Puja Samiti, with amounts and years, exactly as recorded in the committee ledger.',
    changefreq: 'daily',
    priority: '0.8',
  },
  {
    path: '/expenses',
    descriptionHi:
      'नवयुवक छठ पूजा समिति का हर खर्च, हर वर्ष मद-दर-मद, ताकि गाँव का कोई भी व्यक्ति जाँच सके।',
    data: true,
    titleKey: 'expenses_ledger',
    description:
      'Every rupee spent by Navyuvak Chhath Puja Samiti, listed item by item for each year, open for anyone in the village to check.',
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/loans',
    descriptionHi:
      'समिति कोष से दिए गए ऋण: राशि, गारंटर, स्थिति और वापसी, ताकि ऋण देने में जवाबदेही बनी रहे।',
    data: true,
    titleKey: 'loan_distribution',
    description:
      'Loans issued from the committee fund: amount, guarantors, status and repayment, published so lending stays accountable.',
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/committee',
    descriptionHi:
      'इस वर्ष नवयुवक छठ पूजा समिति की ज़िम्मेदारी सँभालने वाले लोग और उनकी भूमिकाएँ।',
    data: true,
    titleKey: 'active_committee',
    description:
      'The people responsible for Navyuvak Chhath Puja Samiti this year, with the role each of them holds.',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    path: '/decade',
    descriptionHi:
      'शहरपुरा में छठ पूजा के दस वर्ष: योगदान, खर्च और भागीदारी, साल-दर-साल।',
    data: true,
    titleKey: 'decade_title',
    description:
      'Ten years of Chhath Puja at Shaharpura: contributions, spending and participation, year by year.',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    path: '/downloads',
    descriptionHi:
      'किसी भी वर्ष की रसीदें, प्रमाण-पत्र और समिति के प्रकाशित विवरण डाउनलोड करें।',
    titleKey: 'download_center',
    description:
      'Download receipts, certificates and the committee’s published statements for any year.',
    changefreq: 'weekly',
    priority: '0.6',
  },
  {
    path: '/donate',
    descriptionHi:
      'नवयुवक छठ पूजा समिति को योगदान कैसे दें: UPI, बैंक ट्रांसफ़र, या समिति के सदस्य को सीधे।',
    titleKey: 'donate_title',
    description:
      'How to contribute to Navyuvak Chhath Puja Samiti — UPI, bank transfer, or in person with the committee.',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    // The page a receipt's QR code opens (`/verify?record=<id>`). Its content depends entirely on
    // the id in the query string, so there is nothing here worth a search result — and a result
    // that landed a stranger on "record not found" would only be noise.
    path: '/verify',
    descriptionHi:
      'किसी रसीद को समिति की बही से मिलाकर जाँचें और पक्का करें कि योगदान दर्ज हुआ है।',
    titleKey: 'verify_title',
    description:
      'Check a receipt against the committee ledger and confirm the contribution was recorded.',
    changefreq: 'monthly',
    priority: '0.5',
    noindex: true,
  },
  {
    path: '/guide',
    descriptionHi:
      'पारदर्शिता पोर्टल का उपयोग कैसे करें: योगदान खोजना, बही पढ़ना और ऐप इंस्टॉल करना।',
    titleKey: 'guide_title',
    description:
      'How to use the transparency portal: finding a contribution, reading the ledgers, and installing the app.',
    changefreq: 'monthly',
    priority: '0.4',
  },
  {
    path: '/loan-rules',
    descriptionHi:
      'समिति बचा हुआ कोष कैसे उधार देती है: बोली, तीन गारंटर, सहमति और वापसी, और हर नियम कब से लागू है।',
    titleKey: 'loan_rules_subtitle',
    description:
      'How the committee lends the leftover fund: bidding, three guarantors, consent and repayment, and since when each loan rule applies.',
    changefreq: 'yearly',
    priority: '0.4',
  },
  {
    path: '/privacy',
    descriptionHi:
      'यह पोर्टल क्या प्रकाशित करता है, क्या सहेजता है, वैकल्पिक एनालिटिक्स कुकीज़ और कोई भी जानकारी कितने समय तक रखी जाती है।',
    titleKey: 'privacy_subtitle',
    description:
      'What this portal publishes, what it stores, its optional analytics cookies, and how long anything is kept.',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/terms',
    descriptionHi:
      'नवयुवक छठ पूजा समिति के पारदर्शिता पोर्टल के उपयोग की शर्तें।',
    titleKey: 'terms_subtitle',
    description:
      'Terms for using the Navyuvak Chhath Puja Samiti transparency portal.',
    changefreq: 'yearly',
    priority: '0.3',
  },
];

/** Normalises a URL pathname to the form used as a key above. */
export function normalisePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '' : p;
}

/** The table entry for an address in either language: '/hi/expenses' finds '/expenses'. */
export function metaFor(pathname: string): RouteMeta | undefined {
  const key = normalisePath(stripLang(normalisePath(pathname)));
  return ROUTES.find((r) => r.path === key);
}

/** A page's description in the language it is written in. */
export function descriptionFor(meta: RouteMeta, lang: Lang): string {
  return lang === 'hi' ? meta.descriptionHi : meta.description;
}

/** The routes that belong in search results, the sitemap and llms.txt. */
export function indexableRoutes(): RouteMeta[] {
  return ROUTES.filter((r) => !r.noindex);
}

/**
 * True only for a known route that has not opted out. An unknown path is never indexable.
 * A year page ('/2025', '/hi/2025') is indexable: it is a real page, listed in the sitemap.
 */
export function isIndexable(pathname: string): boolean {
  if (yearOfPath(normalisePath(stripLang(normalisePath(pathname)))) !== null) return true;
  const meta = metaFor(pathname);
  return !!meta && !meta.noindex;
}

// ------------------------------------------------------------------------ YEAR PAGES

/** The title of a year page, in its language. */
export function yearTitle(year: number, lang: Lang): string {
  return t(lang, 'year_title', { year });
}

/** The description of a year page, in its language. */
export function yearDescription(year: number, lang: Lang): string {
  return t(lang, 'year_description', { year });
}

/**
 * The document title (and share title) of a year page: "Chhath Puja 2025 — Navyuvak Chhath Puja
 * Samiti". The other pages end in the short app title ("… — Chhath Puja"); for a year page that
 * would read "Chhath Puja 2025 — Chhath Puja", so it ends in the committee's name instead, which
 * is also what a searcher looking for this committee types.
 */
export function yearDocumentTitle(year: number, lang: Lang): string {
  return `${yearTitle(year, lang)} — ${t(lang, 'org_name')}`;
}

// ------------------------------------------------------------------ TWO LANGUAGES, ONE PAGE

export interface Alternate {
  hreflang: 'en' | 'hi' | 'x-default';
  href: string;
}

/**
 * The hreflang set for a page: itself in each language plus x-default (English, the address a
 * visitor with no preference gets). Every language version lists ALL of them, itself included —
 * Google ignores a pair that is not reciprocal.
 */
export function alternatesFor(siteUrl: string, strippedPath: string): Alternate[] {
  return [
    { hreflang: 'en', href: canonicalFor(siteUrl, localePath(strippedPath, 'en')) },
    { hreflang: 'hi', href: canonicalFor(siteUrl, localePath(strippedPath, 'hi')) },
    { hreflang: 'x-default', href: canonicalFor(siteUrl, localePath(strippedPath, 'en')) },
  ];
}

// ---------------------------------------------------------------- SOCIAL PREVIEW IMAGE

/**
 * The link-preview card (static/og-image.png, generated by scripts/gen-seo-assets.mjs).
 *
 * 1200x630 is the 1.91:1 shape Facebook, WhatsApp, LinkedIn and X all crop to, so nothing is cut
 * off. It replaces the 1280x720 app-store screenshot, which is 16:9 and therefore got its edges
 * trimmed, and which carried no description of what the page was.
 *
 * `alt` describes the image, so it repeats the words printed on the card.
 */
export const OG_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Navyuvak Chhath Puja Samiti — Chhath Puja Transparency Portal. Every contribution is visible. Every expense is accountable.',
} as const;

export function ogImageUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${OG_IMAGE.path}`;
}

/**
 * The absolute canonical URL for a path (in either language: pass '/hi/expenses' for the Hindi
 * page). Always the SAME shape, so it cannot self-conflict.
 */
export function canonicalFor(siteUrl: string, pathname: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const key = normalisePath(pathname);
  return key === '' ? `${base}/` : `${base}${key}`;
}

export interface SitemapOptions {
  /** The IST date the accounts snapshot was read; the `lastmod` of the pages that carry it. */
  lastmod?: string;
  /** Years that have a page of their own (/2025). Empty or missing: no year pages are listed. */
  years?: readonly number[];
}

/**
 * The sitemap, built from the table above.
 *
 * Every page is listed TWICE, once per language, and each entry carries the full hreflang set
 * (both languages and x-default): that is how Google is told the two URLs are one page in two
 * languages and not duplicates of each other.
 *
 * `noindex` routes are left out: a sitemap is a list of pages you WANT indexed, and offering a
 * page that also says `noindex` is a contradiction Search Console reports as an error.
 *
 * `lastmod` appears only on the pages whose HTML carries the accounts snapshot (`data: true`, and
 * the year pages), and only when there is a snapshot: its date is the day the data was read, which
 * is the day that text was last true. On the other pages a build does not mean the content
 * changed, and a sitemap that claims every page changed at every deploy trains crawlers to ignore
 * the field.
 */
export function sitemapXml(siteUrl: string, opts: SitemapOptions = {}): string {
  const pages = [
    ...indexableRoutes().map((r) => ({
      path: r.path === '' ? '/' : r.path,
      changefreq: r.changefreq,
      priority: r.priority,
      dated: !!r.data,
    })),
    ...(opts.years ?? []).map((y) => ({ path: `/${y}`, changefreq: 'monthly' as const, priority: '0.6', dated: true })),
  ];

  const urls = pages
    .flatMap((pg) =>
      (['en', 'hi'] as const).map((lang) => {
        const loc = canonicalFor(siteUrl, localePath(pg.path, lang));
        const lastmod = pg.dated && opts.lastmod ? `<lastmod>${opts.lastmod}</lastmod>` : '';
        const alternates = alternatesFor(siteUrl, pg.path)
          .map((a) => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
          .join('');
        return `  <url><loc>${loc}</loc>${lastmod}<changefreq>${pg.changefreq}</changefreq><priority>${pg.priority}</priority>${alternates}</url>`;
      }),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

// ------------------------------------------------------------------ STRUCTURED DATA

/** Where the committee is, as the coming-soon page on the main domain already states it. */
const ORG = {
  name: 'Navyuvak Chhath Puja Samiti',
  alternateName: 'Chhath Puja Transparency Portal',
  description:
    'A village welfare committee publishing every contribution, expense and loan for public scrutiny.',
  foundingDate: '2017',
  addressLocality: 'Shaharpura, Gardih',
  addressRegion: 'Jharkhand',
  addressCountry: 'IN',
} as const;

export interface PageLd {
  /** Route path WITHOUT a language prefix, as in ROUTES ('' or '/' is the home page; '/2025'). */
  path: string;
  /** The language this page is written in; the URLs, `inLanguage` and the labels follow it. */
  lang: Lang;
  /** The page's name, the same words as its og:title. */
  name: string;
  /** The page's meta description. */
  description: string;
  /** Breadcrumb label for the home page, and for this page. */
  homeLabel: string;
  pageLabel: string;
}

/**
 * Everything Schema.org should know about one page, as a single `@graph`.
 *
 *   NGO ── publisher of ── WebSite ── contains ── WebPage ── has ── BreadcrumbList
 *
 * The nodes point at each other by `@id` instead of repeating themselves, which is how a search
 * engine learns they describe ONE organisation and ONE site rather than a new pair per page.
 * Before this the layout emitted two unconnected scripts and no node for the page itself.
 *
 * `NGO` rather than `Organization`: it is the more specific type that fits a village welfare
 * committee, and specificity is what lets a search engine render a knowledge panel instead of a
 * bare link.
 *
 * What is NOT here, on purpose:
 *  - Financial figures. They change daily, structured data that disagrees with the page is worse
 *    than none, and there is no honest schema type for "money a committee collected".
 *  - Any person's name. This page is built to be read by machines that keep what they read.
 *  - FAQPage / Event. The guide's headings are not questions and answers, and the festival dates
 *    are not in the public API; claiming either would be inventing markup the page cannot back.
 *  - `sameAs`. There are no verified profiles to point at, and a wrong one is worse than none.
 *
 * Pass `null` for a page that is not in the route table (the 404 page): it then gets the
 * organisation and the site but no WebPage claiming to be something it is not.
 *
 * The page, its breadcrumb and its URLs are in the language of the address; the organisation and
 * site nodes do not vary by language.
 */
export function structuredData(siteUrl: string, page: PageLd | null): string {
  const base = siteUrl.replace(/\/+$/, '');
  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'NGO',
      '@id': orgId,
      name: ORG.name,
      alternateName: ORG.alternateName,
      url: `${base}/`,
      logo: `${base}/icons/icon-512.png`,
      image: ogImageUrl(base),
      description: ORG.description,
      foundingDate: ORG.foundingDate,
      email: CONTACT_EMAIL,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'general enquiries',
        email: CONTACT_EMAIL,
        availableLanguage: ['English', 'Hindi'],
      },
      address: {
        '@type': 'PostalAddress',
        addressLocality: ORG.addressLocality,
        addressRegion: ORG.addressRegion,
        addressCountry: ORG.addressCountry,
      },
    },
    {
      '@type': 'WebSite',
      '@id': siteId,
      name: 'Chhath Puja Transparency Portal',
      url: `${base}/`,
      inLanguage: ['en', 'hi'],
      publisher: { '@id': orgId },
    },
  ];

  if (page) {
    const stripped = page.path === '' ? '/' : page.path;
    const url = canonicalFor(base, localePath(stripped, page.lang));
    const isHome = stripped === '/';
    graph.push({
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: page.name,
      description: page.description,
      inLanguage: page.lang,
      isPartOf: { '@id': siteId },
      about: { '@id': orgId },
      // A one-item trail is not a breadcrumb: the home page has none.
      ...(isHome ? {} : { breadcrumb: { '@id': `${url}#breadcrumb` } }),
    });
    if (!isHome) {
      graph.push({
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: page.homeLabel, item: canonicalFor(base, localePath('/', page.lang)) },
          { '@type': 'ListItem', position: 2, name: page.pageLabel, item: url },
        ],
      });
    }
  }

  // The string goes into the page through {@html}, inside a <script>. JSON.stringify does not
  // escape '<', so a name containing "</script>" would end the block early; \u003c is the same
  // character to a JSON parser and inert to the HTML parser.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}
