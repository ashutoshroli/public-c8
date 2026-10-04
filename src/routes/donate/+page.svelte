<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import DonateContent from '$lib/components/DonateContent.svelte';
  import { tr } from '$lib/stores/lang';
</script>

<svelte:head>
  <title>{$tr('donate_title')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="donate_title" subtitle={$tr('donate_subtitle')} />
<DonateContent />
