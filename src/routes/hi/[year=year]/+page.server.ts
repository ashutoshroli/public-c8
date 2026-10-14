// Which years get a prerendered page (in Hindi): every year the build's snapshot has records for
// (lib/snapshot). With no snapshot — dev, or CPM_SNAPSHOT=off — there are none, and a year is
// then drawn in the browser from the live data instead.
//
// This file exports no `load`, so these pages need no `__data.json` request: the data comes from
// the portal's own store, the same as every other page.
import { snapshot } from '$lib/snapshot';

export const prerender = true;

export function entries() {
  return (snapshot?.years ?? []).map((y) => ({ year: String(y) }));
}
