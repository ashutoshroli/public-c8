<script lang="ts">
  /**
   * One contributor on the Contributors page: a ROW, not a card.
   *
   * The page used to be a grid of small cards — three across on a phone, ~105px each — with the
   * name clamped to ONE line at 12px. On a 360px phone that cut 100 of 137 names off after about
   * twelve letters (42% at 390px, 40% on a tablet that showed six across). A card that narrow
   * cannot hold a name, so the shape changed rather than the font: the name gets the width of the
   * row and wraps onto a second line if it must. It is never clipped — nothing here truncates,
   * clamps or hides overflow.
   *
   *   [avatar]  Full name, however long           ₹1,251
   *   [  ①   ]  Village · 2×                      Top 5
   *
   * Top-5 keep what they had: a gold border, the rank on the avatar, the "Top 5" label. Someone who
   * gave goods or a service but no money has no amount to show, so their tags sit where the amount
   * would be. The name and the village are the ones the reader's language has (the same choice the
   * sort makes, so a sorted list always LOOKS sorted).
   */
  import { contributorTags, type Contributor } from '$lib/api/derive';
  import type { Ranked } from '$lib/utils/ranking';
  import { shownName } from '$lib/utils/contributorSort';
  import { fmt } from '$lib/utils/format';
  import { lang, tr } from '$lib/stores/lang';
  import Avatar from './Avatar.svelte';

  interface Props {
    entry: Ranked<Contributor>;
    onclick?: () => void;
  }
  let { entry, onclick }: Props = $props();

  let c = $derived(entry.item);
  let language = $derived<'en' | 'hi'>($lang === 'hi' ? 'hi' : 'en');
  let name = $derived(shownName(c, language));
  let village = $derived(language === 'hi' && c.villageHindi ? c.villageHindi : c.village);
  let extraTags = $derived(contributorTags(c).filter((t) => t !== 'money') as Array<'material' | 'service'>);
  const tagLabel = (t: 'material' | 'service') => (t === 'material' ? $tr('material') : $tr('service'));
</script>

<button
  type="button"
  {onclick}
  class="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-canvas
    {entry.isTop ? 'border-gold bg-gold/5' : 'border-line bg-white'}"
>
  <span class="relative shrink-0">
    <Avatar photo={c.photo} {name} seed={c.key} size={44} />
    {#if entry.isTop}
      <span
        data-part="rank"
        class="absolute -left-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-extrabold text-amber-900 ring-2 ring-white"
        aria-label="Rank {entry.rank}"
      >{entry.rank}</span>
    {/if}
  </span>

  <span class="min-w-0 flex-1">
    <span data-part="name" class="block break-words text-sm font-bold leading-snug">{name}</span>
    {#if village || c.count > 1}
      <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 break-words text-[11px] text-muted">
        {#if village}<span data-part="village">{village}</span>{/if}
        {#if c.count > 1}
          <span data-part="times" class="rounded bg-canvas px-1 font-semibold">{$tr('times_contributed', { count: c.count })}</span>
        {/if}
      </span>
    {/if}
  </span>

  <span class="flex shrink-0 flex-col items-end gap-1 text-right">
    {#if c.hasMoney}
      <span data-part="amount" class="text-sm font-extrabold tabular-nums text-brand-700">{fmt(c.amount)}</span>
    {/if}
    {#each extraTags as t}
      <span data-part="tag" class="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-bold text-info">{tagLabel(t)}</span>
    {/each}
    {#if entry.isTop}
      <span data-part="top" class="text-[10px] font-bold text-amber-700">{$tr('top5')}</span>
    {/if}
  </span>
</button>
