<script lang="ts">
  import { Search, FileText, ChevronRight, ArrowLeft } from '@lucide/svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import { portalState } from '$lib/stores/portal';
  import { tr, lang } from '$lib/stores/lang';
  import { villages, peopleInVillage, downloadsForPerson } from '$lib/api/derive';
  import type { UserRow } from '$lib/api/schema';
  import { initials, avatarGradient, safeUrl } from '$lib/utils/format';

  let loading = $derived($portalState.status === 'loading');
  let village = $state('');
  let query = $state('');
  let selected = $state<UserRow | null>(null);

  let villageList = $derived(villages($portalState.data, $lang));
  // The people list only appears AFTER the visitor searches: picking a village alone
  // must not dump everyone. Needs a village + a non-empty query.
  let searchQuery = $derived(query.trim());
  let people = $derived(village && searchQuery ? peopleInVillage($portalState.data, village, searchQuery) : []);
  let groups = $derived(selected ? downloadsForPerson($portalState.data, (selected.ID ?? '').toString()) : []);
  let selectedGrad = $derived(avatarGradient((selected?.ID ?? '').toString()));

  const nameOf = (u: UserRow) =>
    ($lang === 'hi' && u['Name (Hindi)'] ? u['Name (Hindi)'] : u.Name ?? '').toString();
</script>

<svelte:head>
  <title>{$tr('download_center')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="download_center" subtitle={$tr('org_name')} />

{#if $portalState.failed}
  <ErrorState />
{:else if loading}
  <div class="space-y-2.5">
    {#each Array(5) as _}<div class="skeleton h-14 rounded-xl"></div>{/each}
  </div>
{:else if selected}
  <button class="chip mb-4" onclick={() => (selected = null)}>
    <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {$tr('back')}
  </button>
  <div class="surface mb-4 flex items-center gap-3 p-4">
    <span
      class="grid h-11 w-11 place-items-center rounded-full text-sm font-extrabold text-white"
      style="background-image: linear-gradient(135deg, {selectedGrad[0]}, {selectedGrad[1]})"
      aria-hidden="true"
    >{initials(nameOf(selected))}</span>
    <p class="font-bold">{nameOf(selected)}</p>
  </div>

  {#if groups.length === 0}
    <EmptyState message={$tr('no_docs')} />
  {:else}
    {#each groups as g}
      <h2 class="mb-2 mt-5 text-sm font-bold text-muted">{$tr(g.titleKey)}</h2>
      <ul class="rows">
        {#each g.docs as d}
          <li class="flex items-center gap-3 px-4 py-3">
            <span class="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <FileText class="h-4 w-4" aria-hidden="true" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{$tr(d.labelKey)}</p>
              <p class="text-xs text-muted">{d.year}</p>
            </div>
            {#if safeUrl(d.publicLink)}
              <a class="btn-primary !px-3 !py-1.5 text-xs" href={safeUrl(d.publicLink)} target="_blank" rel="noopener">
                {$tr('download')}
              </a>
            {:else}
              <span class="rounded-lg bg-canvas px-3 py-1.5 text-xs font-semibold text-muted">{$tr('not_available')}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
{:else}
  <div class="surface mb-4 space-y-2 p-3">
    <select class="chip !h-10 w-full" bind:value={village} aria-label={$tr('select_village')}>
      <option value="">{$tr('select_village')}</option>
      {#each villageList as v}<option value={v}>{v}</option>{/each}
    </select>
    {#if village}
      <label class="relative block">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input class="field pl-9" placeholder={$tr('name')} aria-label={$tr('name')} bind:value={query} type="search" />
      </label>
    {/if}
  </div>

  {#if !village}
    <EmptyState message={$tr('select_village_first')} />
  {:else if !searchQuery}
    <EmptyState message={$tr('type_to_search')} />
  {:else if people.length === 0}
    <EmptyState message={$tr('no_matches')} />
  {:else}
    <ul class="rows">
      {#each people as u (u.ID)}
        {@const grad = avatarGradient((u.ID ?? '').toString())}
        <li>
          <button class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas" onclick={() => (selected = u)}>
            <span
              class="grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold text-white"
              style="background-image: linear-gradient(135deg, {grad[0]}, {grad[1]})"
              aria-hidden="true"
            >{initials(nameOf(u))}</span>
            <span class="min-w-0 flex-1 truncate text-sm font-semibold">{nameOf(u)}</span>
            <ChevronRight class="h-4 w-4 text-muted" aria-hidden="true" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
