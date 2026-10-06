<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { tr } from '$lib/stores/lang';
  import {
    GUARANTOR_COUNT_SINCE,
    COMMITTEE_GUARANTOR_BAN_FROM_YEAR,
    PORTAL_CONSENT_FROM_YEAR,
    WHATSAPP_CONSENT_UNTIL_YEAR
  } from '$lib/loanRules';

  const yearVars = {
    whatsapp_until: WHATSAPP_CONSENT_UNTIL_YEAR,
    portal_from: PORTAL_CONSENT_FROM_YEAR
  };

  // One card per rule, each with the year it applies from (all years come from loanRules.ts).
  const rules = [
    { rule: 'lr_r_three', when: 'lr_from_least', year: GUARANTOR_COUNT_SINCE, note: '' },
    { rule: 'lr_r_committee', when: 'lr_from', year: COMMITTEE_GUARANTOR_BAN_FROM_YEAR, note: 'lr_n_committee' },
    { rule: 'lr_r_whatsapp', when: 'lr_until', year: WHATSAPP_CONSENT_UNTIL_YEAR, note: 'lr_n_whatsapp' },
    { rule: 'lr_r_portal', when: 'lr_from', year: PORTAL_CONSENT_FROM_YEAR, note: 'lr_n_portal' }
  ];
</script>

<svelte:head>
  <title>{$tr('loan_rules_subtitle')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="app_subtitle" subtitle={$tr('loan_rules_subtitle')} />

<article class="surface space-y-3 p-5 text-sm leading-relaxed text-ink">
  <p>{$tr('lr_intro')}</p>

  <h2 class="text-base font-bold text-ink">{$tr('lr_steps_h')}</h2>
  <ol class="list-decimal space-y-1 pl-5">
    {#each [1, 2, 3, 4, 5] as n (n)}
      <li>{$tr(`lr_step${n}`, yearVars)}</li>
    {/each}
  </ol>

  <h2 class="text-base font-bold text-ink">{$tr('lr_since_h')}</h2>
  <p class="text-muted">{$tr('lr_since_note')}</p>
  <ul class="space-y-2">
    {#each rules as r (r.rule)}
      <li class="rounded-lg border border-line p-3">
        <p class="font-bold">{$tr(r.rule)}</p>
        <p class="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
          {$tr(r.when, { year: r.year })}
        </p>
        {#if r.note}<p class="mt-1.5 text-xs text-muted">{$tr(r.note)}</p>{/if}
      </li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tr('lr_n25_h')}</h2>
  <ul class="list-disc space-y-1 pl-5">
    {#each [1, 2, 3, 4, 5, 6] as n (n)}
      <li>{$tr(`lr_n25_${n}`)}</li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tr('lr_pay_h')}</h2>
  <p>{$tr('lr_pay_p', yearVars)}</p>

  <p class="text-xs text-muted">{$tr('lr_source')}</p>
  <p>
    <a href="/loans" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('lr_back_loans')}</a>
  </p>
</article>
