<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { tr, lang } from '$lib/stores/lang';
  import { CONTACT_EMAIL } from '$lib/contact';
  import { POLICY_LAST_UPDATED, formatPolicyDate } from '$lib/policyDates';
  import Rich from '$lib/components/Rich.svelte';

  let orgVars = $derived({ org_name: $tr('org_name'), org_location: $tr('org_location') });
  let dateVars = $derived({ updated: formatPolicyDate(POLICY_LAST_UPDATED, $lang) });
  const contactVars = { email: CONTACT_EMAIL };
</script>

<svelte:head>
  <title>{$tr('terms_subtitle')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="terms_subtitle" subtitle={$tr('org_name')} />

<article class="surface space-y-3 p-5 text-sm leading-relaxed text-ink">
  <p class="text-xs text-muted">{$tr('policy_dates', dateVars)}</p>
  <p>{$tr('terms_intro', orgVars)}</p>
  <h2 class="text-base font-bold text-ink">{$tr('terms_use_h')}</h2>
  <p>{$tr('terms_use_p')}</p>
  <h2 class="text-base font-bold text-ink">{$tr('terms_docs_h')}</h2>
  <p>{$tr('terms_docs_p')}</p>
  <h2 class="text-base font-bold text-ink">{$tr('terms_donations_h')}</h2>
  <p><Rich text={$tr('terms_donations_p')} /></p>
  <h2 class="text-base font-bold text-ink">{$tr('terms_misuse_h')}</h2>
  <p>{$tr('terms_misuse_p')}</p>
  <h2 class="text-base font-bold text-ink">{$tr('terms_contact_h')}</h2>
  <p>{$tr('terms_contact_p', contactVars)}</p>
  <p>
    <a href="mailto:{CONTACT_EMAIL}" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('privacy_email')}: {CONTACT_EMAIL}</a>
  </p>
  <p>
    <a href="/committee" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('contact_committee_link')}</a>
  </p>
  <h2 class="text-base font-bold text-ink">{$tr('terms_law_h')}</h2>
  <p>{$tr('terms_law_p')}</p>
  <p>
    <a href="/privacy" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('terms_see_privacy')}</a>
  </p>
  <p>{$tr('terms_closing')}</p>
</article>
