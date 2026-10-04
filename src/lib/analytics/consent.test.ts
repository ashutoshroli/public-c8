// @vitest-environment jsdom
// ============ Analytics consent: nothing loads until the visitor says yes ====================
//
// GA4 + Clarity ride inside GTM, so GTM is the one switch. These tests pin the behaviour that
// matters legally and practically: no consent -> no script; accept -> exactly one script;
// decline/undecided -> none; and every page can reach Privacy, Terms and Cookie settings.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  CONSENT_KEY,
  readConsent,
  writeConsent,
  loadGtm,
  gtmLoaded,
  clearAnalyticsCookies
} from './consent';

const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v)
  };
}

describe('consent storage', () => {
  it('is null until the visitor chooses', () => {
    expect(readConsent(memoryStorage())).toBeNull();
  });

  it('round-trips granted and denied', () => {
    const s = memoryStorage();
    writeConsent('granted', s);
    expect(readConsent(s)).toBe('granted');
    writeConsent('denied', s);
    expect(readConsent(s)).toBe('denied');
  });

  it('treats any other stored value as "not chosen"', () => {
    expect(readConsent(memoryStorage({ [CONSENT_KEY]: 'yes' }))).toBeNull();
  });

  it('survives storage that throws (private mode)', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };
    expect(readConsent(broken)).toBeNull();
    expect(() => writeConsent('granted', broken)).not.toThrow();
  });
});

describe('loadGtm', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('injects exactly one gtm.js script, once', () => {
    const win = {} as Record<string, unknown>;
    expect(gtmLoaded(win)).toBe(false);
    expect(loadGtm(win, document)).toBe(true);
    expect(loadGtm(win, document), 'a second call must not inject again').toBe(false);
    const scripts = document.head.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('src')).toContain('GTM-N6BF7NP7');
    expect(gtmLoaded(win)).toBe(true);
    expect(Array.isArray(win.dataLayer)).toBe(true);
  });

  it('does nothing when app.html already loaded it', () => {
    const win = { __cpmGtmLoaded: true } as Record<string, unknown>;
    expect(loadGtm(win, document)).toBe(false);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });
});

describe('clearAnalyticsCookies', () => {
  it('removes GA/Clarity cookies and leaves others alone', () => {
    document.cookie = '_ga=1; path=/';
    document.cookie = '_ga_ABC123=1; path=/';
    document.cookie = '_clck=1; path=/';
    document.cookie = 'keepme=1; path=/';
    clearAnalyticsCookies(document, 'localhost');
    expect(document.cookie).toContain('keepme=1');
    expect(document.cookie).not.toMatch(/_ga|_clck/);
  });
});

describe('wiring: every page reaches the notices and the choice', () => {
  it('the footer (rendered by Shell on every page) links Privacy, Terms and Cookie settings', () => {
    const footer = read('lib/components/FooterLinks.svelte');
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain("consentPanelOpen.set(true)");
    expect(read('lib/components/Shell.svelte')).toContain('<FooterLinks />');
  });

  it('the layout mounts the banner for every route', () => {
    expect(read('routes/+layout.svelte')).toContain('<ConsentBanner />');
  });

  it('the banner links to the cookies section of the privacy page', () => {
    expect(read('lib/components/ConsentBanner.svelte')).toContain('/privacy#cookies');
  });

  it('privacy and terms link to each other', () => {
    expect(read('routes/privacy/+page.svelte')).toContain('href="/terms"');
    expect(read('routes/terms/+page.svelte')).toContain('href="/privacy"');
  });

  it('both languages have every consent and footer string', () => {
    const i18n = read('lib/i18n.ts');
    for (const key of [
      'footer_cookies',
      'consent_title',
      'consent_text',
      'consent_accept',
      'consent_decline',
      'consent_details',
      'privacy_email',
      'call_member',
      'whatsapp_member',
      'privacy_cookie_change',
      'privacy_see_terms',
      'terms_see_privacy',
      'terms_donations_h',
      'terms_donations_p'
    ]) {
      const n = (i18n.match(new RegExp(`\\b${key}:`, 'g')) || []).length;
      expect(n, `${key} appears ${n} times, expected 2 (en + hi)`).toBe(2);
    }
  });

  it('no request goes to Google Fonts any more', () => {
    expect(read('app.html')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const vercel = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
    expect(vercel).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});
