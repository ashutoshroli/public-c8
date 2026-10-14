// A safety net for the one free-text column the snapshot publishes: expense descriptions.
//
// Everything else in the text snapshot is a count, a total or a role, so no person can appear in
// it. An expense line ("DJ & Lighting — ₹24,000") is different: the committee types the words,
// and nothing stops a future entry reading "Paid to Ramesh Kumar" or "Call 98xxxxxxxx". The live
// ledger shows whatever was typed; the snapshot is copied by search engines and AI systems that
// keep what they read, so it is held to the stricter rule: no names, no contact details.
//
// A line that trips the guard is not dropped. Its amount still counts, in "Other items", so the
// totals stay true; only its words are withheld.
//
// This is deliberately a net, not a promise. It knows the people in the `users` table. It cannot
// know a supplier who is not in it, which is why the build log lists how many lines were held back
// and the PR asks the committee to read the published lines once.

import type { UserRow } from '$lib/api/schema';

/**
 * Organisations (not people) whose NAME the committee has approved for publication.
 *
 * The contributors list holds institutions as well as people — a school that lent its sound system
 * for the ghat is a row in it, like anyone else — and the guard cannot tell the two apart: it holds
 * back any text that contains a name from that list. An institution is not a person, and the
 * committee's own story of a year may thank one by name (2017 does).
 *
 * So this list is the committee's explicit decision, one organisation at a time, and nothing is
 * inferred: a name that merely looks like an institution ("… School", "… Trust") stays guarded
 * until it is written here. Adding one is a code change that is reviewed, not a side effect of
 * someone typing a name into the Journey tab.
 *
 * What it frees is the NAME, in both scripts — the organisation's row is left out of the guard
 * whole, so its Hindi spelling is freed with its English one. A year's story may then say it. (A
 * short expense line is still checked word by word against every OTHER name in the list.) It frees
 * nothing else: the organisation's own record (what it gave, when) is never in the HTML, because
 * the facts hold no individual's rows, person or organisation.
 *
 *   - Genius Public School — approved by the committee, 14 Oct 2026 (the 2017 story).
 */
export const APPROVED_ORGANISATIONS: readonly string[] = ['Genius Public School'];

/**
 * Words that are also people's names, but are far likelier here to be what was bought.
 * "Prasad" is an offering at a Chhath ghat as much as a given name; folding every "Prasad" line
 * would hide a real expense to protect no one.
 */
const NOT_A_NAME = new Set(['prasad', 'puja', 'pooja', 'chhath', 'ghat', 'ganga']);

/** Single name words shorter than this are too common to mean a person ("Raj", "Om", "Lal"). */
const MIN_TOKEN = 5;

/** A description longer than this is prose rather than a ledger line, and prose is where names hide. */
export const MAX_LINE_CHARS = 60;

// Everything that is not part of a word: whitespace, and any punctuation or symbol in ANY script —
// including the Devanagari danda (।), which ends a Hindi sentence right after a name, and the curly
// quotes a word processor produces. (Combining marks and the zero-width joiners inside Devanagari
// words are neither punctuation nor symbols, so a word stays whole.)
const SPLIT = /[\p{P}\p{S}\s]+/u;

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (s: string) => norm(s).split(SPLIT).filter(Boolean);

/** Ten or more digits in a row (allowing spaces and dashes) is a phone number; '@' is an email. Digits of any script count: ९८७६५४३२१०. */
const PHONE = /(?:\+?\p{Nd}[\s-]?){10,}/u;

export interface NameGuard {
  /**
   * True when the text must not be published as written: it contains a known person's name (the
   * whole name, or any distinctive word of it), a phone number or an email. For SHORT ledger lines.
   */
  mentionsPersonOrContact(text: string): boolean;
  /**
   * The same check for PROSE, which is looser on purpose: it looks for a known person's WHOLE name,
   * a phone number or an email, not for single words. Real user names include words like "Public"
   * and "School" and "Contribution"; matching those in a paragraph about the committee's year would
   * withhold a harmless sentence every time it said "public". A whole name in a paragraph is the
   * case that matters, and the one this catches.
   */
  mentionsFullNameOrContact(text: string): boolean;
}

export function buildNameGuard(
  users: ReadonlyArray<UserRow> | undefined,
  approved: readonly string[] = APPROVED_ORGANISATIONS,
): NameGuard {
  const tokens = new Set<string>();
  const fullNames = new Set<string>();
  const freed = new Set(approved.map((n) => words(n).join(' ')).filter(Boolean));

  for (const u of users ?? []) {
    // An approved organisation's row is left out whole, so the Hindi spelling of its name is freed
    // together with the English one.
    if ((['Name', 'Name (Hindi)'] as const).some((f) => freed.has(words((u[f] ?? '').toString()).join(' ')))) continue;
    for (const field of ['Name', 'Name (Hindi)'] as const) {
      const raw = (u[field] ?? '').toString();
      const w = words(raw);
      if (w.length >= 2) fullNames.add(w.join(' '));
      for (const t of w) {
        if ([...t].length >= MIN_TOKEN && !NOT_A_NAME.has(t) && !/^\d+$/.test(t)) tokens.add(t);
      }
    }
  }

  const mentionsFullNameOrContact = (text: string): boolean => {
    const t = (text ?? '').toString();
    if (!t.trim()) return false;
    if (t.includes('@') || PHONE.test(t)) return true;
    // Every separator becomes one space (`words` splits on ALL of them: a comma, an apostrophe or a
    // full stop right after a name must not hide it — "Thanks to Ram Kumar, our president").
    const flat = ` ${words(t).join(' ')} `;
    // Whole words, so "ram kumar" is not found inside "program kumarapuram".
    for (const full of fullNames) if (flat.includes(` ${full} `)) return true;
    return false;
  };

  return {
    mentionsFullNameOrContact,
    mentionsPersonOrContact(text: string): boolean {
      const t = (text ?? '').toString();
      if (!t.trim()) return false;
      if (mentionsFullNameOrContact(t)) return true;
      for (const w of words(t)) if (tokens.has(w)) return true;
      return false;
    },
  };
}
