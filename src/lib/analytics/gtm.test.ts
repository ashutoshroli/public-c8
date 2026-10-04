// ============ FEAT-001 — Google Tag Manager install + CSP =============================
//
// Analytics were never installed on the live site (no dataLayer / gtm / gtag / clarity
// anywhere in src), which is why the GA, Clarity and GTM dashboards are all empty. GA4 and
// Microsoft Clarity run as TAGS INSIDE a single GTM container (GTM-N6BF7NP7), so exactly one
// GTM snippet is installed. The strict CSP was the second blocker — same class as the
// Cloudflare Insights fix — so the hosts GTM/GA/Clarity need are asserted here too.
//
// Source-scan style (mirrors seo.test.ts / pwaManifest.test.ts): read the files off disk and
// assert on their text, so the snippet cannot silently drift or be dropped.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const GTM_ID = 'GTM-N6BF7NP7';

// ------------------------------------------------------------- 1. THE app.html SNIPPET

describe('FEAT-001: the GTM container is installed in app.html', () => {
  const html = read('app.html');

  it('the head snippet carries the container id and initialises dataLayer + gtm.js', () => {
    // Everything before the opening <body> tag is the <head>/pre-body region.
    const head = html.slice(0, html.indexOf('<body'));
    expect(head, 'the GTM head snippet must reference the container id').toContain(GTM_ID);
    expect(head, 'the snippet must initialise window.dataLayer').toMatch(/dataLayer/);
    expect(head, "the snippet must push gtm.start / event 'gtm.js'").toMatch(/gtm\.start/);
    expect(head, 'the snippet must load gtm.js from googletagmanager.com')
      .toContain('https://www.googletagmanager.com/gtm.js');
  });

  it('the head snippet only runs after the visitor has accepted analytics cookies', () => {
    const head = html.slice(0, html.indexOf('<body'));
    expect(head, 'GTM must be gated on the stored consent').toContain("localStorage.getItem('cpm_analytics_consent') !== 'granted'");
    expect(head, 'the gate must come before the script is injected')
      .toMatch(/cpm_analytics_consent[\s\S]*gtm\.js\?id=/);
  });

  it('there is NO GTM noscript iframe: it would load Google without consent', () => {
    expect(html).not.toContain('googletagmanager.com/ns.html');
  });

  it('the container id lives in app.html and in the consent module, and they agree', () => {
    expect(html).toContain(GTM_ID);
    expect(read('lib/analytics/consent.ts')).toContain(`GTM_ID = '${GTM_ID}'`);
  });

  it('the existing template intactness is preserved', () => {
    // The no-flash language script, fonts and the sveltekit placeholders must all survive.
    expect(html, 'the no-flash language script must stay').toContain("localStorage.getItem('cpm_public_lang')");
    expect(html).toContain('%sveltekit.head%');
    expect(html).toContain('%sveltekit.body%');
    expect(html, 'body attributes must be intact')
      .toContain('<body data-sveltekit-preload-data="hover">');
  });
});

// ------------------------------------------------------------------------- 2. THE CSP

describe('FEAT-001: the CSP allows GTM, GA4 and Clarity', () => {
  const vercel = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
  const csp: string = (() => {
    const json = JSON.parse(vercel);
    for (const block of json.headers) {
      const h = (block.headers || []).find((x: { key: string }) => x.key === 'Content-Security-Policy');
      if (h) return h.value as string;
    }
    return '';
  })();
  const directive = (name: string) =>
    csp.split(';').find((d) => d.trim().startsWith(name)) || '';

  it('script-src allows Google Tag Manager and Clarity', () => {
    const scriptSrc = directive('script-src');
    expect(scriptSrc, 'GTM must be able to load gtm.js').toContain('https://www.googletagmanager.com');
    expect(scriptSrc, 'Clarity script host must be allowed').toContain('https://*.clarity.ms');
  });

  it('connect-src allows GA4, GTM, Clarity and Bing beacons', () => {
    const connectSrc = directive('connect-src');
    expect(connectSrc, 'GA4 collect endpoint').toMatch(/google-analytics\.com/);
    expect(connectSrc, 'GTM config fetch').toContain('https://www.googletagmanager.com');
    expect(connectSrc, 'Clarity beacon').toContain('https://*.clarity.ms');
    expect(connectSrc, 'Bing/Clarity beacon').toContain('https://c.bing.com');
  });

  it('img-src allows GA4 and Clarity pixel beacons', () => {
    const imgSrc = directive('img-src');
    expect(imgSrc).toMatch(/google-analytics\.com/);
    expect(imgSrc).toContain('https://*.clarity.ms');
  });

  it('a frame-src directive still allows GTM (tags may open a frame)', () => {
    const frameSrc = directive('frame-src');
    expect(frameSrc, 'without frame-src a GTM tag frame falls back to default-src and is blocked')
      .toContain('https://www.googletagmanager.com');
  });

  it('the hardening directives and Cloudflare Insights hosts stay intact', () => {
    expect(typeof csp).toBe('string');
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp, 'the Cloudflare Insights beacon script host must remain')
      .toContain('https://static.cloudflareinsights.com');
    expect(csp, 'the Cloudflare Insights beacon endpoint must remain')
      .toContain('https://cloudflareinsights.com');
    // No non-schema keys crept into vercel.json (a 'comment' key previously broke the schema).
    expect(JSON.parse(vercel)).not.toHaveProperty('comment');
  });
});

// ------------------------------------------------------------ 3. THE LAYOUT WIRING

describe('FEAT-001: the layout tracks SPA page views', () => {
  const layout = read('routes/+layout.svelte');

  it('afterNavigate is imported and used', () => {
    expect(layout).toMatch(/afterNavigate/);
    expect(layout, 'the pageview helper must be imported').toMatch(/pushPageView/);
  });

  it('the afterNavigate callback is browser-guarded', () => {
    const idx = layout.indexOf('afterNavigate(');
    const block = layout.slice(idx, idx + 200);
    expect(block, 'the afterNavigate callback must guard for browser').toMatch(/if \(!browser\) return/);
  });
});
