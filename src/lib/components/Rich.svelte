<script lang="ts">
  /**
   * Renders a translated string, turning **double-asterisk** parts into <strong>. Plain text
   * (no markers) renders as-is. Only a split on `**` — never innerHTML — so copy can never
   * inject markup.
   */
  interface Props {
    text: string;
  }
  let { text }: Props = $props();
  let parts = $derived(text.split('**'));
</script>

{#each parts as part, i (i)}{#if i % 2 === 1}<strong class="font-bold text-ink">{part}</strong>{:else}{part}{/if}{/each}
