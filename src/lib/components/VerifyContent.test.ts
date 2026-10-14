// ====== The verify page: what a visitor who scans a receipt's QR sees ======
//
// The page already says whether the record is genuine and shows who and how much. A verified
// receipt or certificate now also offers the document itself: a "Download PDF" button. The real
// component is mounted against the real stores; the tests are as much about when the button must
// NOT appear — on a result we cannot stand behind, on a loan consent, on a link that is not a web
// address — as about when it must.
//
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import VerifyContent from './VerifyContent.svelte';
import { page } from '$app/stores';
import { portalState } from '$lib/stores/portal';
import { lang } from '$lib/stores/lang';
import { parsePortalData, EMPTY_PORTAL_DATA, type PortalData } from '$lib/api/schema';

vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('https://chhath.shaharpura.com/verify'), params: {}, error: null }) };
});

const FILE = 'https://files.example/2025/receipt-12.pdf';

const DATA: PortalData = parsePortalData({
  users: [{ ID: 'USER0007', Name: 'Test Contributor', 'Name (Hindi)': 'परीक्षण योगदानकर्ता', Village: 'Shaharpura', 'Village (Hindi)': 'शहरपुरा' }],
  collections: [
    { __rowIndex: 12, Year: 2025, Name: 'USER0007', Amount: 500, 'Contribution Type': '1', Detail: 'Cash', 'Is Resell': 'FALSE' },
    { __rowIndex: 15, Year: 2025, Name: 'USER0007', Amount: 100, 'Certificate Or Receipt': 'Certificate', 'Is Resell': 'FALSE' },
  ],
  generatedFiles: [
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-12', public_link: FILE },
    { doc_type: 'certificate', year: 2025, record_id: 'certificate-2025-15', public_link: 'https://files.example/2025/certificate-15.pdf' },
    { doc_type: 'consent_loaner', year: 2025, record_id: 'consent_loaner-2025-CN1', public_link: 'https://files.example/2025/consent.pdf' },
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-90', public_link: 'javascript:alert(1)' },
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-91', public_link: '' },
  ],
})!;

function ready(data: PortalData, over: Partial<Parameters<typeof portalState.set>[0]> = {}) {
  portalState.set({ status: 'ready', data, stale: false, savedAt: Date.now(), version: 'v', failed: false, source: 'network', ...over });
}

let host: HTMLDivElement;
let app: ReturnType<typeof mount> | null = null;

function scan(recordId: string) {
  const store = page as unknown as { set(v: unknown): void };
  store.set({
    url: new URL(`https://chhath.shaharpura.com/verify${recordId ? `?record=${encodeURIComponent(recordId)}` : ''}`),
    params: {},
    error: null,
  });
  app = mount(VerifyContent, { target: host });
  flushSync();
}

const text = () => host.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const pdfLinks = () => [...host.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')];

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  portalState.set({ status: 'loading', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: false, source: 'empty' });
  lang.set('en');
});

afterEach(() => {
  if (app) { unmount(app); app = null; }
  lang.set('en');
});

// ---------------------------------------------------------------- the button, when it belongs

