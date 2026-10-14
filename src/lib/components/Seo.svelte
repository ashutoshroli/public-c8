<script lang="ts">
  /**
   * Per-route canonical, language alternates, social preview and structured data (audit PR-42).
   *
   * Rendered once from `+layout.svelte`, deriving everything from the current pathname, so all
   * thirteen routes — and every year page, in both languages — are covered without a copy of the
   * same tags in each, and a fourteenth route gets them the moment it is added to `ROUTES`.
   *
   * The canonical is the point. `+layout.svelte` used to emit
   *   <link rel="canonical" href={config.siteUrl} />
   * on every page, which tells a crawler that /expenses, /loans, /committee and the rest are
   * duplicates of the home page. Every inner page of the portal was asking not to be indexed.
   *
   * The language is in the address (/hi/… is Hindi), so each language page canonicals to ITSELF
   * and names its twin with hreflang. A canonical from the Hindi page to the English one would
   * ask Google to drop the Hindi page — the opposite of the point of having it.
   */
  import { page } from '$app/stores';
  import { config } from '$lib/config';
  import { t, type Lang } from '$lib/i18n';
  import { langOfPath, stripLang, yearOfPath } from '$lib/lang/url';
  import {
    OG_IMAGE,
    alternatesFor,
    canonicalFor,
    descriptionFor,
    isIndexable,
    metaFor,
    normalisePath,
    ogImageUrl,
    structuredData,
    yearDescription,
    yearDocumentTitle,
    yearTitle,
  } from '$lib/seo';

  let path = $derived($page.url.pathname);
  // The language of the address, and the address without it: '/hi/expenses' -> '/expenses'.
  // These come from the address alone, not from the language store, so a page's tags cannot
  // depend on the order things happened to render in.
  let lng = $derived<Lang>(langOfPath(path));
  let stripped = $derived(normalisePath(stripLang(normalisePath(path))) || '/');
  let year = $derived(yearOfPath(stripped));
  let meta = $derived(metaFor(path));
  let canonical = $derived(canonicalFor(config.siteUrl, path));

  // Social share title. The home route's document title is the bare app title ('Chhath Puja'),
  // too weak a preview for a share card, so it uses the fuller descriptive `social_title`; the
  // inner routes read "<page> — <app title>", and a year page "Chhath Puja 2025 — <committee>".
  let shareTitle = $derived(
    year !== null
      ? yearDocumentTitle(year, lng)
      : meta
        ? meta.path === ''
          ? t(lng, 'social_title')
          : `${t(lng, meta.titleKey)} — ${t(lng, 'app_title')}`
        : t(lng, 'app_title')
  );
  let description = $derived(
    year !== null ? yearDescription(year, lng) : meta ? descriptionFor(meta, lng) : ''
  );

  // A route with no entry in the table is not a page we want indexed — an unknown path under a
  // SPA fallback would otherwise be indexed as a copy of the home page. A route that opts out
  // with `noindex` (the receipt-verification page) is kept out for the same reason it is kept
  // out of the sitemap.
  let indexable = $derived(isIndexable(path));
  // The page in each language plus x-default; every language version lists all of them, itself
  // included (Google ignores a pair that is not reciprocal). Only for pages worth indexing.
  let alternates = $derived(indexable ? alternatesFor(config.siteUrl, stripped) : []);

  // Link-preview card: a purpose-made 1200x630 image (the 1.91:1 shape every platform crops to),
  // paired with a summary_large_image card (twitter:card in app.html).
  const image = $derived(ogImageUrl(config.siteUrl));

  // Structured data is in the language of the page, like the page itself; the organisation and
  // site nodes in it do not vary by language.
  let jsonLd = $derived(
    structuredData(
      config.siteUrl,
      year !== null
        ? {
            path: stripped,
            lang: lng,
            name: shareTitle,
            description,
            homeLabel: t(lng, 'nav_home'),
            pageLabel: yearTitle(year, lng),
          }
        : meta
          ? {
              path: meta.path,
              lang: lng,
              name: shareTitle,
              description,
              homeLabel: t(lng, 'nav_home'),
              pageLabel: t(lng, meta.titleKey),
            }
          : null
    )
  );
</script>

<svelte:head>
  <link rel="canonical" href={canonical} />
  {#each alternates as a (a.hreflang)}
    <link rel="alternate" hreflang={a.hreflang} href={a.href} />
  {/each}
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={shareTitle} />
  <meta name="twitter:title" content={shareTitle} />
  {#if description}
    <meta name="description" content={description} />
    <meta property="og:description" content={description} />
    <meta name="twitter:description" content={description} />
  {/if}
  <meta property="og:image" content={image} />
  <meta property="og:image:type" content={OG_IMAGE.type} />
  <meta property="og:image:width" content={String(OG_IMAGE.width)} />
  <meta property="og:image:height" content={String(OG_IMAGE.height)} />
  <meta property="og:image:alt" content={OG_IMAGE.alt} />
  <meta name="twitter:image" content={image} />
  <meta name="twitter:image:alt" content={OG_IMAGE.alt} />
  <!-- India is the audience; the page is in one language and offers the other as an alternate. -->
  <meta property="og:locale" content={lng === 'hi' ? 'hi_IN' : 'en_IN'} />
  <meta property="og:locale:alternate" content={lng === 'hi' ? 'en_IN' : 'hi_IN'} />
  <!-- An error page (src/routes/+error.svelte) states its own, stricter "noindex, nofollow"; two
       robots tags on one page is exactly the ambiguity a crawler should not have to resolve. -->
  {#if !indexable && !$page.error}
    <meta name="robots" content="noindex, follow" />
  {/if}
  <!-- Structured data: ONE graph per page (organisation, site, this page, its breadcrumb). The
       organisation and site nodes do not vary by path; the page and breadcrumb nodes do. -->
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>
