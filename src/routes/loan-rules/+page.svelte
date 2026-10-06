<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { tr } from '$lib/stores/lang';
  import {
    GUARANTOR_COUNT_SINCE,
    COMMITTEE_GUARANTOR_BAN_FROM_YEAR,
    PORTAL_CONSENT_FROM_YEAR,
    WHATSAPP_CONSENT_UNTIL_YEAR
  } from '$lib/loanRules';

  // Every year shown on this page comes from loanRules.ts — none is typed into the copy.
  const yearVars = {
    whatsapp_until: WHATSAPP_CONSENT_UNTIL_YEAR,
    portal_from: PORTAL_CONSENT_FROM_YEAR,
    ban_year: COMMITTEE_GUARANTOR_BAN_FROM_YEAR
  };

  // One card per rule: title, the year chip, then its paragraphs.
  const rules = [
    { title: 'lr_r_three', chip: 'lr_from_least', year: GUARANTOR_COUNT_SINCE, paras: ['lr_n_three'] },
    {
      title: 'lr_r_committee',
      chip: 'lr_from',
      year: COMMITTEE_GUARANTOR_BAN_FROM_YEAR,
      paras: ['lr_n_committee_1', 'lr_n_committee_2']
    },
    { title: 'lr_r_whatsapp', chip: 'lr_until', year: WHATSAPP_CONSENT_UNTIL_YEAR, paras: ['lr_n_whatsapp'] },
    {
      title: 'lr_r_portal',
      chip: 'lr_from',
      year: PORTAL_CONSENT_FROM_YEAR,
      paras: ['lr_n_portal_1', 'lr_n_portal_2', 'lr_n_portal_3']
    }
  ];
</script>

<svelte:head>
  <title>{$tr('loan_rules_subtitle')} — {$tr('app_title')}</title>
</svelte:head>

<PageHeading titleKey="app_subtitle" subtitle={$tr('loan_rules_subtitle')} />

<article class="surface space-y-3 p-5 text-sm leading-relaxed text-ink">
  <p>{$tr('lr_intro_1')}</p>
  <p>{$tr('lr_intro_2')}</p>

  <h2 class="text-base font-bold text-ink">{$tr('lr_elig_h')}</h2>
  <ul class="list-disc space-y-1 pl-5">
    {#each [1, 2, 3, 4, 5, 6] as n (n)}
      <li>{$tr(`lr_elig_${n}`)}</li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tr('lr_steps_h')}</h2>
  <ol class="list-decimal space-y-1 pl-5">
    <li>{$tr('lr_step1')}</li>
    <li>{$tr('lr_step2')}</li>
    <li>{$tr('lr_step3')}</li>
    <li>
      {$tr('lr_step4')}
      <ul class="mt-1 list-disc space-y-1 pl-5">
        <li>{$tr('lr_step4_a', yearVars)}</li>
        <li>{$tr('lr_step4_b', yearVars)}</li>
      </ul>
    </li>
    <li>{$tr('lr_step5')}</li>
    <li>{$tr('lr_step6')}</li>
  </ol>

  <h2 class="text-base font-bold text-ink">{$tr('lr_since_h')}</h2>
  <p class="text-muted">{$tr('lr_since_note')}</p>
  <ul class="space-y-2">
    {#each rules as r (r.title)}
      <li class="rounded-lg border border-line p-3">
        <p class="font-bold">{$tr(r.title)}</p>
        <p class="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
          {$tr(r.chip, { year: r.year })}
        </p>
        {#each r.paras as para (para)}
          <p class="mt-1.5 text-xs text-muted">{$tr(para, yearVars)}</p>
        {/each}
      </li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tr('lr_n25_h')}</h2>
  <ul class="list-disc space-y-1 pl-5">
    {#each [1, 2, 3, 4, 5, 6, 7] as n (n)}
      <li>{$tr(`lr_n25_${n}`)}</li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tr('lr_pay_h')}</h2>
  {#each [1, 2, 3, 4, 5] as n (n)}
    <p>{$tr(`lr_pay_${n}`, yearVars)}</p>
  {/each}

  <h2 class="text-base font-bold text-ink">{$tr('lr_about_h')}</h2>
  {#each [1, 2, 3] as n (n)}
    <p class="text-muted">{$tr(`lr_about_${n}`)}</p>
  {/each}
  <p>
    <a href="/loans" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('lr_back_loans')}</a>
  </p>
</article>
