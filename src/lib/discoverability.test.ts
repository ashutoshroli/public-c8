// ====== Discoverability: what a crawler, a link preview or a phone asks this site for ======
//
// Search engines and AI agents do not use the portal the way a visitor does. They fetch files by
// NAME (/robots.txt, /favicon.ico, /llms.txt, /apple-touch-icon.png), they read the HTML before
// any script runs, and they judge a missing page by its HTTP status. Each describe block below is
// one place the portal was answering those questions wrongly or not at all:
//
//  1. /favicon.ico did not exist. Google Search reads BMP, GIF, ICO, PNG, JPEG, PPM and TIFF
//     favicons and not SVG, so the portal had no favicon in search results at all.
//  2. apple-touch-icon was the TRANSPARENT app icon (iOS paints transparency black), and Safari
//     asks for /apple-touch-icon.png at the root without reading any <link>.
//  3. The Android notification `badge` was the full-colour emblem. Android draws a badge from its
//     alpha channel only, so it showed as a solid white blob in the status bar.
//  4. Every page carried TWO <link rel="manifest"> (app.html + the layout), the home page carried
//     TWO meta descriptions, and /privacy, /terms and /loan-rules all had the h1 "Transparency
//     Portal" instead of their own name.
//  5. robots.txt said nothing about the AI agents; there was no llms.txt and no security.txt.
//  6. An unknown URL was served with HTTP 200 (adapter-static's 200.html fallback): a soft 404.
//
// Pixel-level checks decode the PNGs here with zlib rather than importing an image library, so
// they run anywhere node does.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { ROUTES, canonicalFor, indexableRoutes, isIndexable, metaFor } from './seo';
import { llmsTxt, securityTxt } from './crawlerFiles';
import { NAVIGATE_FALLBACK_DENYLIST } from './swNavigation';
import { T } from './i18n';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const SITE = 'https://chhath.shaharpura.com';
const text = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const src = (p: string) => readFileSync(join(SRC, p), 'utf8');

// ------------------------------------------------------------------ a tiny PNG decoder

interface Png { width: number; height: number; colorType: number; bpp: number; pixels: Buffer }

/** 8-bit, non-interlaced, truecolour (2) or truecolour+alpha (6): all the generator emits. */
function decodePng(buf: Buffer, path: string): Png {
  expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${path} is not a PNG`).toBe(true);
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!bpp || bitDepth !== 8 || interlace) throw new Error(`${path}: unsupported PNG (colorType ${colorType}, depth ${bitDepth}, interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, colorType, bpp, pixels: px };
}

const readPng = (path: string): Png => decodePng(readFileSync(join(ROOT, path)), path);

/** Every pixel with alpha above `min`, as { x, y, r, g, b, a }. */
function visible(png: Png, min = 16) {
  const out: { x: number; y: number; r: number; g: number; b: number; a: number }[] = [];
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * png.bpp;
      const a = png.bpp === 4 ? png.pixels[i + 3] : 255;
      if (a > min) out.push({ x, y, r: png.pixels[i], g: png.pixels[i + 1], b: png.pixels[i + 2], a });
    }
  }
  return out;
}

// ------------------------------------------------------------------ 1. favicon.ico

