<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { year, years } from '$lib/stores/portal';
  import { tr } from '$lib/stores/lang';

  function onChange(e: Event) {
    year.set(parseInt((e.target as HTMLSelectElement).value, 10));
  }
</script>

<div class="relative">
  <select
    class="chip appearance-none pr-7 font-bold"
    aria-label={$tr('select_year')}
    value={String($year)}
    onchange={onChange}
  >
    {#each $years as y}
      <option value={String(y)}>{y}</option>
    {/each}
  </select>
  <ChevronDown class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
</div>
