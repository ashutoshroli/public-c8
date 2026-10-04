<script lang="ts">
  import { Search } from '@lucide/svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import SkeletonList from '$lib/components/SkeletonList.svelte';
  import { portalState, year } from '$lib/stores/portal';
  import { tr, lang } from '$lib/stores/lang';
  import { expenseItems } from '$lib/api/derive';
  import { fmt } from '$lib/utils/format';

  let query = $state('');
  let debounced = $state('');
  let timer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const q = query;
    clearTimeout(timer);
    timer = setTimeout(() => (debounced = q.trim().toLowerCase()), 180);
    return () => clearTimeout(timer);
  });

  let loading = $derived($portalState.status === 'loading');
  let items = $derived(expenseItems($portalState.data, $year));
  let total = $derived(items.reduce((s, e) => s + e.amount, 0));

  let view = $derived.by(() => {
    if (!debounced) return items;
    return items.filter(
      (e) =>
        e.description.toLowerCase().includes(debounced) ||
        e.descriptionHindi.toLowerCase().includes(debounced) ||
        e.category.toLowerCase().includes(debounced)
    );
  });

  const desc = (e: { description: string; descriptionHindi: string }) =>
    $lang === 'hi' && e.descriptionHindi ? e.descriptionHindi : e.description;
</script>

<svelte:head>
  <title>{$tr('expenses_ledger')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="expenses_ledger" />

{#if $portalState.failed}
  <ErrorState />
{:else}
  <div class="surface mb-4 flex items-center justify-between p-4">
    <span class="text-sm font-semibold text-muted">{$tr('total_expense')}</span>
    <span class="text-2xl font-extrabold text-danger">{fmt(total)}</span>
  </div>

  <label class="relative mb-4 block">
    <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    <input class="field pl-9" placeholder={$tr('search')} bind:value={query} aria-label={$tr('search')} type="search" />
  </label>

  {#if loading}
    <SkeletonList rows={6} />
  {:else if view.length === 0}
    <EmptyState message={debounced ? $tr('no_matches') : $tr('no_expenses')} />
  {:else}
    <ul class="rows">
      {#each view as e, i (i)}
        <li class="flex items-center gap-3 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold [overflow-wrap:anywhere]">{desc(e) || $tr('na')}</p>
            <p class="mt-0.5 text-xs text-muted">{#if e.category}{e.category} · {/if}{e.year}</p>
          </div>
          <span class="shrink-0 text-sm font-extrabold text-danger">{fmt(e.amount)}</span>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
