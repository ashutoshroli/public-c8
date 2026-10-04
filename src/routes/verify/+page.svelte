<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import VerifyContent from '$lib/components/VerifyContent.svelte';
  import { tr } from '$lib/stores/lang';
</script>

<svelte:head>
  <title>{$tr('verify_title')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="verify_title" subtitle={$tr('verify_subtitle')} />
<VerifyContent />
