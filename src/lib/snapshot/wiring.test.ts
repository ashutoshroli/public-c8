// ====== The snapshot is wired in where it should be, and nowhere it should not ======
//
// facts.test.ts proves the text is right and AccountsText.test.ts proves the hand-over works. This
// file checks the plumbing around them from the source: which pages carry the section, that the
// data cannot reach a browser as JavaScript, and that the files built from the snapshot (sitemap
// `lastmod`, llms.txt, llms-full.txt) say what they should — and say nothing when there is none.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsePortalData } from '$lib/api/schema';
import { ROUTES, sitemapXml, canonicalFor } from '$lib/seo';
import { llmsTxt, llmsFullTxt } from '$lib/crawlerFiles';
import { PAGE_KEYS, factsForPage, type PageKey, type Snapshot } from './facts';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const SITE = 'https://chhath.shaharpura.com';
const NOW = new Date('2026-10-14T06:00:00Z');

// ---------------------------------------------------------------------- which pages

const PAGE_FILE: Record<PageKey, string> = {
  home: 'routes/+page.svelte',
  expenses: 'routes/expenses/+page.svelte',
  loans: 'routes/loans/+page.svelte',
  committee: 'routes/committee/+page.svelte',
  contributors: 'routes/contributors/+page.svelte',
  decade: 'routes/decade/+page.svelte',
};
const PAGE_PATH: Record<PageKey, string> = {
  home: '', expenses: '/expenses', loans: '/loans', committee: '/committee', contributors: '/contributors', decade: '/decade',
};

describe('the six data pages carry the section; no other page does', () => {
  for (const key of PAGE_KEYS) {
    it(`${PAGE_FILE[key]} renders <AccountsText page="${key}" />`, () => {
      const src = read(PAGE_FILE[key]);
      expect(src).toContain("import AccountsText from '$lib/components/AccountsText.svelte';");
      expect((src.match(/<AccountsText\b/g) || []).length, 'exactly once').toBe(1);
      expect(src).toContain(`<AccountsText page="${key}" />`);
    });
  }

  it('the pages with no figures in them (guide, privacy, donate …) do not', () => {
    const all = readdirSync(join(SRC, 'routes'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(SRC, 'routes', d.name, '+page.svelte')))
      .map((d) => `routes/${d.name}/+page.svelte`);
    const carrying = new Set(Object.values(PAGE_FILE));
    const others = all.filter((f) => !carrying.has(f));
    expect(others.length).toBeGreaterThanOrEqual(6);
    for (const f of others) expect(read(f), `${f} should not carry the section`).not.toContain('AccountsText');
  });

  it('the section sits OUTSIDE the error/empty branches, so it shows even when the live load failed', () => {
    for (const key of ['expenses', 'loans', 'committee'] as PageKey[]) {
      const src = read(PAGE_FILE[key]);
      expect(src.indexOf('<AccountsText'), `${key}: after the last {/if}`).toBeGreaterThan(src.lastIndexOf('{/if}'));
    }
    const home = read(PAGE_FILE.home);
    expect(home.indexOf('<AccountsText')).toBeGreaterThan(home.indexOf('<ErrorState />'));
  });

  it('the route table marks exactly these pages as carrying data (that is what gives them a lastmod)', () => {
    const flagged = ROUTES.filter((r) => r.data).map((r) => r.path).sort();
    expect(flagged).toEqual(Object.values(PAGE_PATH).sort());
  });
});

// ------------------------------------------------------------ the data stays on the server

describe('the build’s data cannot reach a browser as JavaScript', () => {
  it('only one module imports the virtual payload, and it is the server-side snapshot', () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|svelte|js)$/.test(e.name) && !/\.test\./.test(e.name)) {
          // Comments are stripped first: vitePlugin.ts quotes the import statement in its header.
          const code = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
          if (/\bimport\b[^;]*from ['"]virtual:cpm-build-payload['"]/.test(code)) importers.push(p.slice(SRC.length + 1));
        }
      }
    };
    walk(SRC);
    expect(importers).toEqual(['lib/snapshot/index.ts']);
  });

  it('the only thing that leaves the server is the name-free facts, via the carrier block', () => {
    const rt = read('lib/snapshot/runtime.ts');
    expect(rt).toMatch(/snapshot\.pages\[page\]/);
    expect(rt, 'the carrier never sees the raw payload').not.toMatch(/payload/);
    const comp = read('lib/components/AccountsText.svelte');
    expect(comp).toMatch(/\{#if !browser && pre\}/);
    expect(comp, 'the section must read the carrier before the template can remove it').toMatch(/const pre = untrack\(\(\) => prerenderedFacts\(page\)\);/);
  });

  it('the Vite config documents why a failed fetch stops the build', () => {
    expect(read('../vite.config.ts')).toMatch(/failed fetch fails the build on purpose/);
  });
});

// -------------------------------------------------------------------------- the sitemap

describe('sitemap lastmod', () => {
  const withDate = sitemapXml(SITE, { lastmod: '2026-10-14' });

  it('is the snapshot date on the six pages that carry it, and on no others', () => {
    const entries = withDate.split('<url>').slice(1);
    for (const e of entries) {
      const loc = /<loc>([^<]+)<\/loc>/.exec(e)![1];
      const route = ROUTES.find((r) => canonicalFor(SITE, r.path) === loc)!;
      expect(e.includes('<lastmod>2026-10-14</lastmod>'), `${loc}`).toBe(!!route.data);
    }
    expect((withDate.match(/<lastmod>/g) || []).length).toBe(6);
  });

  it('puts lastmod where the sitemap schema wants it: after loc, before changefreq', () => {
    expect(withDate).toMatch(/<loc>[^<]+<\/loc><lastmod>[^<]+<\/lastmod><changefreq>/);
  });

  it('has none at all when the build had no snapshot — a date nobody can vouch for is worse than none', () => {
    expect(sitemapXml(SITE)).not.toContain('lastmod');
    expect(sitemapXml(SITE, {})).not.toContain('lastmod');
    expect(sitemapXml(SITE, { lastmod: undefined })).not.toContain('lastmod');
  });

  it('the endpoint passes the snapshot’s date', () => {
    const ep = read('routes/sitemap.xml/+server.ts');
    expect(ep).toMatch(/sitemapXml\(config\.siteUrl, \{ lastmod: snapshot\?\.asOf \}\)/);
  });
});

