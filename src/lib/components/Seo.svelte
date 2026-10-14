<script lang="ts">
  /**
   * Per-route canonical, social preview and structured data (audit PR-42).
   *
   * Rendered once from `+layout.svelte`, deriving everything from the current pathname, so all
   * thirteen routes are covered without thirteen copies of the same tags — and a fourteenth
   * route gets them the moment it is added to `ROUTES`.
   *
   * The canonical is the point. `+layout.svelte` used to emit
   *   <link rel="canonical" href={config.siteUrl} />
   * on every page, which tells a crawler that /expenses, /loans, /committee and the rest are
   * duplicates of the home page. Every inner page of the portal was asking not to be indexed.
   */
  import { page } from '$app/stores';
  import { config } from '$lib/config';
  import { tr } from '$lib/stores/lang';
  import { t } from '$lib/i18n';
  import { OG_IMAGE, canonicalFor, isIndexable, metaFor, ogImageUrl, structuredData } from '$lib/seo';

  let path = $derived($page.url.pathname);
  let meta = $derived(metaFor(path));
  let canonical = $derived(canonicalFor(config.siteUrl, path));
  let title = $derived(
    meta ? (meta.path === '' ? $tr('app_title') : `${$tr(meta.titleKey)} — ${$tr('app_title')}`) : $tr('app_title')
  );
  // Social share title: the home route's document title is the bare app_title ('Chhath Puja'),
  // too weak a preview for a share card, so og:title/twitter:title use the fuller descriptive
  // `social_title` there. Inner routes already get `${pageTitle} — ${app_title}` and keep it.
  let socialTitle = $derived(meta && meta.path === '' ? $tr('social_title') : title);
  // A route with no entry in the table is not a page we want indexed — an unknown path under a
  // SPA fallback would otherwise be indexed as a copy of the home page. A route that opts out
  // with `noindex` (the receipt-verification page) is kept out for the same reason it is kept
  // out of the sitemap.
  let indexable = $derived(isIndexable(path));
  // Link-preview card: a purpose-made 1200x630 image (the 1.91:1 shape every platform crops to),
  // paired with a summary_large_image card (twitter:card in app.html).
  const image = $derived(ogImageUrl(config.siteUrl));

  // Structured data is English and does not follow the visitor's stored language: it is read by
  // machines, and a crawler must get the same graph whichever visitor it happens to resemble.
  let jsonLd = $derived(
    structuredData(
      config.siteUrl,
      meta
        ? {
            path: meta.path,
            name:
              meta.path === ''
                ? t('en', 'social_title')
                : `${t('en', meta.titleKey)} — ${t('en', 'app_title')}`,
            description: meta.description,
            homeLabel: t('en', 'nav_home'),
            pageLabel: t('en', meta.titleKey),
          }
        : null
    )
  );
</script>

<svelte:head>
  <link rel="canonical" href={canonical} />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={socialTitle} />
  <meta name="twitter:title" content={socialTitle} />
  {#if meta}
    <meta name="description" content={meta.description} />
    <meta property="og:description" content={meta.description} />
    <meta name="twitter:description" content={meta.description} />
  {/if}
  <meta property="og:image" content={image} />
  <meta property="og:image:type" content={OG_IMAGE.type} />
  <meta property="og:image:width" content={String(OG_IMAGE.width)} />
  <meta property="og:image:height" content={String(OG_IMAGE.height)} />
  <meta property="og:image:alt" content={OG_IMAGE.alt} />
  <meta name="twitter:image" content={image} />
  <meta name="twitter:image:alt" content={OG_IMAGE.alt} />
  <!-- India is the audience; Hindi is offered alongside English. -->
  <meta property="og:locale" content="en_IN" />
  <meta property="og:locale:alternate" content="hi_IN" />
  <!-- An error page (src/routes/+error.svelte) states its own, stricter "noindex, nofollow"; two
       robots tags on one page is exactly the ambiguity a crawler should not have to resolve. -->
  {#if !indexable && !$page.error}
    <meta name="robots" content="noindex, follow" />
  {/if}
  <!-- Structured data: ONE graph per page (organisation, site, this page, its breadcrumb). The
       organisation and site nodes do not vary by path; the page and breadcrumb nodes do. -->
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>
