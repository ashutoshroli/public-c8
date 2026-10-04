<script lang="ts">
  import { CloudOff, Info } from '@lucide/svelte';
  import { portalState } from '$lib/stores/portal';
  import { tr } from '$lib/stores/lang';
  import { browser } from '$app/environment';

  let offline = $state(false);
  $effect(() => {
    if (!browser) return;
    const update = () => (offline = !navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  });

  let show = $derived(offline || $portalState.stale);
</script>

{#if show}
  <div class="mx-auto max-w-6xl px-4 pt-3">
    <div
      class="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs font-semibold text-warning"
      role="status"
    >
      {#if offline}
        <CloudOff class="h-4 w-4 shrink-0" aria-hidden="true" />
        {$tr('offline_notice')}
      {:else}
        <Info class="h-4 w-4 shrink-0" aria-hidden="true" />
        {$tr('stale_notice')}
      {/if}
    </div>
  </div>
{/if}
