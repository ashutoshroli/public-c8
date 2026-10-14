<script lang="ts">
  /**
   * A real error page (audit PR-42).
   *
   * There was none, so an unknown path fell through to the SPA fallback and rendered the HOME
   * PAGE. A visitor who mistyped a URL saw the portal and no indication anything was wrong, and
   * a crawler following a stale link indexed the home page's content under the wrong URL.
   *
   * THE STATUS CODE: this is a statically hosted site, so the status comes from the host, not from
   * this component. `adapter-static` writes the fallback page as `404.html` (svelte.config.js), and
   * Vercel serves a root `404.html` with a genuine HTTP 404 for any URL that is not a prerendered
   * page. That page boots the app, the client router finds no route, and THIS component renders —
   * so a visitor reads the message below while a crawler sees the 404 status. (It used to be
   * `200.html`, served with status 200 for every unknown path: a soft 404.) The `noindex` below
   * stays as a second line of defence for the one case the host cannot cover — a returning
   * visitor's service worker answering a navigation from its cached app shell.
   */
  import { page } from '$app/stores';
  import { tr } from '$lib/stores/lang';
  import { Home, AlertTriangle } from '@lucide/svelte';

  let status = $derived($page.status);
  let notFound = $derived(status === 404);
</script>

<svelte:head>
  <title>{notFound ? $tr('error_404_title') : $tr('error_generic_title')} — {$tr('app_title')}</title>
  <!-- An error page must never be indexed, whatever status the host returns. -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
  <span class="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
    <AlertTriangle class="h-7 w-7" aria-hidden="true" />
  </span>
  <h1 class="text-xl font-extrabold">
    {notFound ? $tr('error_404_title') : $tr('error_generic_title')}
  </h1>
  <p class="text-sm text-muted">
    {notFound ? $tr('error_404_body') : $tr('error_generic_body')}
  </p>
  <a
    href="/"
    class="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"
  >
    <Home class="h-4 w-4" aria-hidden="true" />
    {$tr('error_back_home')}
  </a>
</div>
