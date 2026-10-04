// Analytics consent.
//
// Google Tag Manager (which runs GA4 and Microsoft Clarity as tags) used to load for every
// visitor on first paint, and the privacy page said nothing about it. It now loads ONLY after
// the visitor has pressed Accept. The choice is kept in localStorage; "Cookie settings" in the
// footer reopens it.
//
// app.html repeats the tiny load snippet inline so a returning visitor who already accepted
// gets GTM on first paint exactly as before. Both paths set `window.__cpmGtmLoaded`, so GTM
// can never be injected twice.

import { writable } from 'svelte/store';

export const CONSENT_KEY = 'cpm_analytics_consent';
export const GTM_ID = 'GTM-N6BF7NP7';

export type Consent = 'granted' | 'denied';

/** null = the visitor has not chosen yet. */
export const consent = writable<Consent | null>(null);
/** true while the banner / settings panel is showing. */
export const consentPanelOpen = writable(false);

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): Store | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readConsent(storage: Store | undefined = safeStorage()): Consent | null {
  try {
    const v = storage?.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent, storage: Store | undefined = safeStorage()): void {
  try {
    storage?.setItem(CONSENT_KEY, value);
  } catch {
    /* private mode / storage full: the choice just will not persist */
  }
}

interface GtmWindow {
  dataLayer?: unknown[];
  __cpmGtmLoaded?: boolean;
}

export function gtmLoaded(win: object = window): boolean {
  return !!(win as GtmWindow).__cpmGtmLoaded;
}

/** Injects the GTM container once. Returns true only on the call that actually loaded it. */
export function loadGtm(win: object = window, doc: Document = document): boolean {
  const w = win as GtmWindow;
  if (w.__cpmGtmLoaded) return false;
  w.__cpmGtmLoaded = true;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  const s = doc.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
  doc.head.appendChild(s);
  return true;
}

const ANALYTICS_COOKIE = /^(_ga($|_)|_gid$|_gat|_clck$|_clsk$)/;

/** Best-effort removal of the first-party cookies GA4 and Clarity set on this site. */
export function clearAnalyticsCookies(doc: Document = document, hostname: string = location.hostname): void {
  const names = doc.cookie
    .split(';')
    .map((c) => c.split('=')[0].trim())
    .filter((n) => ANALYTICS_COOKIE.test(n));
  const parts = hostname.split('.');
  const parent = parts.length > 2 ? '.' + parts.slice(-2).join('.') : '';
  const domains = ['', hostname, '.' + hostname, parent].filter((d, i, a) => a.indexOf(d) === i);
  for (const name of names) {
    for (const d of domains) {
      doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? '; domain=' + d : ''}`;
    }
  }
}
