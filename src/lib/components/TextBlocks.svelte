<script lang="ts">
  /**
   * The paragraphs and bullet lists of a written-up section (lib/snapshot/text.ts). Shared by the
   * "accounts in words" box under each data page and by the year pages, so that the two cannot
   * draw the same sentence differently.
   */
  import type { Block } from '$lib/snapshot/text';

  let { blocks }: { blocks: Block[] } = $props();
</script>

{#each blocks as block}
  {#if block.kind === 'p'}
    <p>{block.text}</p>
  {:else}
    {#if block.title}<p class="font-semibold">{block.title}</p>{/if}
    <ul class="list-disc space-y-1 pl-5">
      {#each block.items as item}<li>{item}</li>{/each}
    </ul>
  {/if}
{/each}