describe('a verified receipt or certificate', () => {
  it('shows the verdict, the details to check against the paper, and a Download PDF button', () => {
    ready(DATA);
    scan('receipt-2025-12');
    expect(text()).toContain('Verified Record');
    expect(text()).toContain('Test Contributor');
    expect(text()).toContain('Shaharpura');
    const links = pdfLinks();
    expect(links).toHaveLength(1);
    expect(links[0].textContent?.trim()).toBe('Download PDF');
    expect(links[0].getAttribute('href')).toBe(FILE);
  });

  it('opens the file in a new tab without handing the opener or the referrer to another site', () => {
    ready(DATA);
    scan('receipt-2025-12');
    const rel = (pdfLinks()[0].getAttribute('rel') || '').split(/\s+/);
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
    expect(pdfLinks()[0].hasAttribute('download'), 'cross-site: the attribute would be ignored').toBe(false);
  });

  it('sits inside the verdict card, after the details', () => {
    ready(DATA);
    scan('receipt-2025-12');
    const link = pdfLinks()[0];
    const card = link.closest('section')!;
    expect(card.textContent).toContain('Verified Record');
    const details = [...card.querySelectorAll('p')].find((p) => p.textContent?.includes('Test Contributor'))!;
    expect(details.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a certificate has one too, and it is that certificate’s own file', () => {
    ready(DATA);
    scan('certificate-2025-15');
    expect(pdfLinks().map((a) => a.getAttribute('href'))).toEqual(['https://files.example/2025/certificate-15.pdf']);
  });

  it('says the same in Hindi', () => {
    ready(DATA);
    lang.set('hi');
    scan('receipt-2025-12');
    expect(pdfLinks()[0].textContent?.trim()).toBe('PDF डाउनलोड करें');
    expect(pdfLinks()[0].getAttribute('href')).toBe(FILE);
    expect(text()).toContain('परीक्षण योगदानकर्ता');
  });

  it('a hit in a saved copy still offers the file, and says it is a saved copy', () => {
    ready(DATA, { stale: true, source: 'snapshot' });
    scan('receipt-2025-12');
    expect(text()).toContain('Verified Record');
    expect(text()).toContain('saved copy');
    expect(pdfLinks()).toHaveLength(1);
  });

  it('appears once the live data has arrived, not before', () => {
    scan('receipt-2025-12');
    expect(pdfLinks()).toHaveLength(0);
    ready(DATA);
    flushSync();
    expect(pdfLinks()).toHaveLength(1);
  });
});

// ------------------------------------------------------------ the button, when it must not appear

describe('no button where the page cannot stand behind a file', () => {
  it('not for a record that is not found', () => {
    ready(DATA);
    scan('receipt-2025-777');
    expect(text()).toContain('Record Not Found');
    expect(pdfLinks()).toHaveLength(0);
  });

  it('not while the data is still loading', () => {
    scan('receipt-2025-12');
    expect(pdfLinks()).toHaveLength(0);
  });

  it('not when only an out-of-date copy was searched and the record is not in it', () => {
    ready(DATA, { stale: true, source: 'snapshot' });
    scan('receipt-2025-777');
    expect(pdfLinks()).toHaveLength(0);
    expect(text()).not.toContain('Verified Record');
  });

  it('not when there is no data at all', () => {
    portalState.set({ status: 'error', data: EMPTY_PORTAL_DATA, stale: false, savedAt: 0, version: '', failed: true, source: 'empty' });
    scan('receipt-2025-12');
    expect(pdfLinks()).toHaveLength(0);
  });

  it('not for an id of the wrong shape, nor when opened without one', () => {
    ready(DATA);
    scan('12345');
    expect(pdfLinks()).toHaveLength(0);
    unmount(app!); app = null;
    scan('');
    expect(pdfLinks()).toHaveLength(0);
  });

  it('not for a loan consent, which verifies but shows nothing else about the person', () => {
    ready(DATA);
    scan('consent_loaner-2025-CN1');
    expect(text()).toContain('Verified Record');
    expect(pdfLinks()).toHaveLength(0);
  });

  it('not when the stored link is not a web address, or is empty — the record is still verified', () => {
    for (const id of ['receipt-2025-90', 'receipt-2025-91']) {
      ready(DATA);
      scan(id);
      expect(text(), id).toContain('Verified Record');
      expect(pdfLinks(), id).toHaveLength(0);
      expect(host.innerHTML, id).not.toContain('javascript:');
      unmount(app!); app = null;
    }
  });
});

// ------------------------------------------------------------------- the rest of the page

describe('the rest of the page is as it was', () => {
  it('still offers the way back to the home page, in the current language', () => {
    ready(DATA);
    scan('receipt-2025-12');
    const back = [...host.querySelectorAll('a')].find((a) => !a.hasAttribute('target'))!;
    expect(back.getAttribute('href')).toBe('/');
    unmount(app!); app = null;
    lang.set('hi');
    scan('receipt-2025-12');
    expect([...host.querySelectorAll('a')].find((a) => !a.hasAttribute('target'))!.getAttribute('href')).toBe('/hi');
  });

  it('the retry button for an inconclusive result is untouched', () => {
    ready(DATA, { stale: true, source: 'snapshot' });
    scan('receipt-2025-777');
    expect(text()).toContain('Retry');
  });
});
