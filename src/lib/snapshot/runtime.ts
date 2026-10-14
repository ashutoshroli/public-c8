// ====== How a component gets the snapshot, on the server and in the browser ======
//
// The text is rendered into the HTML at build time from `snapshot`. The browser has to produce the
// SAME markup when it hydrates, or Svelte would have to repair it, so it needs the same facts —
// but the facts are not in the JavaScript (index.ts is null there, on purpose). The server
// therefore leaves them in the page as an inert JSON block, and the browser reads that block once,
// before it hydrates.
//
//   <script type="application/json" id="cpm-snapshot-expenses">{"asOf":"…","facts":{…}}</script>
//
// A page reached by client-side navigation has no such block (the HTML that was loaded was another
// page's), and needs none: by then the live data is normally loaded, and the section simply waits
// for it.

import { browser } from '$app/environment';
import { snapshot } from './index';
import type { PageFacts, PageKey, YearPack } from './facts';

export interface Prerendered {
  asOf: string;
  facts: PageFacts;
}

const carrierId = (page: PageKey) => `cpm-snapshot-${page}`;

function isFacts(page: PageKey, v: unknown): v is PageFacts {
  return !!v && typeof v === 'object' && (v as { kind?: unknown }).kind === page;
}

/** What this page was prerendered with, or null when it was not (dev, escape hatch, client navigation). */
export function prerenderedFacts(page: PageKey): Prerendered | null {
  if (!browser) {
    return snapshot ? { asOf: snapshot.asOf, facts: snapshot.pages[page] } : null;
  }
  try {
    const el = document.getElementById(carrierId(page));
    if (!el?.textContent) return null;
    const parsed = JSON.parse(el.textContent) as { asOf?: unknown; facts?: unknown };
    if (typeof parsed.asOf !== 'string' || !isFacts(page, parsed.facts)) return null;
    return { asOf: parsed.asOf, facts: parsed.facts };
  } catch {
    return null;
  }
}

/** The inert JSON block for `{@html}` in <svelte:head>. `<` is escaped so no value can close the tag. */
export function carrierScript(page: PageKey, pre: Prerendered): string {
  const json = JSON.stringify({ asOf: pre.asOf, facts: pre.facts }).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${carrierId(page)}">${json}</script>`;
}

// ---------------------------------------------------------------------------- a year page

/** What a year page (/2025, /hi/2025) was prerendered with: its pack, and the years that have a page. */
export interface PrerenderedYear {
  asOf: string;
  pack: YearPack;
  /** Every year with a page, newest first: the page links to its neighbours from this. */
  years: number[];
}

const yearCarrierId = (year: number) => `cpm-snapshot-year-${year}`;

function isYearPack(year: number, v: unknown): v is YearPack {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<Record<keyof YearPack, { kind?: unknown } | number | null>>;
  const kind = (k: 'home' | 'contributors' | 'expenses' | 'loans' | 'committee') => (p[k] as { kind?: unknown } | undefined)?.kind === k;
  return p.year === year && kind('home') && kind('contributors') && kind('expenses') && kind('loans') && kind('committee');
}

/** What this year page was prerendered with, or null (a year with no page, dev, client navigation). */
export function prerenderedYear(year: number): PrerenderedYear | null {
  if (!browser) {
    const pack = snapshot?.byYear[year];
    return snapshot && pack ? { asOf: snapshot.asOf, pack, years: snapshot.years } : null;
  }
  try {
    const el = document.getElementById(yearCarrierId(year));
    if (!el?.textContent) return null;
    const parsed = JSON.parse(el.textContent) as { asOf?: unknown; pack?: unknown; years?: unknown };
    if (typeof parsed.asOf !== 'string' || !isYearPack(year, parsed.pack)) return null;
    if (!Array.isArray(parsed.years) || !parsed.years.every((y) => Number.isInteger(y))) return null;
    return { asOf: parsed.asOf, pack: parsed.pack, years: parsed.years as number[] };
  } catch {
    return null;
  }
}

/** The inert JSON block for a year page, for `{@html}` in <svelte:head>. */
export function yearCarrierScript(year: number, pre: PrerenderedYear): string {
  const json = JSON.stringify({ asOf: pre.asOf, pack: pre.pack, years: pre.years }).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${yearCarrierId(year)}">${json}</script>`;
}
