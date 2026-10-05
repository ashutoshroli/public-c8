// First-load weight: what a visitor downloads to open the portal in English.
//
// The only Devanagari on an English page is the "हिंदी" language-toggle label. Left in the
// webfont stack it pulled the whole 121 kB Noto Devanagari file on every first visit, and the
// service worker also precached it plus 250 kB of install-prompt images. Source-scan tests
// (same style as gtm.test.ts) so none of that creeps back unnoticed.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('English first load does not fetch the Devanagari webfont', () => {
  it('the language toggle is drawn in a device font', () => {
    const shell = read('src/lib/components/Shell.svelte');
    const btn = shell.slice(shell.lastIndexOf('<button', shell.indexOf("'हिंदी'")), shell.indexOf("'हिंदी'"));
    expect(btn).toContain('font-system');
  });

  it('font-system really is webfont-free', () => {
    const cfg = read('tailwind.config.ts');
    const line = cfg.split('\n').find((l) => l.trim().startsWith('system:')) || '';
    expect(line).toContain('system-ui');
    expect(line).not.toMatch(/Variable|Manrope/);
  });

  it('no other Devanagari text sits in the Svelte markup outside the toggle and comments', () => {
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.svelte')) {
          read(p.slice(ROOT.length + 1))
            .split('\n')
            .forEach((l, i) => {
              if (/[\u0900-\u097F]/.test(l) && !l.includes("'हिंदी'") && !/^\s*(\/\/|\*|\/\*|<!--)/.test(l.trim()) && !l.includes('<!--') && !l.trim().startsWith('*'))
                hits.push(`${p.slice(ROOT.length + 1)}:${i + 1}`);
            });
        }
      }
    };
    walk(resolve(ROOT, 'src'));
    expect(hits, 'Devanagari in a template would load the webfont on English pages').toEqual([]);
  });
});

describe('the service worker precache stays small', () => {
  const vite = read('vite.config.ts');

  it('skips install-prompt images and the Devanagari font', () => {
    expect(vite).toMatch(/globIgnores:[^\]]*screenshots\/\*\*/);
    expect(vite).toMatch(/globIgnores:[^\]]*icons\/icon-512/);
    expect(vite).toMatch(/globIgnores:[^\]]*fonts\/noto-sans-devanagari/);
  });

  it('still serves fonts offline after first use, via a runtime cache', () => {
    expect(vite).toContain("cacheName: 'chhath-fonts'");
    expect(vite).toContain("url.pathname.startsWith('/fonts/')");
  });
});