// ---------------------------------------------------------------------------- llms files

function fixtureSnapshot(): Snapshot {
  const data = parsePortalData({
    users: [{ ID: 'USER0001', Name: 'Ravi Verma', 'Name (Hindi)': 'रवि वर्मा', Village: 'Shaharpura', Mobile: '9876500001' }],
    collections: [{ Name: 'USER0001', Year: 2025, Amount: 500, 'Contribution Type': '1' }],
    expenses: [{ Year: 2025, Discription: 'Banner', 'Discription (Hindi)': 'बैनर', Amount: 100 }],
    loans: [{ Year: 2025, Name: 'USER0001', Amount: 1000, 'Intrest Rate': 2, Tenure: 10, Status: 'Active', 'Loan ID': 'L1' }],
  })!;
  const pages = {} as Snapshot['pages'];
  for (const k of PAGE_KEYS) pages[k] = factsForPage(k, data, 2025, NOW);
  return { asOf: '2026-10-14', builtAt: NOW.toISOString(), year: 2025, version: '1', pages };
}

describe('llms.txt and llms-full.txt', () => {
  it('llms.txt links the full text first, with its date, only when there is a snapshot', () => {
    const withText = llmsTxt(SITE, { fullTextAsOf: '2026-10-14' });
    const pages = withText.split('\n').filter((l) => l.startsWith('- ['));
    expect(pages[0]).toContain(`[The accounts in plain text](${SITE}/llms-full.txt)`);
    expect(pages[0]).toContain('as of 14 Oct 2026 (IST)');
    expect(llmsTxt(SITE)).not.toContain('llms-full.txt');
    expect(llmsTxt(SITE, {})).not.toContain('llms-full.txt');
  });

  it('llms-full.txt has one section per data page, each pointing at its page, in the pages’ own words', () => {
    const md = llmsFullTxt(SITE, fixtureSnapshot());
    expect(md.startsWith('# Chhath Puja Transparency Portal — the accounts in plain text\n')).toBe(true);
    const headings = md.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual([
      '## Home — 2025', '## Contributors List — 2025', '## Expenses Ledger — 2025',
      '## Surplus Loan Distribution — 2025', '## Active Committee — 2025', '## 10 Years of Chhath — 2017 → 2026',
    ]);
    for (const key of PAGE_KEYS) expect(md).toContain(`Page: ${canonicalFor(SITE, PAGE_PATH[key])}`);
    expect(md).toContain('Banner — ₹100');
    expect(md).toContain('[Loan rules and process](https://chhath.shaharpura.com/loan-rules)');
  });

  it('speaks to a reader of a file, not to a visitor of a page', () => {
    const md = llmsFullTxt(SITE, fixtureSnapshot());
    expect(md).not.toContain('Live figures replace these');
    expect(md).toContain('Figures for 2025, as of 14 Oct 2026 (IST), from the committee’s ledger.');
    expect(md).toContain('People’s names, contact details and individual amounts are left out on purpose');
  });

  it('names no one', () => {
    const md = llmsFullTxt(SITE, fixtureSnapshot());
    for (const s of ['Ravi', 'Verma', 'रवि', 'वर्मा', '9876500001', 'USER0001']) expect(md, s).not.toContain(s);
  });

  it('says plainly that there is no snapshot, and does not invent one', () => {
    const md = llmsFullTxt(SITE, null);
    expect(md).toContain('No plain-text snapshot of the accounts was produced');
    expect(md).not.toMatch(/₹/);
    expect(md.split('\n').filter((l) => l.startsWith('## '))).toEqual([]);
  });

  it('both endpoints are prerendered and pass the snapshot through', () => {
    for (const f of ['routes/llms.txt/+server.ts', 'routes/llms-full.txt/+server.ts']) {
      const ep = read(f);
      expect(ep, f).toMatch(/export const prerender = true/);
      expect(ep, f).toMatch(/from '\$lib\/snapshot'/);
      expect(ep, f).toMatch(/text\/plain; charset=utf-8/);
    }
  });
});

// ---------------------------------------------------------------------------- the docs

describe('the emergency switches are written down where the committee will look', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const envExample = readFileSync(join(ROOT, '.env.example'), 'utf8');

  it('README explains the refresh, the failure policy and both variables', () => {
    expect(readme).toMatch(/Redeploy/);
    expect(readme).toContain('CPM_SNAPSHOT_ALLOW_EMPTY');
    expect(readme).toContain('CPM_SNAPSHOT=off');
    expect(readme).toMatch(/previous deployment/);
  });

  it('.env.example lists them, commented out, so they are never on by accident', () => {
    expect(envExample).toMatch(/^# CPM_SNAPSHOT=off$/m);
    expect(envExample).toMatch(/^# CPM_SNAPSHOT_ALLOW_EMPTY=1$/m);
    expect(envExample).not.toMatch(/^CPM_SNAPSHOT/m);
  });
});
