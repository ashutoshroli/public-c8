<script lang="ts">
  /**
   * Small shared footer link row: User Guide · Privacy · Terms · Cookie settings. Rendered by
   * Shell, so it appears on every page. Inherits the surrounding footer's text colour
   * (currentColor). "Cookie settings" reopens the analytics-cookie choice at any time.
   */
  import { tr } from '$lib/stores/lang';
  import { consentPanelOpen } from '$lib/analytics/consent';

  const linkClass = 'underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100';
</script>

<nav class="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" aria-label="Footer">
  <a href="/guide" class={linkClass}>{$tr('guide_footer_link')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <a href="/privacy" class={linkClass}>{$tr('footer_privacy')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <a href="/terms" class={linkClass}>{$tr('footer_terms')}</a>
  <span class="opacity-40" aria-hidden="true">·</span>
  <button type="button" class={linkClass} onclick={() => consentPanelOpen.set(true)}>{$tr('footer_cookies')}</button>
</nav>
