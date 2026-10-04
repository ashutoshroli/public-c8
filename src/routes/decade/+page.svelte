<script lang="ts">
  import { Info } from '@lucide/svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { tr, lang } from '$lib/stores/lang';
  import { portalState } from '$lib/stores/portal';
  import { decadeStats, journeyEntries, journeyTagline, journeyText, interp } from '$lib/api/derive';
  import { fmt } from '$lib/utils/format';
  import { DECADE_MILESTONES } from '$lib/utils/decadeData';

  // Live decade figures (no hardcoded numbers).
  let d = $derived(decadeStats($portalState.data));
  // DB-managed page text (mgmt "Journey Content" tab). Each block falls back to
  // its built-in i18n string when the DB has nothing for that field.
  let jt = $derived(journeyText($portalState.data, $lang));
  const T = (key: string, i18nKey: string, vars?: Record<string, string | number>) =>
    key in jt ? interp(jt[key], vars) : $tr(i18nKey, vars);
  // The transparency-evolution timeline steps — DB text with i18n fallback.
  const TIMELINE = [
    ['tl_paper', 'decade_tl_paper'], ['tl_pdf', 'decade_tl_pdf'], ['tl_wa', 'decade_tl_wa'],
    ['tl_sheets', 'decade_tl_sheets'], ['tl_portal', 'decade_tl_portal']
  ] as const;
  // Story text (title/content per year) now comes from the DB (journey_entries),
  // keyed by year; the numbers still come from `d`. Falls back to empty when the
  // backend hasn't shipped journey content yet.
  let story = $derived(journeyEntries($portalState.data));
  let storyByYear = $derived(
    new Map(story.map((e, i) => [String(e.year), {
      i,
      title: $lang === 'hi' && e.titleHi ? e.titleHi : e.titleEn,
      content: $lang === 'hi' && e.contentHi ? e.contentHi : e.contentEn
    }]))
  );
  // Tagline: DB value (bilingual) with the built-in i18n string as fallback.
  let tagline = $derived(journeyTagline($portalState.data));
  let taglineText = $derived(
    ($lang === 'hi' ? tagline.hi : tagline.en) || $tr('decade_sub')
  );
  // Range vars for the placeholder-based headings.
  let rangeVars = $derived({ start: d.startYear, end: d.endYear });
</script>

