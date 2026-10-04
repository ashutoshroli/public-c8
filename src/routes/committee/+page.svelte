<script lang="ts">
  import { MapPin, Phone, MessageCircle, LogIn } from '@lucide/svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import SkeletonList from '$lib/components/SkeletonList.svelte';
  import { portalState, year } from '$lib/stores/portal';
  import { tr, lang } from '$lib/stores/lang';
  import { committeeForYear } from '$lib/api/derive';
  import { initials, avatarGradient } from '$lib/utils/format';
  import { mgmtLoginUrl } from '$lib/api/client';
  import { telHref, whatsappUrl } from '$lib/contact';

  let loading = $derived($portalState.status === 'loading');
  let members = $derived(committeeForYear($portalState.data, $year));

  const nameOf = (m: { name: string; nameHindi: string }) =>
    $lang === 'hi' && m.nameHindi ? m.nameHindi : m.name;
  const roleOf = (m: { role: string; roleHindi: string; designation: string; designationHindi: string }) => {
    if ($lang === 'hi') return m.roleHindi || m.designationHindi || m.role || m.designation || $tr('member');
    return m.role || m.designation || $tr('member');
  };
  const villageOf = (m: { village: string; villageHindi: string }) =>
    $lang === 'hi' && m.villageHindi ? m.villageHindi : m.village;
</script>

<svelte:head>
  <title>{$tr('active_committee')} — {$tr('app_title')}</title>
</svelte:head>

<div class="flex items-start justify-between gap-3">
  <PageHeading titleKey="active_committee" />
  <a href={mgmtLoginUrl} target="_blank" rel="noopener" class="btn-primary flex-none">
    <LogIn class="h-4 w-4" aria-hidden="true" />
    {$tr('login')}
  </a>
</div>

{#if $portalState.failed}
  <ErrorState />
{:else if loading}
  <SkeletonList rows={5} />
{:else if members.length === 0}
  <EmptyState message={$tr('no_committee')} />
{:else}
  <ul class="rows sm:grid sm:grid-cols-2 sm:divide-y-0">
    {#each members as m, i (m.seed + '-' + i)}
      {@const grad = avatarGradient(m.seed)}
      <li class="flex items-center gap-3 border-line px-4 py-3.5 sm:border-b sm:[&:nth-last-child(-n+2)]:border-b-0">
        <span
          class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white"
          style="background-image: linear-gradient(135deg, {grad[0]}, {grad[1]})"
          aria-hidden="true"
        >{initials(nameOf(m))}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold">{nameOf(m) || $tr('na')}</p>
          <p class="truncate text-xs font-semibold text-brand-700">{roleOf(m)}</p>
          <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
            {#if villageOf(m)}
              <span class="inline-flex items-center gap-1"><MapPin class="h-3 w-3" aria-hidden="true" />{villageOf(m)}</span>
            {/if}
            {#if m.mobile}
              <a href={telHref(m.mobile)} class="inline-flex items-center gap-1 hover:text-brand-700">
                <Phone class="h-3 w-3" aria-hidden="true" />{m.mobile}
              </a>
            {/if}
          </div>
        </div>
        {#if m.mobile}
          <!-- Two 40px tap targets: call and WhatsApp. Hidden when the committee has not
               published a number for this member. -->
          <div class="flex flex-none items-center gap-2">
            <a
              href={telHref(m.mobile)}
              aria-label={$tr('call_member', { name: nameOf(m) })}
              class="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
            >
              <Phone class="h-[18px] w-[18px]" aria-hidden="true" />
            </a>
            {#if whatsappUrl(m.mobile)}
              <a
                href={whatsappUrl(m.mobile)}
                target="_blank"
                rel="noopener"
                aria-label={$tr('whatsapp_member', { name: nameOf(m) })}
                class="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                <MessageCircle class="h-[18px] w-[18px]" aria-hidden="true" />
              </a>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
