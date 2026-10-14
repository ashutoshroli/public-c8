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
// Descriptions are deliberately in English only, unlike the UI. Crawlers index one canonical
// per URL and the portal serves both languages from the same path, so a language-switched
// description would make the indexed text depend on whichever visitor was crawled. The `<title>`
// stays translated because that is what a human reads in a tab.

import { CONTACT_EMAIL } from './contact';

export interface RouteMeta {
  /** Path, no trailing slash. '' is the home page. */
  path: string;
  /** i18n key for the human title. The home page uses the site name itself. */
  titleKey: string;
  /** Indexable description, English, <= ~155 chars so it is not truncated mid-sentence. */
  description: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
  /**
   * A utility page that must stay OUT of search results and the sitemap. It is still in this
   * table (so it gets a title, a description and a canonical like every other page) and it is
   * deliberately NOT blocked in robots.txt: a crawler can only obey `noindex` on a page it is
   * allowed to fetch.
   */
  noindex?: boolean;
}

export const ROUTES: RouteMeta[] = [
  {
    path: '',
    titleKey: 'app_title',
    description:
      'Every contribution visible, every expense accountable. Live financial transparency for Navyuvak Chhath Puja Samiti, Shaharpura, Gardih.',
    changefreq: 'daily',
    priority: '1.0',
  },
  {
    path: '/contributors',
    titleKey: 'contributors_list',
    description:
      'The full list of contributors to Navyuvak Chhath Puja Samiti, with amounts and years, exactly as recorded in the committee ledger.',
    changefreq: 'daily',
    priority: '0.8',
  },
  {
    path: '/expenses',
    titleKey: 'expenses_ledger',
    description:
      'Every rupee spent by Navyuvak Chhath Puja Samiti, itemised by category and year, open for anyone in the village to check.',
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/loans',
    titleKey: 'loan_distribution',
    description:
      'Loans issued from the committee fund: amount, guarantors, status and repayment, published so lending stays accountable.',
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/committee',
    titleKey: 'active_committee',
    description:
      'The people responsible for Navyuvak Chhath Puja Samiti this year, with the role each of them holds.',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    path: '/decade',
    titleKey: 'decade_title',
    description:
      'Ten years of Chhath Puja at Shaharpura: contributions, spending and participation, year by year.',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    path: '/downloads',
    titleKey: 'download_center',
    description:
      'Download receipts, certificates and the committee’s published statements for any year.',
    changefreq: 'weekly',
    priority: '0.6',
  },
  {
    path: '/donate',
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
    titleKey: 'verify_title',
    description:
      'Check a receipt against the committee ledger and confirm the contribution was recorded.',
    changefreq: 'monthly',
    priority: '0.5',
    noindex: true,
  },
  {
    path: '/guide',
    titleKey: 'guide_title',
    description:
      'How to use the transparency portal: finding a contribution, reading the ledgers, and installing the app.',
    changefreq: 'monthly',
    priority: '0.4',
  },
  {
    path: '/loan-rules',
    titleKey: 'loan_rules_subtitle',
    description:
      'How the committee lends the leftover fund: bidding, three guarantors, consent and repayment, and since when each loan rule applies.',
    changefreq: 'yearly',
    priority: '0.4',
  },
  {
    path: '/privacy',
    titleKey: 'privacy_subtitle',
    description:
      'What this portal publishes, what it stores, its optional analytics cookies, and how long anything is kept.',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/terms',
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

export function metaFor(pathname: string): RouteMeta | undefined {
  const key = normalisePath(pathname);
  return ROUTES.find((r) => r.path === key);
}

/** The routes that belong in search results, the sitemap and llms.txt. */
export function indexableRoutes(): RouteMeta[] {
  return ROUTES.filter((r) => !r.noindex);
}

/** True only for a known route that has not opted out. An unknown path is never indexable. */
export function isIndexable(pathname: string): boolean {
  const meta = metaFor(pathname);
  return !!meta && !meta.noindex;
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

/** The absolute canonical URL for a path. Always the SAME shape, so it cannot self-conflict. */
export function canonicalFor(siteUrl: string, pathname: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const key = normalisePath(pathname);
  return key === '' ? `${base}/` : `${base}${key}`;
}

/**
 * The sitemap, built from the table above.
 *
 * `noindex` routes are left out: a sitemap is a list of pages you WANT indexed, and offering a
 * page that also says `noindex` is a contradiction Search Console reports as an error.
 *
 * `lastmod` is deliberately absent rather than faked to the build date: a build does not mean
 * the content changed, and a sitemap that claims every page changed at every deploy trains
 * crawlers to ignore the field.
 */
export function sitemapXml(siteUrl: string): string {
  const urls = indexableRoutes().map((r) => {
    const loc = canonicalFor(siteUrl, r.path);
    return `  <url><loc>${loc}</loc><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
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
  /** Route path as in ROUTES ('' is the home page). */
  path: string;
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
 * Names and descriptions are English for the same reason the descriptions are (see the top of
 * this file); only the `<title>` a human reads in a tab follows the visitor's language.
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
    const url = canonicalFor(base, page.path);
    const isHome = normalisePath(page.path) === '';
    graph.push({
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: page.name,
      description: page.description,
      inLanguage: 'en',
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
          { '@type': 'ListItem', position: 1, name: page.homeLabel, item: `${base}/` },
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
