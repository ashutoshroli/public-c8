<script lang="ts">
  /**
   * Analytics-cookie consent. Shown on the first visit and whenever "Cookie settings" in the
   * footer is pressed. Non-modal on purpose (no focus trap): the portal stays fully usable
   * without answering, and nothing analytics-related loads until the visitor says Accept.
   */
  import { onMount } from 'svelte';
  import { tr } from '$lib/stores/lang';
  import {
    consent,
    consentPanelOpen,
    readConsent,
    writeConsent,
    loadGtm,
    gtmLoaded,
    clearAnalyticsCookies
  } from '$lib/analytics/consent';
  import { pushPageView } from '$lib/analytics/pageview';

  onMount(() => {
    const saved = readConsent();
    consent.set(saved);
    if (saved === 'granted') loadGtm(); // no-op when app.html already loaded it
    if (saved === null) consentPanelOpen.set(true);
  });

  function accept() {
    writeConsent('granted');
    consent.set('granted');
    consentPanelOpen.set(false);
    if (loadGtm()) {
      // GTM missed the first page view (it was not loaded yet), so push it now.
      pushPageView(location.pathname + location.search, document.title);
    }
  }

  function decline() {
    const wasLoaded = gtmLoaded();
    writeConsent('denied');
    consent.set('denied');
    consentPanelOpen.set(false);
    if (wasLoaded) {
      // Scripts that are already running cannot be unloaded: drop their cookies and reload clean.
      clearAnalyticsCookies();
      location.reload();
    }
  }
</script>

{#if $consentPanelOpen}
  <div
    role="region"
    aria-label={$tr('consent_title')}
    class="consent-banner surface fixed inset-x-3 z-50 p-4 shadow-lg lg:inset-x-auto lg:right-4 lg:w-96"
  >
    <p class="text-sm font-bold text-ink">{$tr('consent_title')}</p>
    <p class="mt-1 text-xs leading-relaxed text-muted">
      {$tr('consent_text')}
      <a href="/privacy#cookies" class="font-semibold text-brand-700 underline underline-offset-2">{$tr('consent_details')}</a>
    </p>
    <div class="mt-3 flex gap-2">
      <button type="button" class="chip flex-1 justify-center" onclick={decline}>{$tr('consent_decline')}</button>
      <button type="button" class="btn-primary flex-1" onclick={accept}>{$tr('consent_accept')}</button>
    </div>
  </div>
{/if}
