<script lang="ts">
  import { year } from '$lib/stores/portal';
  import { tr } from '$lib/stores/lang';
  import { ALL_YEARS } from '$lib/api/derive';

  interface Props {
    titleKey: string;
    subtitle?: string;
    /** Hide the year when the page is not year-scoped. */
    noYear?: boolean;
  }
  let { titleKey, subtitle = '', noYear = false }: Props = $props();
</script>

<div class="mb-5">
  <h1 class="text-2xl font-extrabold leading-tight sm:text-3xl">{$tr(titleKey)}</h1>
  {#if subtitle || !noYear}
    <p class="mt-1 text-sm text-muted">
      {subtitle || ($year === ALL_YEARS ? $tr('all_years') : $year)}
    </p>
  {/if}
</div>