<svelte:head>
  <title>{$tr('decade_title')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="decade_title" subtitle={$tr('decade_years', rangeVars)} />

<div class="mx-auto max-w-3xl space-y-5">
  <!-- Intro -->
  <section class="surface p-6">
    <p class="text-xs font-bold text-brand-700">{$tr('decade_years', rangeVars)}</p>
    <p class="mt-1 text-lg font-extrabold">{taglineText}</p>
    <p class="mt-3 text-sm leading-relaxed text-muted">{T('intro', 'decade_intro')}</p>
  </section>

  <!-- Origin -->
  <section class="surface p-6">
    <h2 class="text-base font-extrabold">{T('origin_h', 'decade_origin_h')}</h2>
    <div class="mt-2 space-y-2 text-sm leading-relaxed">
      <p>{T('origin_p1', 'decade_origin_p1')}</p>
      <p>{T('origin_p2', 'decade_origin_p2')}</p>
      <p>{T('origin_p3', 'decade_origin_p3')}</p>
      <p class="font-semibold">{T('origin_p4', 'decade_origin_p4')}</p>
    </div>
  </section>

  <!-- Year-by-year journey -->
  <section>
    <h2 class="mb-3 text-sm font-bold text-muted">{T('journey_h', 'decade_journey')}</h2>
    <ol class="relative space-y-3 border-l border-line pl-5">
      {#each d.years as row (row.year)}
        {@const entry = storyByYear.get(String(row.year))}
        <li class="relative">
          <span class="absolute -left-[25px] top-5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600 ring-1 ring-line"></span>
          <div class="surface p-4">
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="text-sm font-extrabold">{entry?.title || row.year}</h3>
              <span class="text-xs font-bold text-muted">{row.year}{#if row.isCurrent} •{/if}</span>
            </div>
            {#if entry?.content}<p class="mt-1 text-sm leading-relaxed text-muted">{entry.content}</p>{/if}
            <div class="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span class="rounded-md bg-brand-50 px-2.5 py-1 text-brand-700">{T('total_label', 'decade_total_label')}: {fmt(row.total)}</span>
              <span class="rounded-md bg-canvas px-2.5 py-1">{T('contributors_label', 'decade_contributors_label')}: {row.contributors}</span>
            </div>
            {#if row.isCurrent}
              <div class="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
                <Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p class="font-bold">{T('current_note_h', 'decade_current_note_h', { year: row.year })}</p>
                  <p class="mt-0.5">{T('current_note_p', 'decade_current_note_p', { year: row.year })}</p>
                </div>
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  </section>

  <!-- Portal callout -->
  <section class="surface p-6">
    <p class="text-xs text-muted">{T('evolution_line', 'decade_evolution_line')}</p>
    <h2 class="mt-2 text-base font-extrabold">{T('portal_h', 'decade_portal_h')}</h2>
    <p class="mt-1 text-sm leading-relaxed">{T('portal_p', 'decade_portal_p')}</p>
  </section>

  <!-- Financial journey table -->
  <section class="surface p-6">
    <h2 id="decade-table-h" class="text-base font-extrabold">{T('table_h', 'decade_table_h', rangeVars)}</h2>
    <div class="mt-3" role="table" aria-labelledby="decade-table-h">
      <div role="row" class="grid grid-cols-[1fr_1.4fr_1fr] gap-2 border-b border-line pb-2 text-xs font-bold text-muted">
        <span role="columnheader">{T('th_year', 'decade_th_year')}</span>
        <span role="columnheader">{T('th_total', 'decade_th_total')}</span>
        <span role="columnheader">{T('th_contributors', 'decade_th_contributors')}</span>
      </div>
      {#each d.years as r (r.year)}
        <div role="row" class="grid grid-cols-[1fr_1.4fr_1fr] gap-2 border-b border-line py-2.5 text-sm last:border-0">
          <span role="cell" class="font-bold">{r.year}{#if r.isCurrent} •{/if}</span>
          <span role="cell" class="font-semibold text-brand-700">{fmt(r.total)}</span>
          <span role="cell">{r.contributors}</span>
        </div>
      {/each}
    </div>

    <div class="mt-4 rounded-lg bg-canvas p-4">
      <p class="text-xs font-bold text-muted">{T('totals_h', 'decade_totals_h', rangeVars)}</p>
      <p class="mt-1 text-lg font-extrabold">{T('total_amount', 'decade_total_amount', { amount: fmt(d.grandTotal) })}</p>
      <p class="text-sm font-bold">{T('total_entries', 'decade_total_entries', { count: d.grandContributors })}</p>
      <p class="mt-2 text-xs text-muted">{T('total_clarify', 'decade_total_clarify', { count: d.grandContributors })}</p>
    </div>
  </section>

  <!-- Transparency evolution -->
  <section>
    <h2 class="mb-3 text-sm font-bold text-muted">{T('timeline_h', 'decade_timeline_h')}</h2>
    <ol class="relative space-y-3 border-l border-line pl-5">
      {#each TIMELINE as [key, i18n], i}
        <li class="relative">
          <span class="absolute -left-[31px] top-3 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-extrabold text-white">{i + 1}</span>
          <div class="surface p-3.5">
            <p class="text-sm font-extrabold">{T(key + '_h', i18n + '_h')}</p>
            <p class="mt-0.5 text-sm text-muted">{T(key + '_d', i18n + '_d')}</p>
          </div>
        </li>
      {/each}
    </ol>
  </section>

  <!-- Our thinking / milestones -->
  <section class="surface p-6">
    <h2 class="text-base font-extrabold">{T('think_h', 'decade_think_h')}</h2>
    <p class="mt-1 text-sm font-bold text-brand-700">{T('think_lead', 'decade_think_lead')}</p>
    <p class="mt-2 text-sm leading-relaxed">{T('think_p', 'decade_think_p')}</p>
    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      {#each DECADE_MILESTONES as m}
        {@const msKey = 'ms_' + m.year}
        <div class="rounded-lg border border-line p-4">
          <p class="text-sm font-extrabold">{T(msKey + '_h', m.headingKey)}</p>
          <p class="mt-1 text-xs leading-relaxed text-muted">{T(msKey + '_d', m.bodyKey)}</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- Closing -->
  <section class="surface p-6 text-center">
    <h2 class="text-lg font-extrabold text-brand-700">{T('closing_h', 'decade_closing_h')}</h2>
    <div class="mx-auto mt-2 max-w-xl space-y-2 text-sm leading-relaxed">
      <p>{T('closing_p1', 'decade_closing_p1')}</p>
      <p>{T('closing_p2', 'decade_closing_p2')}</p>
      <p>{T('closing_p3', 'decade_closing_p3')}</p>
    </div>
  </section>

  <p class="text-center text-sm text-muted">{T('footer', 'decade_footer')}</p>
  <p class="text-center text-sm font-semibold text-brand-700">{$tr('seva_line')}</p>
</div>
