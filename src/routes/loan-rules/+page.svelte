<script lang="ts">
  import PageHeading from '$lib/components/PageHeading.svelte';
  import Rich from '$lib/components/Rich.svelte';
  // Imported as `tl`: a store named `tr` would make Svelte read the <tr> table-row tags as components.
  import { tr as tl } from '$lib/stores/lang';
  import { CONTACT_EMAIL } from '$lib/contact';
  import {
    GUARANTOR_COUNT_SINCE,
    COMMITTEE_GUARANTOR_BAN_FROM_YEAR,
    PORTAL_CONSENT_FROM_YEAR,
    WHATSAPP_CONSENT_UNTIL_YEAR,
    INTEREST_10_MONTHS_UNTIL_YEAR,
    INTEREST_11_MONTHS_FROM_YEAR,
    GUARANTOR_ARGHYA_FROM_YEAR
  } from '$lib/loanRules';

  // Every year shown on this page comes from loanRules.ts — none is typed into the copy.
  const yearVars = {
    whatsapp_until: WHATSAPP_CONSENT_UNTIL_YEAR,
    portal_from: PORTAL_CONSENT_FROM_YEAR,
    ban_year: COMMITTEE_GUARANTOR_BAN_FROM_YEAR,
    interest_until: INTEREST_10_MONTHS_UNTIL_YEAR,
    arghya_from: GUARANTOR_ARGHYA_FROM_YEAR,
    email: CONTACT_EMAIL
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

  // Two columns (year | change) so it stays readable on a phone.
  const timeline = [
    { when: 'lr_from_least', year: GUARANTOR_COUNT_SINCE, text: 'lr_t_three' },
    { when: 'lr_from', year: COMMITTEE_GUARANTOR_BAN_FROM_YEAR, text: 'lr_t_committee' },
    { when: 'lr_until', year: INTEREST_10_MONTHS_UNTIL_YEAR, text: 'lr_t_int10' },
    { when: 'lr_from', year: INTEREST_11_MONTHS_FROM_YEAR, text: 'lr_t_int11' },
    { when: 'lr_until', year: WHATSAPP_CONSENT_UNTIL_YEAR, text: 'lr_t_wa' },
    { when: 'lr_from', year: PORTAL_CONSENT_FROM_YEAR, text: 'lr_t_portal' },
    { when: 'lr_from', year: GUARANTOR_ARGHYA_FROM_YEAR, text: 'lr_t_arghya' }
  ];
</script>

<svelte:head>
  <title>{$tl('loan_rules_subtitle')} — {$tl('app_title')}</title>
</svelte:head>

<PageHeading titleKey="app_subtitle" subtitle={$tl('loan_rules_subtitle')} />

<article class="surface space-y-3 p-5 text-sm leading-relaxed text-ink">
  <p>{$tl('lr_intro_1')}</p>
  <p>{$tl('lr_intro_2')}</p>

  <!-- The single most important rule for reading old loans, so it is a box, not a paragraph. -->
  <div class="rounded-lg border border-brand-200 bg-brand-50 p-3" role="note">
    <p class="font-bold text-brand-800">{$tl('lr_principle_h')}</p>
    <p class="mt-1">{$tl('lr_principle_p')}</p>
  </div>

  <h2 class="text-base font-bold text-ink">{$tl('lr_elig_h')}</h2>
  <ul class="list-disc space-y-1 pl-5">
    {#each [1, 2, 3, 4, 5, 6] as n (n)}
      <li>{$tl(`lr_elig_${n}`)}</li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tl('lr_steps_h')}</h2>
  <ol class="list-decimal space-y-1 pl-5">
    <li>{$tl('lr_step1')}</li>
    <li>{$tl('lr_step2')}</li>
    <li>{$tl('lr_step3')}</li>
    <li>
      {$tl('lr_step4')}
      <ul class="mt-1 list-disc space-y-1 pl-5">
        <li>{$tl('lr_step4_a', yearVars)}</li>
        <li>{$tl('lr_step4_b', yearVars)}</li>
      </ul>
    </li>
    <li>{$tl('lr_step5')}</li>
    <li>{$tl('lr_step6')}</li>
  </ol>
  <p class="text-muted">{$tl('lr_bid_note')}</p>
  <p class="text-muted">{$tl('lr_tie')}</p>

  <h2 class="text-base font-bold text-ink">{$tl('lr_int_h')}</h2>
  <p><Rich text={$tl('lr_int_1')} /></p>
  <p class="rounded-lg bg-canvas p-3 text-sm">{$tl('lr_int_ex')}</p>

  <h2 class="text-base font-bold text-ink">{$tl('lr_since_h')}</h2>
  <p class="text-muted">{$tl('lr_since_note')}</p>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-left text-sm">
      <caption class="sr-only">{$tl('lr_t_h')}</caption>
      <thead>
        <tr class="border-b border-line text-xs text-muted">
          <th scope="col" class="py-1.5 pr-3 font-semibold">{$tl('lr_t_year_col')}</th>
          <th scope="col" class="py-1.5 font-semibold">{$tl('lr_t_change_col')}</th>
        </tr>
      </thead>
      <tbody>
        {#each timeline as row (row.text)}
          <tr class="border-b border-line last:border-0">
            <th scope="row" class="whitespace-nowrap py-1.5 pr-3 align-top font-bold text-brand-700">{$tl(row.when, { year: row.year })}</th>
            <td class="py-1.5">{$tl(row.text)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <ul class="space-y-2">
    {#each rules as r (r.title)}
      <li class="rounded-lg border border-line p-3">
        <p class="font-bold">{$tl(r.title)}</p>
        <p class="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
          {$tl(r.chip, { year: r.year })}
        </p>
        {#each r.paras as para (para)}
          <p class="mt-1.5 text-xs text-muted">{$tl(para, yearVars)}</p>
        {/each}
      </li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tl('lr_n25_h')}</h2>
  <ul class="list-disc space-y-1 pl-5">
    {#each [1, 2, 3, 4, 5, 6, 7] as n (n)}
      <li><Rich text={$tl(`lr_n25_${n}`)} /></li>
    {/each}
  </ul>

  <h2 class="text-base font-bold text-ink">{$tl('lr_pay_h')}</h2>
  {#each [1, 2, 3] as n (n)}
    <p><Rich text={$tl(`lr_pay_${n}`, yearVars)} /></p>
  {/each}

  <h2 class="text-base font-bold text-ink">{$tl('lr_about_h')}</h2>
  {#each [1, 2, 3] as n (n)}
    <p class="text-muted">{$tl(`lr_about_${n}`)}</p>
  {/each}
  <p>
    {$tl('lr_contact_p', yearVars)}
    <a href="mailto:{CONTACT_EMAIL}" class="font-semibold text-brand-700 underline underline-offset-2">{CONTACT_EMAIL}</a>
  </p>
  <p>
    <a href="/committee" class="font-semibold text-brand-700 underline underline-offset-2">{$tl('contact_committee_link')}</a>
    ·
    <a href="/loans" class="font-semibold text-brand-700 underline underline-offset-2">{$tl('lr_back_loans')}</a>
  </p>
</article>
