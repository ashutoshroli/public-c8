<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { tr, lang } from '$lib/stores/lang';
  import { POLICY_LAST_UPDATED, formatPolicyDate } from '$lib/policyDates';
  import { consentPanelOpen } from '$lib/analytics/consent';
  import { CONTACT_EMAIL } from '$lib/contact';

  let orgVars = $derived({ org_name: $tr('org_name'), org_location: $tr('org_location') });
  // Corrections and removal requests go to one email address, not a phone number.
  const vars = { email: CONTACT_EMAIL };
  let dateVars = $derived({ updated: formatPolicyDate(POLICY_LAST_UPDATED, $lang) });
</script>

<svelte:head>
  <title>{$tr('privacy_subtitle')} — {$tr('app_title')}</title>
</svelte:head>

<!-- The H1 is the PAGE's name. It used to be "Transparency Portal" (the site tagline) with the real
     name demoted to the subtitle, so the heading a crawler and a screen-reader user rely on was the
     same on /privacy, /terms and /loan-rules. -->
<PageHeading titleKey="privacy_subtitle" subtitle={$tr('org_name')} />

<article class="surface space-y-3 p-5 text-sm leading-relaxed text-ink">
  <p class="text-xs text-muted">{$tr('policy_dates', dateVars)}</p>
  <p>{$tr('privacy_intro', orgVars)}</p>
  <h2 class="text-base font-bold text-ink">{$tr('privacy_show_h')}</h2>
  <p>{$tr('privacy_show_p')}</p>
  <h2 class="text-base font-bold text-ink">{$tr('privacy_data_h')}</h2>
  <p>{$tr('privacy_data_p')}</p>

  <!-- audit PR-44: every thing the portal actually does is stated plainly, including the live
       third-party dependencies (Google Analytics, Microsoft Clarity) rather than only the ones that
       are comfortable to describe. A test pins the list so a section cannot quietly disappear.
       The `id`s make /privacy#cookies (linked from the consent banner) land on its section. -->
  {#each ['published', 'cookies', 'push', 'offline', 'thirdparty', 'security', 'retention', 'rights'] as section (section)}
    <h2 id={section} class="scroll-mt-20 text-base font-bold text-ink">{$tr(`privacy_${section}_h`)}</h2>
    <p>{$tr(`privacy_${section}_p`, vars)}</p>
    {#if section === 'cookies'}
      <button type="button" class="chip" onclick={() => consentPanelOpen.set(true)}>{$tr('privacy_cookie_change')}</button>
    {/if}
  {/each}

  <p>{$tr('privacy_contact_p', vars)}</p>
  <p>
    <a
      href="mailto:{CONTACT_EMAIL}"
      class="font-semibold text-brand-700 underline underline-offset-2"
    >{$tr('privacy_email')}: {CONTACT_EMAIL}</a>
  </p>
  <p>
    <a href="/committee" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('contact_committee_link')}</a>
  </p>
  <p>
    <a href="/terms" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('privacy_see_terms')}</a>
  </p>
</article>
