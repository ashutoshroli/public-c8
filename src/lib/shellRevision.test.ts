// ====== The offline shell's revision: stable across a snapshot refresh, never stale across a code change ======
//
// If the shell's revision stayed the same while the files it names changed, an installed app would
// keep a shell pointing at chunks the worker had already deleted, and would boot nothing. If it
// changed on every build, a refresh of the accounts snapshot would update every installed app. Both
// failure modes are pinned here.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listFiles, revisionFrom, shellRevision } from './shellRevision';

const APP_HTML = '<html><head>%sveltekit.head%</head></html>';
const FILES = [
  'entry/start.AAA.js', 'entry/app.BBB.js', 'nodes/0.CCC.js', 'nodes/2.DDD.js', 'chunks/EEE.js', 'assets/0.FFF.css',
];

describe('revisionFrom', () => {
  it('is the same for the same files and app.html, whatever order the listing comes in', () => {
    const a = revisionFrom(FILES, APP_HTML);
    expect(revisionFrom([...FILES].reverse(), APP_HTML)).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{20}$/);
  });

  it('changes when a chunk is renamed — a code change, or an env value baked into the JavaScript', () => {
    const a = revisionFrom(FILES, APP_HTML);
    expect(revisionFrom(FILES.map((f) => f.replace('start.AAA', 'start.ZZZ')), APP_HTML)).not.toBe(a);
    expect(revisionFrom([...FILES, 'chunks/NEW.js'], APP_HTML)).not.toBe(a);
    expect(revisionFrom(FILES.slice(1), APP_HTML)).not.toBe(a);
  });

  it('changes when src/app.html changes, because the shell’s <head> is built from it', () => {
    expect(revisionFrom(FILES, APP_HTML + '<!-- new meta -->')).not.toBe(revisionFrom(FILES, APP_HTML));
  });

  it('does not depend on the commit, a timestamp or the snapshot — it takes none of them', () => {
    expect(revisionFrom.length).toBe(2);
  });

  it('refuses an empty listing, which would give every build one revision', () => {
    expect(() => revisionFrom([], APP_HTML)).toThrow(/no files found/);
  });
});

describe('shellRevision reads the real build output', () => {
  const root = mkdtempSync(join(tmpdir(), 'shell-rev-'));
  const immutable = join(root, '.svelte-kit/output/client/_app/immutable');
  const write = (rel: string) => { mkdirSync(join(immutable, rel, '..'), { recursive: true }); writeFileSync(join(immutable, rel), 'x'); };

  it('lists nested files with ‘/’ separators', () => {
    for (const f of FILES) write(f);
    expect(listFiles(immutable).sort()).toEqual([...FILES].sort());
  });

  it('is stable across two reads, and moves when a chunk appears', async () => {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/app.html'), APP_HTML);
    const first = await shellRevision(root);
    expect(await shellRevision(root)).toBe(first);
    write('chunks/ANOTHER.js');
    expect(await shellRevision(root)).not.toBe(first);
    rmSync(root, { recursive: true, force: true });
  });

  it('is what vite.config.ts hands the PWA plugin', async () => {
    const { readFileSync } = await import('node:fs');
    const cfg = readFileSync('vite.config.ts', 'utf8');
    expect(cfg).toMatch(/import \{ shellRevision \} from '\.\/src\/lib\/shellRevision\.ts'/);
    expect(cfg).toMatch(/spa: \{ fallbackMapping: '\/app-shell', fallbackRevision: shellRevision \}/);
  });
});

describe('the app version', () => {
  it('falls back to a unique value, never a constant, when there is no commit to pin to', async () => {
    const { readFileSync } = await import('node:fs');
    const cfg = readFileSync('svelte.config.js', 'utf8');
    expect(cfg).toMatch(/return String\(Date\.now\(\)\);/);
    expect(cfg, 'a constant version would let two different builds claim to be one').not.toMatch(/return 'dev'/);
    expect(cfg).toMatch(/\[0-9a-f\]\{40\}/);
  });
});
