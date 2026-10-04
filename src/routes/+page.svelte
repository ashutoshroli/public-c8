<script lang="ts">
  import { ArrowRight, ChevronRight, RefreshCw } from '@lucide/svelte';
  import LiveScroll from '$lib/components/LiveScroll.svelte';
  import ContributorDetail from '$lib/components/ContributorDetail.svelte';
  import ContributorsListModal from '$lib/components/ContributorsListModal.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import CountUp from '$lib/components/CountUp.svelte';
  import { portalState, year, refreshPortal } from '$lib/stores/portal';
  import { tr, lang } from '$lib/stores/lang';
  import {
    ALL_YEARS,
    computeFinancials,
    computeSummary,
    rankedContributors,
    decadeStats,
    journeyTagline,
    type Contributor
  } from '$lib/api/derive';
  import type { Ranked } from '$lib/utils/ranking';
  import { fmt } from '$lib/utils/format';

  let selected = $state<Ranked<Contributor> | null>(null);
  let listOpen = $state(false);

  function onSelect(key: string) {
    selected = rankedContributors($portalState.data, $year).find((r) => r.item.key === key) ?? null;
  }

  let loading = $derived($portalState.status === 'loading');
  let fin = $derived(computeFinancials($portalState.data, $year));
  let sum = $derived(computeSummary($portalState.data, $year));
  let yearLabel = $derived($year === ALL_YEARS ? $tr('all_years') : String($year));

  let refreshing = $state(false);
  async function onRefresh() {
    if (refreshing) return;
    refreshing = true;
    await refreshPortal();
    refreshing = false;
  }
  let updatedLabel = $derived(
    $portalState.savedAt
      ? new Intl.DateTimeFormat($lang === 'hi' ? 'hi-IN' : 'en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date($portalState.savedAt))
      : '—'
  );

  let d = $derived(decadeStats($portalState.data));
  let rangeVars = $derived({ start: d.startYear, end: d.endYear });
  let tagline = $derived(journeyTagline($portalState.data));
  let taglineText = $derived(($lang === 'hi' ? tagline.hi : tagline.en) || $tr('decade_sub'));

  let pct = $derived(Math.max(0, Math.min(100, fin.utilizedPct)));
</script>

<svelte:head>
  <title>Chhath Puja Transparency Portal — Navyuvak Chhath Puja Samiti</title>
  <meta
    name="description"
    content="Every contribution is visible. Every expense is accountable. Live financial transparency for Navyuvak Chhath Puja Samiti, Shaharpura, Gardih."
  />
</svelte:head>

{#if $portalState.failed}
  <h1 class="sr-only">{$tr('app_title')}</h1>
  <ErrorState />
{:else}
  <section class="mb-6">
    <h1 class="text-2xl font-extrabold leading-snug sm:text-4xl">
      {#each $tr('hero_headline').split('\n') as line}
        <span class="block">{line}</span>
      {/each}
    </h1>
    <p class="mt-2 text-sm text-muted">{$tr('hero_sub')}</p>
  </section>

  <div class="grid gap-4 lg:grid-cols-5">
    <!-- Budget -->
    <section class="surface p-5 lg:col-span-3" aria-labelledby="budget-h">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 text-xs font-bold text-success">
          <span class="h-2 w-2 rounded-full bg-success animate-pulseDot"></span>{$tr('live')}
        </span>
        <h2 id="budget-h" class="text-sm font-bold text-muted">{yearLabel} · {$tr('financial_overview')}</h2>
        <button
          class="chip ml-auto !h-8 !px-2"
          onclick={onRefresh}
          aria-label={$tr('refresh')}
          title={$tr('refresh')}
          disabled={refreshing}
        >
          <RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" aria-hidden="true" />
        </button>
      </div>

      {#if loading}
        <div class="mt-5 space-y-3">
          <div class="skeleton h-4 w-24"></div>
          <div class="skeleton h-10 w-52"></div>
          <div class="skeleton h-2 w-full"></div>
        </div>
      {:else}
        <p class="mt-5 text-xs font-semibold text-muted">{$tr('total_budget')}</p>
        <p class="mt-1 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          <CountUp value={fin.totalBudget} format={fmt} />
        </p>

        <div
          class="mt-4 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(pct)}
          aria-label={$tr('utilized')}
        >
          <div class="h-full rounded-full bg-brand-600" style="width: {pct}%"></div>
        </div>
        <div class="mt-2 flex justify-between text-xs text-muted">
          <span>{pct.toFixed(1)}% {$tr('utilized')}</span>
          <span class="font-semibold {fin.available < 0 ? 'text-danger' : 'text-success'}">{fmt(fin.available)} {$tr('still_available')}</span>
        </div>

        <dl class="mt-5 divide-y divide-line border-t border-line text-sm">
          <div class="flex items-center justify-between py-3">
            <dt class="text-muted">{$tr('collected')}</dt>
            <dd class="font-extrabold text-success">{fmt(fin.collection)}</dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="text-muted">{$tr('expenses')}</dt>
            <dd class="font-extrabold text-danger">{fmt(fin.totalExpense)}</dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="text-muted">
              {$year === ALL_YEARS ? $tr('lifetime_loans_returned') : $tr('past_loan_returned')}
            </dt>
            <dd class="font-extrabold text-info">{fmt(fin.pastLoanReturned)}</dd>
          </div>
        </dl>
        <p class="mt-1 text-[11px] text-muted">{$tr('last_updated')}: {updatedLabel}</p>
      {/if}
    </section>

    <!-- Summary -->
    <section class="surface flex flex-col p-5 lg:col-span-2" aria-label={$tr('summary_total_collected')}>
      {#if loading}
        <div class="space-y-4">
          {#each Array(3) as _}<div class="skeleton h-12 w-full"></div>{/each}
        </div>
      {:else}
        <dl class="divide-y divide-line">
          <div class="flex items-baseline justify-between py-3 first:pt-0">
            <dt class="text-sm text-muted">{$tr('summary_contributors')}</dt>
            <dd class="text-2xl font-extrabold"><CountUp value={sum.contributors} format={(n) => Math.round(n).toString()} /></dd>
          </div>
          <div class="flex items-baseline justify-between py-3">
            <dt class="text-sm text-muted">{$tr('summary_total_collected')}</dt>
            <dd class="text-2xl font-extrabold"><CountUp value={sum.totalCollected} format={fmt} /></dd>
          </div>
          <div class="flex items-baseline justify-between py-3">
            <dt class="text-sm text-muted">{$tr('summary_avg')}</dt>
            <dd class="text-2xl font-extrabold"><CountUp value={sum.average} format={fmt} /></dd>
          </div>
        </dl>
        <button
          type="button"
          class="btn-primary mt-auto w-full justify-between"
          onclick={() => (listOpen = true)}
          aria-label={$tr('summary_view_list_label')}
        >
          {$tr('summary_view_list')}
          <ChevronRight class="h-4 w-4" aria-hidden="true" />
        </button>
      {/if}
    </section>
  </div>

  <!-- Contributors rail -->
  <div class="mt-4">
    <LiveScroll onselect={onSelect} oncountclick={() => (listOpen = true)} />
  </div>

  <!-- Journey -->
  <a
    href="/decade"
    aria-label={$tr('decade_title')}
    class="surface mt-4 flex items-center gap-4 p-5 transition-colors hover:bg-canvas"
  >
    <div class="min-w-0 flex-1">
      <p class="text-xs font-bold text-brand-700">{$tr('decade_years', rangeVars)}</p>
      <h2 class="mt-0.5 text-lg font-extrabold leading-tight">{$tr('decade_title')}</h2>
      <p class="mt-1 text-sm text-muted">{taglineText}</p>
    </div>
    <span class="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-600 text-white" aria-hidden="true">
      <ArrowRight class="h-4 w-4" />
    </span>
  </a>
{/if}

<ContributorDetail entry={selected} onclose={() => (selected = null)} />
<ContributorsListModal open={listOpen} onclose={() => (listOpen = false)} />
