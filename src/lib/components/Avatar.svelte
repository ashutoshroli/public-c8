<script lang="ts">
  /**
   * Round contributor avatar. The initials circle is ALWAYS rendered underneath; the photo is
   * layered on top and stays invisible (opacity 0) until the browser has fully decoded it
   * (`load`). So while a photo is still downloading the row shows the initials instead of an
   * empty hole, then the photo fades in. If the image fails, it is removed and the initials
   * simply stay.
   */
  import { initials, avatarGradient, shouldShowPhoto } from '$lib/utils/format';

  interface Props {
    photo?: string | null;
    /** Display name — alt text for the photo and source of the initials. */
    name: string;
    /** Stable key that picks the gradient colour. */
    seed?: string;
    /** Diameter in px (also the intrinsic width/height of the <img>, which prevents layout shift). */
    size?: number;
    /** Tailwind text-size class for the initials. */
    textClass?: string;
    lazy?: boolean;
  }
  let { photo = '', name, seed = '', size = 40, textClass = 'text-sm', lazy = true }: Props = $props();

  let grad = $derived(avatarGradient(seed));
  let loaded = $state(false);
  let failed = $state(false);
  let img = $state<HTMLImageElement | undefined>();

  // A new photo URL starts a new download: show the fallback again until it has loaded.
  $effect.pre(() => {
    void photo;
    loaded = false;
    failed = false;
  });

  // A cached image can be `complete` before the load listener is attached.
  $effect(() => {
    if (img && img.complete && img.naturalWidth > 0) loaded = true;
  });
</script>

<span class="relative inline-block shrink-0" style="width:{size}px;height:{size}px">
  <span
    class="grid h-full w-full place-items-center rounded-full font-extrabold text-white {textClass}"
    style="background-image: linear-gradient(135deg, {grad[0]}, {grad[1]})"
    aria-hidden="true"
  >{initials(name)}</span>
  {#if shouldShowPhoto(photo, failed)}
    {#key photo}
      <img
        bind:this={img}
        src={photo}
        alt={name}
        loading={lazy ? 'lazy' : undefined}
        decoding="async"
        width={size}
        height={size}
        class="absolute inset-0 h-full w-full rounded-full object-cover transition-opacity duration-200 motion-reduce:transition-none
          {loaded ? 'opacity-100' : 'opacity-0'}"
        onload={() => (loaded = true)}
        onerror={() => (failed = true)}
      />
    {/key}
  {/if}
</span>
