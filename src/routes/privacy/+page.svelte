<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { tr } from '$lib/stores/lang';
  import { portalState } from '$lib/stores/portal';
  import { donationSettings } from '$lib/api/derive';
  import { consentPanelOpen } from '$lib/analytics/consent';

  let orgVars = $derived({ org_name: $tr('org_name'), org_location: $tr('org_location') });
  // The committee's published WhatsApp number (same one the Donate page shows), for corrections.
  let whatsapp = $derived(donationSettings($portalState.data).whatsapp);
</script>

<svelte:head>
  <title>{$tr('privacy_subtitle')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="app_subtitle" subtitle={$tr('privacy_subtitle')} />

<article class="surface space-y-3 p-5 text-sm leading-relaxed text-ink">
  <p>{$tr('privacy_intro', orgVars)}</p>
  <h2 class="text-base font-bold text-ink">{$tr('privacy_show_h')}</h2>
  <p>{$tr('privacy_show_p')}</p>
  <h2 class="text-base font-bold text-ink">{$tr('privacy_data_h')}</h2>
  <p>{$tr('privacy_data_p')}</p>

  <!-- audit PR-44: every thing the portal actually does is stated plainly, including the live
       third-party dependencies (Google Analytics, Microsoft Clarity) rather than only the ones that
       are comfortable to describe. A test pins the list so a section cannot quietly disappear.
       The `id`s make /privacy#cookies (linked from the consent banner) land on its section. -->
  {#each ['published', 'cookies', 'push', 'offline', 'thirdparty', 'retention', 'rights'] as section (section)}
    <h2 id={section} class="scroll-mt-20 text-base font-bold text-ink">{$tr(`privacy_${section}_h`)}</h2>
    <p>{$tr(`privacy_${section}_p`)}</p>
    {#if section === 'cookies'}
      <button type="button" class="chip" onclick={() => consentPanelOpen.set(true)}>{$tr('privacy_cookie_change')}</button>
    {/if}
  {/each}

  <p>{$tr('privacy_contact_p')}</p>
  {#if whatsapp}
    <p>
      <a
        href="https://wa.me/{whatsapp.replace(/[^0-9]/g, '')}"
        target="_blank"
        rel="noopener"
        class="font-semibold text-brand-700 underline underline-offset-2"
      >{$tr('privacy_whatsapp')}: {whatsapp}</a>
    </p>
  {/if}
  <p>
    <a href="/terms" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('privacy_see_terms')}</a>
  </p>
</article>
