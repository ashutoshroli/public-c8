<script lang="ts">
  /**
   * "The accounts in words": the figures of a data page written out as plain sentences, at the
   * bottom of the page.
   *
   * Why it exists. This is a static site whose pages are drawn in the browser from an API, so the
   * HTML a search engine or an AI system downloads used to be an empty frame with skeletons in it.
   * Most of them do not run the page's JavaScript, and those that do give up quickly. This section
   * is the accounts in the HTML itself, so they can read them.
   *
   * It is not a second copy that can disagree with the page. It shows ONE set of figures at a time,
   * produced by one function (lib/snapshot/facts.ts):
   *   - until the live data has loaded: the build-time snapshot, labelled with its date;
   *   - once it has: the same sentences from the data the visitor just loaded, labelled live;
   *   - offline or on a last-known-good copy: the saved data, labelled as saved.
   * Visitors keep the live figures they always had; a redeploy only refreshes the snapshot.
   *
   * It names no one: counts, totals, roles, and villages large enough not to point at a person.
   */
  import { untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { portalState, year } from '$lib/stores/portal';
  import { lang, tr } from '$lib/stores/lang';
  import { factsForPage, type PageFacts, type PageKey } from '$lib/snapshot/facts';
  import { accountsText, type Source } from '$lib/snapshot/text';
  import { carrierScript, prerenderedFacts } from '$lib/snapshot/runtime';
  import { istDate } from '$lib/snapshot/ist';
  import TextBlocks from './TextBlocks.svelte';

  let { page }: { page: PageKey } = $props();

  // What this page was prerendered with. Read ONCE, here, before the template runs: in the
  // browser it comes from a JSON block in <head> that Svelte removes while it hydrates, so a later
  // read would find nothing. (`page` never changes for a mounted section, hence untrack.)
  const pre = untrack(() => prerenderedFacts(page));

  let view = $derived.by((): { facts: PageFacts; source: Source } | null => {
    const s = $portalState;
    if (s.status === 'ready' && !s.failed) {
      const source: Source =
        s.stale || s.source === 'snapshot'
          ? { kind: 'saved', asOf: istDate(new Date(s.savedAt || Date.now())) }
          : { kind: 'live' };
      return { facts: factsForPage(page, s.data, $year, new Date()), source };
    }
    return pre ? { facts: pre.facts, source: { kind: 'snapshot', asOf: pre.asOf } } : null;
  });

  let model = $derived(view ? accountsText(view.facts, $lang, view.source) : null);
</script>

<svelte:head>
  {#if !browser && pre}
    <!-- Server only: hands the snapshot facts to the browser so it hydrates to the same markup. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags — a JSON string built by carrierScript, `<` escaped -->
    {@html carrierScript(page, pre)}
  {/if}
</svelte:head>

{#if model}
  <section
    class="surface mt-8 space-y-3 p-5 text-sm leading-relaxed text-ink"
    aria-labelledby="accounts-text-{page}"
    data-accounts-text={page}
  >
    <h2 id="accounts-text-{page}" class="text-base font-bold text-ink">{model.heading}</h2>
    <p class="text-xs text-muted">{model.note}</p>
    <TextBlocks blocks={model.blocks} />
    {#if model.years}
      <!-- A page for each year: this is where a reader (or a crawler) finds them. -->
      <nav aria-label={model.years.title}>
        <p class="font-semibold">{model.years.title}</p>
        <ul class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {#each model.years.items as y}
            <li><a href={y.href} class="font-semibold text-brand-700 underline underline-offset-2">{y.label}</a></li>
          {/each}
        </ul>
      </nav>
    {/if}
    {#if model.seeAlso}
      <p>
        {$tr('acc_see_also')}:
        <a href={model.seeAlso.href} class="font-semibold text-brand-700 underline underline-offset-2">{model.seeAlso.label}</a>
      </p>
    {/if}
  </section>
{/if}
