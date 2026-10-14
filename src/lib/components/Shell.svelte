<script lang="ts">
  /**
   * The one portal shell: sticky white header, inline nav on desktop, bottom
   * tab bar on mobile (Home / Expenses / Loans / Menu), quiet footer.
   * No theme picker, no skins, no chatbot.
   */
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { tr, lang, lp } from '$lib/stores/lang';
  import { otherLanguagePath, stripLang, yearOfPath } from '$lib/lang/url';
  import { NAV_ITEMS, NAV_PRIMARY } from './nav';
  import MoreMenu from './MoreMenu.svelte';
  import YearSelect from './YearSelect.svelte';
  import StatusBanner from './StatusBanner.svelte';
  import FooterLinks from './FooterLinks.svelte';

  let { children } = $props();

  // Active state is judged on the address WITHOUT its language: /hi/expenses lights up Expenses.
  const isActive = (href: string, path: string) => {
    const p = stripLang(path);
    return href === '/' ? p === '/' : p.startsWith(href);
  };

  // The language button is a LINK to the same page in the other language, so a crawler (and anyone
  // with scripts off) can follow it, and the Hindi page can be shared or bookmarked.
  //
  // The query and the hash (a receipt's ?record=…) are carried over in the browser only: SvelteKit
  // refuses to let a prerendered page read `url.search`, and there is none to carry at build time.
  const other = $derived(
    otherLanguagePath($page.url.pathname, browser ? $page.url.search : '', browser ? $page.url.hash : '')
  );

  // A year page (/2025) is about the year in its address. The header's year picker would show some
  // other year while the page says 2025, and changing it would change nothing on the page — so it
  // is left out there; the page has its own list of years to move between.
  const onYearPage = $derived(yearOfPath(stripLang($page.url.pathname)) !== null);
</script>

<a
  href="#main"
  class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg
    focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
>{$tr('skip_to_content')}</a>

<header class="sticky top-0 z-40 border-b border-line bg-white">
  <div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
    <a href={$lp('/')} class="flex flex-none items-center gap-2.5" aria-label={$tr('app_title')}>
      <img src="/logo.svg" alt="" width="34" height="34" class="h-[34px] w-[34px] flex-none" />
      <span class="leading-tight">
        <span class="block whitespace-nowrap text-[15px] font-extrabold">{$tr('app_title')}</span>
        <span class="block whitespace-nowrap text-[11px] font-medium text-muted">{$tr('app_subtitle')}</span>
      </span>
    </a>

    <nav class="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
      {#each NAV_ITEMS as item}
        {@const active = isActive(item.href, $page.url.pathname)}
        <a
          href={$lp(item.href)}
          aria-current={active ? 'page' : undefined}
          class="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors
            {active ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-canvas hover:text-ink'}"
        >{$tr(item.key)}</a>
      {/each}
    </nav>

    <div class="ml-auto flex flex-none items-center gap-2">
      <!-- `font-system`: this label is the ONLY Devanagari on an English page. Drawn in the
           device's own font, the 121 kB Noto Devanagari webfont is not downloaded until the
           visitor actually switches to Hindi. -->
      <a
        class="chip font-system"
        href={other.path}
        hreflang={other.lang}
        lang={other.lang}
        data-sveltekit-noscroll
        onclick={() => lang.remember(other.lang)}
        aria-label={$tr('toggle_language')}
        title={$tr('toggle_language')}
      >{other.lang === 'en' ? 'English' : 'हिंदी'}</a>
      {#if !onYearPage}<YearSelect />{/if}
    </div>
  </div>
</header>

<StatusBanner />

<main id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 pb-28 pt-6 lg:pb-12 lg:pt-8">
  {@render children()}
</main>

<footer class="mx-auto max-w-6xl px-4 pb-28 lg:pb-10">
  <div class="flex flex-col items-center gap-2 border-t border-line pt-5 text-center text-xs text-muted sm:flex-row sm:justify-between sm:text-left">
    <p>{$tr('org_name')} · {$tr('org_location')}</p>
    <FooterLinks />
  </div>
</footer>

<nav
  class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white lg:hidden"
  style="padding-bottom: env(safe-area-inset-bottom);"
  aria-label="Primary"
>
  <ul class="mx-auto flex max-w-lg items-stretch justify-around">
    {#each NAV_PRIMARY as item}
      {@const active = isActive(item.href, $page.url.pathname)}
      {@const Icon = item.icon}
      <li class="flex-1">
        <a
          href={$lp(item.href)}
          aria-current={active ? 'page' : undefined}
          class="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold
            {active ? 'text-brand-700' : 'text-muted'}"
        >
          <Icon class="h-5 w-5" aria-hidden="true" />
          {$tr(item.key)}
        </a>
      </li>
    {/each}
    <li class="flex-1">
      <MoreMenu
        activeClass="text-brand-700"
        idleClass="text-muted"
        triggerClass="flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold"
      />
    </li>
  </ul>
</nav>
