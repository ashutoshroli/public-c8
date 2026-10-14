<script lang="ts">
  /**
   * One festival year on one page: /2025 and /hi/2025.
   *
   * Why it exists. Until now a year was a setting in the header: the same URL showed whichever year
   * a visitor had picked, so "Chhath Puja 2023 expenses" had no address to be found at, linked to,
   * or shared. Now each year with records has a page of its own, in English and in Hindi, written
   * out in plain sentences so that a search engine can read it and a person can follow it.
   *
   * Where the figures come from is the same as for the "accounts in words" box under the data
   * pages (AccountsText.svelte), and for the same reasons:
   *   - in the page's HTML: the snapshot the last build read from the API, labelled with its date;
   *   - once the live data has loaded in the browser: the same sentences from that data, labelled
   *     live — or "saved" when what arrived is an old copy.
   * Both come out of ONE function (lib/snapshot/facts.ts), so they agree to the rupee.
   *
   * It names no one: counts, totals, roles, and villages large enough not to point at a person.
   * The committee's story of the year is shown only when it names nobody (facts.ts, readStory).
   */
  import { untrack } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { portalState, year as selectedYear } from '$lib/stores/portal';
  import { lang, tr, lp } from '$lib/stores/lang';
  import { yearPack, yearsWithRecords, type YearPack } from '$lib/snapshot/facts';
  import { yearText, type Source } from '$lib/snapshot/text';
  import { prerenderedYear, yearCarrierScript } from '$lib/snapshot/runtime';
  import { istDate } from '$lib/snapshot/ist';
  import { yearDocumentTitle } from '$lib/seo';
  import TextBlocks from './TextBlocks.svelte';

  // The year in the address. (The matcher in src/params/year.ts guarantees four digits.)
  const yr = $derived(Number($page.params.year));

  // What this page was prerendered with. Read ONCE, before the template runs: in the browser it
  // comes from a JSON block in <head> that Svelte removes while it hydrates, so a later read would
  // find nothing. It belongs to the year the page was loaded for — moving on to another year by a
  // link must not show it for the wrong one, hence the check.
  const initial = untrack(() => prerenderedYear(Number($page.params.year)));
  const pre = $derived(initial && initial.pack.year === yr ? initial : null);

  interface View {
    /** null: the data is here and this year has nothing in it. */
    pack: YearPack | null;
    /** Every year that has a page, newest first. */
    years: number[];
    source: Source;
  }

  const view = $derived.by((): View | null => {
    const s = $portalState;
    if (s.status === 'ready' && !s.failed) {
      const years = yearsWithRecords(s.data);
      const source: Source =
        s.stale || s.source === 'snapshot'
          ? { kind: 'saved', asOf: istDate(new Date(s.savedAt || Date.now())) }
          : { kind: 'live' };
      return { pack: years.includes(yr) ? yearPack(s.data, yr, new Date()) : null, years, source };
    }
    return pre ? { pack: pre.pack, years: pre.years, source: { kind: 'snapshot', asOf: pre.asOf } } : null;
  });

  const model = $derived(view?.pack ? yearText(view.pack, $lang, view.source) : null);

  const LEDGERS = [
    { href: '/contributors', key: 'summary_contributors' },
    { href: '/expenses', key: 'nav_expenses' },
    { href: '/loans', key: 'nav_loans' },
    { href: '/committee', key: 'nav_committee' },
  ] as const;
</script>

<svelte:head>
  <title>{yearDocumentTitle(yr, $lang)}</title>
  {#if !browser && pre}
    <!-- Server only: hands the snapshot to the browser so it hydrates to the same markup. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags — a JSON string built by yearCarrierScript, `<` escaped -->
    {@html yearCarrierScript(yr, pre)}
  {/if}
  {#if view && !view.pack}
    <!-- A year with nothing in it is not a page worth finding. -->
    <meta name="robots" content="noindex, follow" />
  {/if}
</svelte:head>

<div class="mx-auto max-w-3xl" data-year-page={yr}>
  <div class="mb-5">
    <h1 class="text-2xl font-extrabold leading-tight sm:text-3xl">{$tr('year_title', { year: yr })}</h1>
    <p class="mt-1 text-sm text-muted">{$tr('org_name')} · {$tr('org_location')}</p>
  </div>

  {#if model}
    <p class="mb-4 text-xs text-muted">{model.note}</p>

    {#if model.story}
      <section class="surface mb-4 p-5" aria-labelledby="year-story-h" data-year-section="story">
        <h2 id="year-story-h" class="text-base font-bold">{model.story.title}</h2>
        <p class="mt-2 text-sm leading-relaxed">{model.story.content}</p>
      </section>
    {/if}

    {#each model.sections as sec (sec.id)}
      <section
        class="surface mb-4 space-y-3 p-5 text-sm leading-relaxed"
        aria-labelledby="year-{sec.id}-h"
        data-year-section={sec.id}
      >
        <h2 id="year-{sec.id}-h" class="text-base font-bold">{sec.title}</h2>
        <TextBlocks blocks={sec.blocks} />
      </section>
    {/each}

    <p class="mb-4 text-xs text-muted">{model.footnote}</p>

    <!-- The full lists live on the ledger pages. Opening one from here also makes it show THIS year. -->
    <section class="surface mb-4 p-5" aria-labelledby="year-details-h">
      <h2 id="year-details-h" class="text-base font-bold">{$tr('year_details_h')}</h2>
      <p class="mt-1 text-sm text-muted">{$tr('year_details_sub')}</p>
      <ul class="mt-3 flex flex-wrap gap-2">
        {#each LEDGERS as l}
          <li><a class="chip" href={$lp(l.href)} onclick={() => selectedYear.set(yr)}>{$tr(l.key)}</a></li>
        {/each}
      </ul>
    </section>
  {:else if view}
    <section class="surface mb-4 p-5 text-sm" data-year-section="empty">
      <p>{$tr('year_no_records', { year: yr })}</p>
    </section>
  {:else}
    <div class="space-y-3" role="status" aria-busy="true">
      <p class="sr-only">{$tr('year_loading', { year: yr })}</p>
      {#each Array(4) as _}<div class="skeleton h-20 w-full"></div>{/each}
    </div>
  {/if}

  {#if view && view.years.length > 0}
    <nav class="surface p-5" aria-labelledby="year-nav-h">
      <h2 id="year-nav-h" class="text-base font-bold">{$tr('year_nav_h')}</h2>
      <ul class="mt-3 flex flex-wrap gap-2">
        {#each view.years as y (y)}
          <li>
            {#if y === yr}
              <span class="chip !border-brand-600 !bg-brand-50 !text-brand-700" aria-current="page">{y}</span>
            {:else}
              <a class="chip" href={$lp(`/${y}`)}>{y}</a>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="mt-3 text-sm">
        <a href={$lp('/decade')} class="font-semibold text-brand-700 underline underline-offset-2">{$tr('decade_title')}</a>
      </p>
    </nav>
  {/if}
</div>
