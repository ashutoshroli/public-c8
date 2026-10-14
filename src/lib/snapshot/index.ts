// ====== The snapshot, as the server bundle sees it ======
//
// `payload` is the raw API response the build fetched (vitePlugin.ts). Here it becomes the
// name-free facts for each page. In the browser bundle `payload` is always null, so `snapshot` is
// null there and nothing from the API is in the JavaScript a visitor downloads.

import payload from 'virtual:cpm-build-payload';
import { parsePortalData } from '$lib/api/schema';
import {
  expensesFacts,
  PAGE_KEYS,
  defaultYear,
  factsForPage,
  storyWithheld,
  yearPack,
  yearsWithRecords,
  type PageFacts,
  type PageKey,
  type Snapshot,
  type YearPack,
} from './facts';
import { istDate } from './ist';

export type { Snapshot } from './facts';

function build(): Snapshot | null {
  if (!payload) return null;
  const data = parsePortalData(payload.data);
  if (!data) return null;

  const when = new Date(payload.fetchedAt);
  const year = defaultYear(data, when);
  const pages = {} as Record<PageKey, PageFacts>;
  for (const key of PAGE_KEYS) pages[key] = factsForPage(key, data, year, when);

  // One page per year that has records: /2025 and /hi/2025.
  const years = yearsWithRecords(data);
  const byYear: Record<number, YearPack> = {};
  for (const y of years) byYear[y] = yearPack(data, y, when);

  // Said in the build log, so the committee can see what was published without opening a page.
  // (SvelteKit evaluates the server bundle twice per build, so these lines appear twice.)
  const ex = expensesFacts(data, year);
  const stories = years.filter((y) => byYear[y].story).length;
  const heldStories = years.filter((y) => storyWithheld(data, y));
  // eslint-disable-next-line no-console
  console.info(
    `[snapshot] ${istDate(when)} IST, year ${year}: ${ex.items.length} expense line(s) published as written` +
      (ex.folded.count ? `, ${ex.folded.count} held back as "Other items" (they name someone or contain a contact detail)` : '') +
      '.',
  );
  // eslint-disable-next-line no-console
  console.info(
    `[snapshot] ${years.length} year page(s): ${years.join(', ') || 'none'}; ${stories} year story(ies) published` +
      (heldStories.length ? `, ${heldStories.length} held back because they name someone (${heldStories.join(', ')})` : '') +
      '.',
  );
  return { asOf: istDate(when), builtAt: payload.fetchedAt, year, version: payload.version, pages, years, byYear };
}

export const snapshot: Snapshot | null = build();
