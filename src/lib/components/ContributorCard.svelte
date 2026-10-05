<script lang="ts">
  import type { Ranked } from '$lib/utils/ranking';
  import { contributorTags, type Contributor } from '$lib/api/derive';
  import { fmt, initials, avatarGradient } from '$lib/utils/format';
  import { lang, tr } from '$lib/stores/lang';

  interface Props {
    entry: Ranked<Contributor>;
    /** compact = home rail size; false = full directory grid size */
    compact?: boolean;
    onclick?: () => void;
  }
  let { entry, compact = true, onclick }: Props = $props();

  let c = $derived(entry.item);
  let displayName = $derived($lang === 'hi' && c.nameHindi ? c.nameHindi : c.name);
  let grad = $derived(avatarGradient(c.key));
  let tags = $derived(contributorTags(c));
  let nonMoneyTags = $derived(tags.filter((t) => t !== 'money') as Array<'material' | 'service'>);
  const tagLabel = (t: 'material' | 'service') => (t === 'material' ? $tr('material') : $tr('service'));

  let photoFailed = $state(false);
  $effect(() => {
    void c.photo;
    photoFailed = false;
  });
</script>

<button
  type="button"
  {onclick}
  class="relative flex flex-col items-center rounded-xl border bg-white p-3 text-center transition-colors hover:bg-canvas
    {entry.isTop ? 'border-gold' : 'border-line'}
    {compact ? 'w-[108px] shrink-0' : 'w-full'}"
>
  {#if entry.isTop}
    <span
      class="absolute left-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-extrabold text-white"
      aria-label="Rank {entry.rank}"
    >{entry.rank}</span>
  {/if}

  {#if c.photo && !photoFailed}
    <img
      src={c.photo}
      alt={displayName}
      loading="lazy"
      decoding="async"
      width="44"
      height="44"
      class="h-11 w-11 rounded-full object-cover"
      onerror={() => (photoFailed = true)}
    />
  {:else}
    <span
      class="grid h-11 w-11 place-items-center rounded-full text-sm font-extrabold text-white"
      style="background-image: linear-gradient(135deg, {grad[0]}, {grad[1]})"
      aria-hidden="true"
    >{initials(displayName)}</span>
  {/if}

  <span class="mt-2 line-clamp-1 w-full text-[12px] font-bold" title={displayName}>{displayName}</span>

  {#if c.hasMoney}
    <span class="mt-0.5 text-sm font-extrabold text-brand-700">{fmt(c.amount)}</span>
  {/if}
  {#if nonMoneyTags.length}
    <span class="mt-0.5 flex flex-wrap justify-center gap-1">
      {#each nonMoneyTags as t}
        <span class="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-bold text-info">{tagLabel(t)}</span>
      {/each}
    </span>
  {/if}
  {#if c.count > 1}
    <span class="mt-0.5 text-[10px] font-semibold text-muted">{$tr('times_contributed', { count: c.count })}</span>
  {/if}
  {#if entry.isTop}
    <span class="mt-1 text-[10px] font-bold text-gold">{$tr('top5')}</span>
  {/if}
</button>
