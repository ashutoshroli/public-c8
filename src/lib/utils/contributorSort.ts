/**
 * The order of the Contributors page, for each option in its sort dropdown.
 *
 * `rankedContributors()` hands the list back in ENTRY (SL No.) order on purpose — the home rail
 * and the list popup show the ledger order, with the Top-5 flagged where they stand. The
 * Contributors page has a sort control, so IT re-orders that list here. It used to do so for
 * "Low → High" and "Name" only: "High → Low" applied nothing, so the page that opened on
 * "Amount: High → Low" showed ₹151, ₹501, ₹301, ₹351 … in ledger order.
 *
 * What is guaranteed, for every option:
 *  - Only the ORDER changes. Each entry is passed through as it is, so a person's rank and Top-5
 *    badge are the ones the amounts gave them, whatever position they are shown in.
 *  - The input is not modified; a new array comes back.
 *  - Names are compared as the reader SEES them — the Hindi name on the Hindi page (when there is
 *    one), the English name otherwise — with that language's collation. Sorting Hindi names by
 *    their English spelling looks, to a Hindi reader, like no sort at all.
 *  - People who tie are never left in ledger order (that is the very thing that made the sort look
 *    broken): they follow A → Z, in BOTH directions. Only if two people share the same name too
 *    does the ledger order decide, so the result is the same on every run.
 *  - Someone who gave goods or a service but no money has no amount to compare (the card shows
 *    none), so they come AFTER everyone who has one, in both directions. Putting them first on
 *    "Low → High" would hide the smallest real gifts under a run of cards with no figure on them.
 */
import type { Contributor } from '$lib/api/derive';
import type { Ranked } from '$lib/utils/ranking';

export type ContributorSortKey = 'amount_desc' | 'amount_asc' | 'name';
export type SortLanguage = 'en' | 'hi';

/** The name the card shows for this person in this language. */
export function shownName(c: Pick<Contributor, 'name' | 'nameHindi'>, lang: SortLanguage): string {
  return lang === 'hi' && c.nameHindi ? c.nameHindi : c.name;
}

export function sortContributors(
  list: readonly Ranked<Contributor>[],
  key: ContributorSortKey,
  lang: SortLanguage
): Ranked<Contributor>[] {
  const collator = new Intl.Collator(lang === 'hi' ? 'hi' : 'en');
  const byName = (a: Ranked<Contributor>, b: Ranked<Contributor>): number =>
    collator.compare(shownName(a.item, lang), shownName(b.item, lang)) || a.item.order - b.item.order;

  const out = [...list];
  if (key === 'name') return out.sort(byName);

  const direction = key === 'amount_desc' ? -1 : 1;
  return out.sort((a, b) => {
    if (a.item.hasMoney !== b.item.hasMoney) return a.item.hasMoney ? -1 : 1;
    if (a.item.amount !== b.item.amount) return direction * (a.item.amount - b.item.amount);
    return byName(a, b);
  });
}
