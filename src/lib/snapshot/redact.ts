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
 * Words that are also people's names, but are far likelier here to be what was bought.
 * "Prasad" is an offering at a Chhath ghat as much as a given name; folding every "Prasad" line
 * would hide a real expense to protect no one.
 */
const NOT_A_NAME = new Set(['prasad', 'puja', 'pooja', 'chhath', 'ghat', 'ganga']);

/** Single name words shorter than this are too common to mean a person ("Raj", "Om", "Lal"). */
const MIN_TOKEN = 5;

/** A description longer than this is prose rather than a ledger line, and prose is where names hide. */
export const MAX_LINE_CHARS = 60;

const SPLIT = /[\s,.;:()[\]{}"'`!?/\\|&+\-–—_*#@]+/u;

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (s: string) => norm(s).split(SPLIT).filter(Boolean);

/** Ten or more digits in a row (allowing spaces and dashes) is a phone number; '@' is an email. */
const PHONE = /(?:\+?\d[\s-]?){10,}/;

export interface NameGuard {
  /** True when the text must not be published as written. */
  mentionsPersonOrContact(text: string): boolean;
}

export function buildNameGuard(users: ReadonlyArray<UserRow> | undefined): NameGuard {
  const tokens = new Set<string>();
  const fullNames = new Set<string>();

  for (const u of users ?? []) {
    for (const field of ['Name', 'Name (Hindi)'] as const) {
      const raw = (u[field] ?? '').toString();
      const w = words(raw);
      if (w.length >= 2) fullNames.add(w.join(' '));
      for (const t of w) {
        if ([...t].length >= MIN_TOKEN && !NOT_A_NAME.has(t) && !/^\d+$/.test(t)) tokens.add(t);
      }
    }
  }

  return {
    mentionsPersonOrContact(text: string): boolean {
      const t = (text ?? '').toString();
      if (!t.trim()) return false;
      if (t.includes('@') || PHONE.test(t)) return true;
      const flat = norm(t).replace(SPLIT, ' ').trim();
      for (const full of fullNames) if (flat.includes(full)) return true;
      for (const w of words(t)) if (tokens.has(w)) return true;
      return false;
    },
  };
}
