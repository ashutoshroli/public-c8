<script lang="ts">
  /**
   * Small shared footer link row: Contributors · 10 Years · User Guide · Loan rules · Privacy ·
   * Terms · Cookie settings. Rendered by Shell, so it appears on every page. Inherits the
   * surrounding footer's text colour (currentColor). "Cookie settings" reopens the
   * analytics-cookie choice at any time.
   *
   * Contributors and 10 Years are here for a reason beyond convenience: they were reachable only
   * through buttons inside other pages, and those buttons render once the data has loaded — so
   * the prerendered HTML that a crawler reads linked to neither. The footer is in the HTML of
   * every page, which gives both a plain <a href> from everywhere on the site.
   */
  import { tr, lp } from '$lib/stores/lang';
  import { consentPanelOpen } from '$lib/analytics/consent';

  const linkClass = 'underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100';
</script>

<nav class="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" aria-label="Footer">
  <a href={$lp('/contributors')} class={linkClass}>{$tr('contributors_list')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <a href={$lp('/decade')} class={linkClass}>{$tr('decade_title')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <a href={$lp('/guide')} class={linkClass}>{$tr('guide_footer_link')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <a href={$lp('/loan-rules')} class={linkClass}>{$tr('footer_loan_rules')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <a href={$lp('/privacy')} class={linkClass}>{$tr('footer_privacy')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <a href={$lp('/terms')} class={linkClass}>{$tr('footer_terms')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <button type="button" class={linkClass} onclick={() => consentPanelOpen.set(true)}>{$tr('footer_cookies')}</button>
</nav>