describe('favicon.ico: the one Google Search can actually read', () => {
  const ico = readFileSync(join(ROOT, 'static/favicon.ico'));
  const count = ico.readUInt16LE(4);
  const entries = Array.from({ length: count }, (_, i) => {
    const o = 6 + i * 16;
    const size = ico.readUInt32LE(o + 8);
    const offset = ico.readUInt32LE(o + 12);
    return { w: ico[o] || 256, h: ico[o + 1] || 256, png: ico.subarray(offset, offset + size) };
  });

  it('is a real ICO container', () => {
    expect(ico.readUInt16LE(0), 'reserved').toBe(0);
    expect(ico.readUInt16LE(2), 'type 1 = icon').toBe(1);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('carries 16, 32 and 48 px images, each a valid square PNG of the size it claims', () => {
    expect(entries.map((e) => e.w).sort((a, b) => a - b)).toEqual([16, 32, 48]);
    for (const e of entries) {
      expect(e.png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
      expect(e.png.readUInt32BE(16), 'png width matches the directory').toBe(e.w);
      expect(e.png.readUInt32BE(20), 'png height matches the directory').toBe(e.h);
      expect(e.w).toBe(e.h);
    }
  });

  it('includes the 48 px image Google recommends, and it is drawn rather than blank', () => {
    const e48 = entries.find((e) => e.w === 48);
    expect(e48, 'no 48px image').toBeTruthy();
    const png = decodePng(e48!.png, 'favicon.ico[48]');
    expect([png.width, png.height]).toEqual([48, 48]);
    expect(png.colorType, 'the emblem has transparent corners, so it carries alpha').toBe(6);
    const ink = visible(png);
    // The emblem is a disc: about pi/4 of the square, give or take the ring's anti-aliasing.
    expect(ink.length / (48 * 48)).toBeGreaterThan(0.6);
    expect(ink.length / (48 * 48), 'transparent corners, not a filled square').toBeLessThan(0.95);
    expect(new Set(ink.map((p) => `${p.r >> 4},${p.g >> 4},${p.b >> 4}`)).size, 'more than a flat disc').toBeGreaterThan(6);
  });

  it('is linked from every page, next to the SVG, and cached like the other icons', () => {
    const html = src('app.html');
    expect(html).toMatch(/<link rel="icon" href="%sveltekit\.assets%\/favicon\.ico" sizes="32x32" \/>/);
    expect(html).toMatch(/<link rel="icon" href="%sveltekit\.assets%\/favicon\.svg" type="image\/svg\+xml" \/>/);
    const cache = JSON.parse(text('vercel.json')).headers.find((h: { source: string }) => /webmanifest/.test(h.source));
    expect(cache.source, 'a long cache header for .ico, like .png and .svg').toContain('ico');
  });
});

// -------------------------------------------------------------- 2. apple-touch-icon

describe('apple-touch-icon: opaque, 180px, at the site root', () => {
  it('is an opaque 180x180 PNG (no alpha channel at all)', () => {
    const png = readPng('static/apple-touch-icon.png');
    expect(png.width).toBe(180);
    expect(png.height).toBe(180);
    // Colour type 2 = RGB: iOS fills any transparency with BLACK, so there must be none.
    expect(png.colorType).toBe(2);
  });

  it('is not a blank tile: it holds more than one colour', () => {
    const png = readPng('static/apple-touch-icon.png');
    const seen = new Set<string>();
    for (let i = 0; i < png.pixels.length; i += 3 * 7) seen.add(`${png.pixels[i]},${png.pixels[i + 1]},${png.pixels[i + 2]}`);
    expect(seen.size).toBeGreaterThan(20);
  });

  it('is what app.html links, and the transparent icon-180 it replaced is gone', () => {
    expect(src('app.html')).toMatch(/rel="apple-touch-icon" href="%sveltekit\.assets%\/apple-touch-icon\.png"/);
    expect(src('app.html')).not.toContain('icon-180');
    expect(existsSync(join(ROOT, 'static/icons/icon-180.png'))).toBe(false);
  });
});

// ---------------------------------------------------- 3. notification badge + themed icon

describe('monochrome artwork: Android keeps only the alpha channel', () => {
  it('the notification badge is white-on-transparent, 96px, and actually drawn', () => {
    const png = readPng('static/icons/badge-96.png');
    expect([png.width, png.height]).toEqual([96, 96]);
    expect(png.colorType, 'needs an alpha channel to be a mask').toBe(6);
    const ink = visible(png);
    const coverage = ink.length / (96 * 96);
    expect(coverage, 'a badge that is all ink is a white square in the status bar').toBeLessThan(0.5);
    expect(coverage, 'a badge with no ink is invisible').toBeGreaterThan(0.08);
    for (const p of ink) expect([p.r, p.g, p.b], 'every visible pixel is pure white').toEqual([255, 255, 255]);
  });

  it('the service worker uses it as the default badge, and the old full-colour one is gone', () => {
    const sw = text('static/push-sw.js');
    expect(sw).toMatch(/var DEFAULT_BADGE = '\/icons\/badge-96\.png';/);
    expect(sw).not.toMatch(/DEFAULT_BADGE = '\/icons\/icon-192\.png'/);
    // The icon itself stays the full-colour emblem; only the badge is monochrome.
    expect(sw).toMatch(/var DEFAULT_ICON = '\/icons\/icon-192\.png';/);
  });

  it('the themed-icon asset is one flat colour on transparency, inside the adaptive-icon safe zone', () => {
    const png = readPng('static/icons/icon-512-monochrome.png');
    expect([png.width, png.height]).toEqual([512, 512]);
    expect(png.colorType).toBe(6);
    const ink = visible(png);
    expect(ink.length / (512 * 512), 'it must be drawn, and must not fill the canvas').toBeGreaterThan(0.03);
    expect(ink.length / (512 * 512)).toBeLessThan(0.5);
    expect(new Set(ink.map((p) => `${p.r},${p.g},${p.b}`)).size, 'a single colour').toBe(1);
    // Android's safe zone: a circle 66dp across on a 108dp canvas, i.e. a radius of ~30.6%.
    const c = (512 - 1) / 2;
    const farthest = Math.max(...ink.map((p) => Math.hypot(p.x - c, p.y - c)));
    expect(farthest / 512, 'artwork must not reach the corners the launcher mask crops').toBeLessThanOrEqual(0.306);
  });

  it('the manifest offers it with purpose "monochrome", beside the existing three', () => {
    const cfg = text('vite.config.ts');
    expect(cfg).toMatch(/src: '\/icons\/icon-512-monochrome\.png', sizes: '512x512', type: 'image\/png', purpose: 'monochrome'/);
    for (const purpose of ["'any'", "'maskable'"]) expect(cfg).toContain(`purpose: ${purpose}`);
    expect(existsSync(join(ROOT, 'static/icons/icon-512-monochrome.png'))).toBe(true);
  });

  it('files only crawlers and the OS fetch are kept out of the offline precache', () => {
    const cfg = text('vite.config.ts');
    const ignores = /globIgnores:\s*\[([\s\S]*?)\]/.exec(cfg)![1];
    for (const pattern of ['**/og-image.png', '**/apple-touch-icon.png', '**/favicon.ico', '**/icons/icon-512*.png']) {
      expect(ignores, `${pattern} would be downloaded by every first-time visitor for nothing`).toContain(pattern);
    }
  });
});

// ------------------------------------------------------------- 4. the head and the headings

describe('the head: one manifest, one description, one h1 that names the page', () => {
  it('app.html carries no static manifest link; the layout injects the generated one', () => {
    // Comments are stripped first: the one in app.html explains this very point and quotes the tag.
    const markup = src('app.html').replace(/<!--[\s\S]*?-->/g, '');
    expect(markup, 'a second <link rel="manifest"> competes with the injected one')
      .not.toMatch(/<link[^>]*rel="manifest"/);
    const layout = src('routes/+layout.svelte');
    expect(layout).toMatch(/pwaInfo\.webManifest\.linkTag/);
    expect(layout).toMatch(/\{@html webManifestLink\}/);
  });

  it('the home page leaves the meta description to Seo.svelte', () => {
    const home = src('routes/+page.svelte');
    expect(home, 'a second description is emitted next to the one from ROUTES').not.toMatch(/<meta\s+name="description"/);
    expect(src('lib/components/Seo.svelte')).toMatch(/<meta name="description" content=\{meta\.description\} \/>/);
    expect(metaFor('')?.description.length).toBeGreaterThan(40);
  });

  it('no page uses the site tagline as its h1', () => {
    for (const f of ['privacy', 'terms', 'loan-rules']) {
      const page = src(`routes/${f}/+page.svelte`);
      expect(page, `/${f} still headlines "Transparency Portal"`).not.toMatch(/titleKey="app_subtitle"/);
    }
    expect(src('routes/privacy/+page.svelte')).toMatch(/<PageHeading titleKey="privacy_subtitle"/);
    expect(src('routes/terms/+page.svelte')).toMatch(/<PageHeading titleKey="terms_subtitle"/);
    expect(src('routes/loan-rules/+page.svelte')).toMatch(/<PageHeading titleKey="loan_rules_subtitle"/);
  });

  it('every route\'s h1 is the same words as its entry in the route table', () => {
    // The h1, the <title> and the table must agree, or a page is described as one thing and
    // titled another. Checked for the pages whose heading comes from PageHeading.
    for (const r of ROUTES) {
      if (r.path === '') continue;
      const page = src(`routes${r.path}/+page.svelte`);
      const m = /<PageHeading titleKey="([a-z_]+)"/.exec(page);
      expect(m, `${r.path} has no PageHeading`).toBeTruthy();
      expect(m![1], `${r.path}: h1 key differs from the route table's titleKey`).toBe(r.titleKey);
    }
  });

  it('the footer links Contributors and 10 Years from every page, in both languages', () => {
    const footer = src('lib/components/FooterLinks.svelte');
    expect(footer).toContain('href="/contributors"');
    expect(footer).toContain('href="/decade"');
    expect(src('lib/components/Shell.svelte')).toContain('<FooterLinks />');
    for (const key of ['contributors_list', 'decade_title']) {
      expect(footer).toContain(`$tr('${key}')`);
      expect(T.en[key], `${key} (en)`).toBeTruthy();
      expect(T.hi[key], `${key} (hi)`).toBeTruthy();
    }
  });
});

// ----------------------------------------------------------------------- 5. /verify

describe('/verify: reachable for the QR, absent from search', () => {
  it('is in the table (so it keeps a title and canonical) but opts out of indexing', () => {
    expect(metaFor('/verify')?.noindex).toBe(true);
    expect(isIndexable('/verify')).toBe(false);
    expect(isIndexable('/verify/'), 'a trailing slash is the same page').toBe(false);
    expect(isIndexable('/expenses')).toBe(true);
    expect(isIndexable('/not-a-page'), 'unknown paths are never indexable').toBe(false);
  });

  it('the Seo component turns that into a robots meta tag', () => {
    const seo = src('lib/components/Seo.svelte');
    expect(seo).toMatch(/isIndexable\(path\)/);
    // Not on an error page: +error.svelte emits its own "noindex, nofollow", and two robots tags
    // on one page is an ambiguity a crawler should not have to resolve.
    expect(seo).toMatch(/\{#if !indexable && !\$page\.error\}\s*<meta name="robots" content="noindex, follow" \/>/);
    expect(src('routes/+error.svelte')).toMatch(/<meta name="robots" content="noindex, nofollow" \/>/);
  });

  it('is NOT blocked in robots.txt: a crawler must be able to fetch the page to see the noindex', () => {
    const robots = text('static/robots.txt');
    expect(robots).not.toMatch(/^\s*Disallow:\s*\/verify/im);
  });
});

// ------------------------------------------- 5b. files must not be answered with the app shell

describe('the service worker lets a FILE navigation reach the network', () => {
  // Workbox matches each pattern against pathname + search.
  const denied = (path: string) => NAVIGATE_FALLBACK_DENYLIST.some((re) => re.test(path));

  it('/robots.txt, /sitemap.xml, /llms.txt and security.txt are not swallowed by the shell', () => {
    // THE case. Opened in a browser that has the portal installed, these used to render the
    // portal's own "page does not exist" screen, so a file that exists looked missing.
    for (const path of [
      '/robots.txt', '/sitemap.xml', '/llms.txt', '/.well-known/security.txt',
      '/favicon.ico', '/apple-touch-icon.png', '/manifest.webmanifest', '/og-image.png',
      '/robots.txt?cachebust=1',
    ]) {
      expect(denied(path), `${path} must reach the network`).toBe(true);
    }
  });

  it('every page of the portal still gets the shell', () => {
    for (const r of ROUTES) {
      expect(denied(r.path || '/'), `${r.path || '/'} is a page, not a file`).toBe(false);
    }
    expect(denied('/not-a-real-page'), 'an unknown page URL gets the shell, so the client renders the 404').toBe(false);
    expect(denied('/expenses?year=2025')).toBe(false);
  });

  it('a receipt QR still gets the shell, whatever is in the record id', () => {
    // `/?record=<id>` is printed on every receipt and certificate. An id with a dot or a slash
    // in the query string must not make that look like a request for a file.
    for (const path of ['/?record=ABC123', '/?record=2026.REC.001', '/?record=2026/REC.001', '/verify?record=a/b.c']) {
      expect(denied(path), `${path} is a page navigation`).toBe(false);
    }
  });

  it('is wired into the generated worker, from the same module', () => {
    const cfg = text('vite.config.ts');
    expect(cfg).toMatch(/import \{ NAVIGATE_FALLBACK_DENYLIST \} from '\.\/src\/lib\/swNavigation\.ts'/);
    expect(cfg).toMatch(/navigateFallbackDenylist: NAVIGATE_FALLBACK_DENYLIST/);
  });
});

// ------------------------------------------------------------------------ 6. robots.txt

interface Group { agents: string[]; rules: [string, string][] }

function parseRobots(txt: string): { groups: Group[]; sitemaps: string[] } {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let cur: Group | null = null;
  let afterRule = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!cur || afterRule) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value);
      afterRule = false;
    } else if (field === 'allow' || field === 'disallow') {
      cur?.rules.push([field, value]);
      afterRule = true;
    } else if (field === 'sitemap') sitemaps.push(value);
  }
  return { groups, sitemaps };
}

describe('robots.txt: everything is public, and says so by name', () => {
  const { groups, sitemaps } = parseRobots(text('static/robots.txt'));
  const agents = groups.flatMap((g) => g.agents);

  it('has a "*" group that allows everything', () => {
    const star = groups.find((g) => g.agents.includes('*'));
    expect(star, 'no User-agent: * group').toBeTruthy();
    expect(star!.rules).toContainEqual(['allow', '/']);
  });

  it('never disallows anything: not the site, not the scripts and styles Google renders with', () => {
    for (const g of groups) {
      for (const [kind, value] of g.rules) {
        expect(kind === 'disallow' && value !== '', `${g.agents.join(',')} disallows "${value}"`).toBe(false);
      }
    }
  });

  it('names the search engines and the AI agents, each in a group that allows the site', () => {
    for (const bot of [
      'Googlebot', 'Bingbot', 'Applebot',
      'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
      'Claude-SearchBot', 'Claude-User', 'ClaudeBot',
      'PerplexityBot', 'Google-Extended',
    ]) {
      expect(agents, `${bot} is not named`).toContain(bot);
    }
    for (const g of groups) expect(g.rules, `${g.agents.join(',')} has no Allow: /`).toContainEqual(['allow', '/']);
  });

  it('points at the generated sitemap, as an absolute URL', () => {
    expect(sitemaps).toEqual([`${SITE}/sitemap.xml`]);
  });
});

// -------------------------------------------------------------------------- 7. llms.txt

describe('llms.txt: a map of the site for language models', () => {
  const md = llmsTxt(SITE);
  const lines = md.split('\n');

  it('follows the llmstxt.org shape: H1, then a blockquote summary, then H2 sections', () => {
    expect(lines[0]).toMatch(/^# \S/);
    expect(lines.filter((l) => l.startsWith('# ')).length, 'exactly one H1').toBe(1);
    const firstContent = lines.slice(1).find((l) => l.trim() !== '');
    expect(firstContent).toMatch(/^> .{80,}/);
    const sections = lines.filter((l) => l.startsWith('## '));
    expect(sections).toEqual(['## Pages', '## Optional']);
  });

  it('links every indexable page once, with an absolute URL and a description', () => {
    for (const r of indexableRoutes()) {
      const url = canonicalFor(SITE, r.path);
      const hits = lines.filter((l) => l.includes(`](${url})`));
      expect(hits.length, `${url} should be listed exactly once`).toBe(1);
      expect(hits[0]).toContain(r.description);
    }
  });

  it('does not list the receipt-verification page', () => {
    expect(md).not.toContain('/verify');
  });

  it('every list item is a well-formed markdown link', () => {
    const items = lines.filter((l) => l.startsWith('- ['));
    expect(items.length).toBeGreaterThanOrEqual(indexableRoutes().length);
    for (const l of items) expect(l).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)\s]+\)(: .+)?$/);
  });

  it('gives a way to reach the committee and says where the figures come from', () => {
    expect(md).toContain('chhath@shaharpura.com');
    expect(md, 'the figures are loaded live, not part of the page text').toMatch(/loaded live from the committee/);
    expect(md).toContain(`${SITE}/sitemap.xml`);
  });

  it('is built from the route table, so a new page appears without editing a text file', () => {
    expect(src('lib/crawlerFiles.ts')).toMatch(/indexableRoutes\(\)/);
    expect(src('routes/llms.txt/+server.ts')).toMatch(/export const prerender = true/);
    expect(src('routes/llms.txt/+server.ts')).toMatch(/text\/plain; charset=utf-8/);
  });

  it('no doubled slash when the site URL carries one', () => {
    expect(llmsTxt(`${SITE}/`)).toBe(md);
  });
});

