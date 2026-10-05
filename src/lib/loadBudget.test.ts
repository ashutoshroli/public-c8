// First-load weight: what a visitor downloads to open the portal in English.
//
// The only Devanagari on an English page is the "हिंदी" language-toggle label. Left in the
// webfont stack it pulled the whole 121 kB Noto Devanagari file on every first visit, and the
// service worker also precached it plus 250 kB of install-prompt images. Source-scan tests
// (same style as gtm.test.ts) so none of that creeps back unnoticed.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

describe('images and fonts do not cause layout shift or late text', () => {
  it('avatar images declare their size and decode off the main thread', () => {
    for (const f of ['ContributorCard', 'ContributorsListModal', 'ContributorDetail']) {
      const src = read(`src/lib/components/${f}.svelte`);
      const img = src.slice(src.indexOf('<img'), src.indexOf('/>', src.indexOf('<img')));
      expect(img, `${f} <img> needs width`).toMatch(/width="\d+"/);
      expect(img, `${f} <img> needs height`).toMatch(/height="\d+"/);
      expect(img, `${f} <img> needs decoding`).toContain('decoding="async"');
    }
  });

  it('the Latin webfont is preloaded from app.html', () => {
    const html = read('src/app.html');
    expect(html).toContain('rel="preload" href="/fonts/manrope-latin-wght-normal.woff2" as="font"');
    expect(html, 'font preloads must be crossorigin even when same-origin').toMatch(/manrope-latin[^>]*crossorigin/);
  });
});

describe('the rupee sign never pulls the big Devanagari webfont', () => {
  const css = read('src/app.css');
  const block = (family: string) => css.slice(css.indexOf(`font-family: '${family}'`), css.indexOf('}', css.indexOf(`font-family: '${family}'`)));

  it('U+20B9 is claimed by the small Rupee face, not the Devanagari one', () => {
    expect(block('Rupee')).toContain('U+20B9');
    expect(block('Noto Sans Devanagari Variable')).not.toContain('U+20B9');
  });

  it('Rupee sits before the Devanagari face in the sans stack', () => {
    const line = read('tailwind.config.ts').split('\n').find((l) => l.trim().startsWith('sans:')) || '';
    expect(line.indexOf("'Rupee'")).toBeGreaterThan(-1);
    expect(line.indexOf("'Rupee'")).toBeLessThan(line.indexOf('Noto Sans Devanagari'));
  });
});

describe('the API origin is warmed up before the data request', () => {
  it('app.html preconnects (crossorigin) to the same host config.ts falls back to', () => {
    const cfg = read('src/lib/config.ts');
    const host = (cfg.match(/PUBLIC_API_BASE:\s*'(https:\/\/[^']+)'/) || [])[1];
    expect(host, 'PUBLIC_API_BASE default not found in config.ts').toBeTruthy();
    const html = read('src/app.html');
    const tag = html.match(/<link[^>]*rel="preconnect"[^>]*>/g)?.find((t) => t.includes(host as string));
    expect(tag, `no <link rel="preconnect"> for ${host}`).toBeTruthy();
    expect(tag).toMatch(/crossorigin/);
  });
});
