// ====== page structure, a way past the chrome, tables, and motion (v8: one shell) ======
// @vitest-environment jsdom
//
// v6 carried these checks once per skin. v8 has ONE shell (components/Shell.svelte) and the
// pages live directly in src/routes, so each check runs once against those files:
//
//  1. a skip link that is hidden until focused and lands on a focusable <main>
//  2. every route renders exactly one h1 (PageHeading counts as one)
//  3. the decade figures are an ARIA table
//  4. LiveScroll's rAF loop stops when paused / hovered / hidden / reduced-motion
//  5. the fixed bottom bar clears the iOS home indicator

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const ROUTES = readdirSync(join(SRC, 'routes'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(SRC, 'routes', d.name, '+page.svelte')))
  .map((d) => `routes/${d.name}/+page.svelte`)
  .concat(['routes/+page.svelte']);

// -------------------------------------------------------- 1. A WAY PAST THE CHROME

describe('the shell offers a skip link', () => {
  const shell = read('lib/components/Shell.svelte');

  it('points at a focusable <main id="main">', () => {
    expect(shell, 'no href="#main"').toMatch(/href="#main"/);
    expect(shell, '<main> must carry id="main"').toMatch(/<main[^>]*\bid="main"/);
    expect(shell, '<main> needs tabindex="-1" to accept programmatic focus').toMatch(/<main[^>]*tabindex="-1"/);
  });

  it('is hidden until focused', () => {
    const link = /<a[\s\S]*?href="#main"[\s\S]*?>/.exec(shell)![0];
    expect(link).toMatch(/\bsr-only\b/);
    expect(link).toMatch(/focus:not-sr-only/);
  });
});

// --------------------------------------------------------- 2. ONE h1 PER PAGE

describe('every route has exactly one h1', () => {
  it('finds the routes (guards against a vacuous pass)', () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(12);
  });

  for (const f of ROUTES) {
    it(`${f}: has a heading and declares at most one`, () => {
      const src = read(f);
      const own = (src.match(/<h1\b/g) || []).length;
      const viaComponent = src.includes('<PageHeading') ? 1 : 0;
      // Home carries two <h1>s on purpose: an sr-only one on the error branch and the visible
      // headline on the ready branch. They sit in mutually exclusive {#if}/{:else} branches.
      const max = f === 'routes/+page.svelte' ? 2 : 1;
      expect(own + viaComponent, `${f} declares ${own + viaComponent} h1s`).toBeGreaterThanOrEqual(1);
      expect(own + viaComponent, `${f} declares ${own + viaComponent} h1s`).toBeLessThanOrEqual(max);
    });
  }
});

// ------------------------------------------------------- 3. THE DECADE TABLE

describe('the decade figures are a table', () => {
  const src = read('routes/decade/+page.svelte');

  it('rows and columns are associated', () => {
    expect(src).toMatch(/role="table"/);
    expect(src, 'the table must be named').toMatch(/aria-labelledby="decade-table-h"/);
    expect(src).toMatch(/id="decade-table-h"/);
    expect((src.match(/role="row"/g) || []).length, 'a header row and a data row').toBeGreaterThanOrEqual(2);
    expect((src.match(/role="columnheader"/g) || []).length, 'year, total, contributors').toBe(3);
    expect((src.match(/role="cell"/g) || []).length).toBe(3);
  });

  it('keeps the grid layout', () => {
    expect((src.match(/grid-cols-\[1fr_1\.4fr_1fr\]/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

// -------------------------------------------------- 4 & 5. MOTION AND BATTERY

describe('the live scroller stops when it should', () => {
  const SRC_TEXT = read('lib/components/LiveScroll.svelte');

  it('the rAF loop is guarded by a derived "should animate", not restarted unconditionally', () => {
    expect(SRC_TEXT, 'a derived gate is what lets the effect stop').toMatch(/let shouldAnimate = \$derived\(/);
    // The old shape scheduled the next frame as the FIRST statement, before any check.
    const effect = /\$effect\(\(\) => \{[\s\S]*?shouldAnimate[\s\S]*?\}\);/.exec(SRC_TEXT);
    expect(effect, 'no effect reads shouldAnimate').toBeTruthy();
    expect(effect![0]).toMatch(/if \(!browser \|\| !shouldAnimate\) return;/);
  });

  it('reduced-motion is a subscription, not a one-off read', () => {
    expect(SRC_TEXT, 'without a change listener the setting only applies on reload')
      .toMatch(/addEventListener\('change'/);
    // Old Safari has no addEventListener on MediaQueryList, and committee phones are old.
    expect(SRC_TEXT).toMatch(/addListener\?\.\(/);
  });

  it('tab visibility is tracked, because document.hidden is not reactive', () => {
    expect(SRC_TEXT).toMatch(/visibilitychange/);
  });

  it('the duplicated half of the track is inert, not merely aria-hidden', () => {
    // aria-hidden alone left the copies in the TAB ORDER: a keyboard user went through every
    // contributor twice, and half of them announced nothing.
    expect(SRC_TEXT).toMatch(/inert=\{isDuplicate\}/);
    expect(SRC_TEXT).toMatch(/aria-hidden=\{isDuplicate \? 'true' : undefined\}/);
  });

  it('the pause control is still there and still says which state it is in', () => {
    expect(SRC_TEXT).toMatch(/aria-pressed=\{userPaused\}/);
    expect(SRC_TEXT).toMatch(/userPaused \? \$tr\('play'\) : \$tr\('pause'\)/);
  });
});

// ----------------------------------------------------------- 6. SAFE AREA

describe('the bottom nav clears the home-area inset', () => {
  it('the fixed bar has safe-area padding', () => {
    const shell = read('lib/components/Shell.svelte');
    expect(shell).toMatch(/fixed inset-x-0 bottom/);
    expect(shell, 'a bar pinned to bottom-0 sits under the iOS home indicator without this')
      .toMatch(/env\(safe-area-inset-bottom\)/);
  });
});

// ------------------------------------------- 7. THE SKIP LINK ACTUALLY MOVES FOCUS

describe('the skip link works, not just exists', () => {
  let host: HTMLDivElement;
  let app: ReturnType<typeof mount> | null = null;

  beforeEach(() => { document.body.innerHTML = ''; host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { if (app) { unmount(app); app = null; } });

  it('focusing #main from the link is possible because main takes tabindex="-1"', () => {
    // A behavioural check on the mechanism rather than on a mounted shell: the shells need
    // stores, routing and a theme to mount, and what can actually go wrong here is a <main>
    // that refuses programmatic focus.
    host.innerHTML = `<a href="#main">skip</a><main id="main" tabindex="-1">content</main>`;
    const main = host.querySelector('main')!;
    main.focus();
    expect(document.activeElement, 'without tabindex="-1" this stays on <body>').toBe(main);
  });

  it('a <main> WITHOUT tabindex cannot take focus — which is why the attribute is asserted above', () => {
    host.innerHTML = `<main id="nope">content</main>`;
    const main = host.querySelector('main')!;
    main.focus();
    expect(document.activeElement).not.toBe(main);
  });
});