// ---------------------------------------------------------------------- 8. security.txt

describe('security.txt (RFC 9116)', () => {
  const now = new Date('2026-10-14T00:00:00.000Z');
  const body = securityTxt(SITE, now);
  const field = (name: string) => body.split('\n').filter((l) => l.startsWith(`${name}:`)).map((l) => l.slice(name.length + 1).trim());

  it('has the two fields the RFC requires, exactly once each', () => {
    expect(field('Contact')).toEqual(['mailto:chhath@shaharpura.com']);
    expect(field('Expires')).toHaveLength(1);
  });

  it('expires in the future but within a year, as the RFC recommends', () => {
    const exp = new Date(field('Expires')[0]);
    expect(Number.isNaN(exp.getTime()), 'a valid ISO 8601 date').toBe(false);
    const days = (exp.getTime() - now.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(300);
    expect(days).toBeLessThan(365);
    expect(field('Expires')[0]).toBe('2027-10-09T00:00:00.000Z');
  });

  it('states its own canonical location and the languages spoken', () => {
    expect(field('Canonical')).toEqual([`${SITE}/.well-known/security.txt`]);
    expect(field('Preferred-Languages')).toEqual(['en, hi']);
  });

  it('is computed at build time from the build clock, not typed in', () => {
    expect(src('lib/crawlerFiles.ts')).toMatch(/now: Date = new Date\(\)/);
    expect(src('routes/.well-known/security.txt/+server.ts')).toMatch(/export const prerender = true/);
  });

  it('every non-comment line is a "Field: value" pair', () => {
    for (const l of body.split('\n').filter((x) => x && !x.startsWith('#'))) {
      expect(l, l).toMatch(/^[A-Za-z-]+: \S/);
    }
  });
});

// -------------------------------------------------------------------------- 9. real 404s

describe('an unknown URL is a real 404, not a copy of the app', () => {
  const cfg = text('svelte.config.js');

  it('the static adapter writes its fallback as 404.html', () => {
    expect(cfg).toMatch(/fallback:\s*'404\.html'/);
    expect(cfg, 'a 200.html fallback is served with status 200 for every unknown path')
      .not.toMatch(/fallback:\s*'200\.html'/);
  });

  it('the prerender crawl no longer waves 404s through', () => {
    // With a 404 fallback a broken internal link is a broken link for real, so the build must
    // say so. The old handler returned silently on 404 because the fallback hid the problem.
    const block = /prerender:\s*\{([\s\S]*?)\n    \}/.exec(cfg)![1];
    expect(block).toMatch(/handleHttpError/);
    expect(block).not.toMatch(/status\s*===\s*404/);
    expect(block).toMatch(/throw new Error/);
  });

  it('the error page still refuses to be indexed, for the visitor whose service worker answers', () => {
    expect(src('routes/+error.svelte')).toMatch(/name="robots" content="noindex, nofollow"/);
  });

  it('the service worker is not configured with the old fallback name', () => {
    const cfg = text('vite.config.ts');
    expect(cfg).not.toMatch(/200\.html/);
    // The offline shell is its own 200-status copy of the fallback (see swShell.test.ts); the
    // 404.html that Vercel serves with a 404 can never be precached, because Workbox refuses it.
    expect(cfg).toMatch(/adapterFallback: 'app-shell\.html'/);
    expect(cfg).not.toMatch(/adapterFallback: '404\.html'/);
  });
});
