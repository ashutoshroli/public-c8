// ====== verifyRecord(): which record a scanned QR is, and the PDF that belongs to it ======
//
// The QR printed on every receipt and certificate opens the portal with `?record=<docType>-<year>-<ref>`.
// A record is VERIFIED when the committee's generated-files list holds exactly that id; for the
// collection-backed documents the row it was built from is looked up too, to show the visitor the
// name, village and amount to check against the paper.
//
// The same row holds the document's PDF link, and `fileLink` hands it to the page so that a visitor
// who has just verified a receipt can open the file. These tests pin what it returns, and — as
// important — when it returns nothing.

import { describe, it, expect } from 'vitest';
import { parsePortalData } from './schema';
import { verifyRecord, downloadsForPerson } from './derive';

const LINK = (name: string) => `https://files.example/2025/${name}.pdf`;

const DATA = parsePortalData({
  users: [
    { ID: 'USER0007', Name: 'Test Contributor', 'Name (Hindi)': 'परीक्षण योगदानकर्ता', Village: 'Shaharpura', 'Village (Hindi)': 'शहरपुरा' },
  ],
  collections: [
    { __rowIndex: 12, Year: 2025, Name: 'USER0007', Amount: 500, 'Contribution Type': '1', Detail: 'Cash', 'Is Resell': 'FALSE' },
    { __rowIndex: 13, Year: 2025, Name: 'USER0007', Amount: 0, 'Contribution Type': '2', Detail: 'Tent', 'Is Resell': 'FALSE' },
    { __rowIndex: 14, Year: 2025, Name: 'USER0007', Amount: 0, 'Contribution Type': '3', Detail: 'Painting', 'Is Resell': 'FALSE' },
    { __rowIndex: 15, Year: 2025, Name: 'USER0007', Amount: 100, 'Contribution Type': '1', 'Certificate Or Receipt': 'Certificate', 'Is Resell': 'FALSE' },
    { __rowIndex: 16, Year: 2025, Name: 'Old tent', Amount: 900, Detail: 'Old tent', 'Is Resell': 'TRUE' },
  ],
  generatedFiles: [
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-12', public_link: LINK('receipt-12') },
    { doc_type: 'samaan', year: 2025, record_id: 'samaan-2025-13', public_link: LINK('samaan-13') },
    { doc_type: 'receipt_work', year: 2025, record_id: 'receipt_work-2025-14', public_link: LINK('work-14') },
    { doc_type: 'certificate', year: 2025, record_id: 'certificate-2025-15', public_link: LINK('certificate-15') },
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-16', public_link: LINK('resell-16') },
    // Loan consents: verified like the rest, but they carry a photo and a signature.
    { doc_type: 'consent_loaner', year: 2025, record_id: 'consent_loaner-2025-CN1', public_link: LINK('consent-loaner') },
    { doc_type: 'consent_guarantor', year: 2025, record_id: 'consent_guarantor-2025-CN2', public_link: LINK('consent-guarantor') },
    // Rows whose link cannot be trusted or is not there.
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-90', public_link: 'javascript:alert(1)' },
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-91', public_link: '' },
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-92', public_link: 'ftp://files.example/x.pdf' },
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-93', public_link: '   https://files.example/2025/spaced.pdf  ' },
    { doc_type: 'receipt', year: 2025, record_id: 'receipt-2025-1', public_link: LINK('receipt-1') },
  ],
})!;

describe('the PDF of a verified collection document', () => {
  it.each([
    ['receipt-2025-12', 'receipt-12'],
    ['samaan-2025-13', 'samaan-13'],
    ['receipt_work-2025-14', 'work-14'],
    ['certificate-2025-15', 'certificate-15'],
  ])('%s hands back its own file', (id, file) => {
    const r = verifyRecord(DATA, id);
    expect(r.verified).toBe(true);
    expect(r.fileLink).toBe(LINK(file));
  });

  it('is the row for THIS record, not one that merely starts the same: receipt-2025-1 is not receipt-2025-12', () => {
    expect(verifyRecord(DATA, 'receipt-2025-1').fileLink).toBe(LINK('receipt-1'));
    expect(verifyRecord(DATA, 'receipt-2025-12').fileLink).toBe(LINK('receipt-12'));
    expect(verifyRecord(DATA, 'receipt-2025-2').verified).toBe(false);
  });

  it('is the very link the Download Center offers for the same document', () => {
    for (const doc of downloadsForPerson(DATA, 'USER0007').flatMap((g) => g.docs)) {
      expect(doc.publicLink, doc.recordId).not.toBe('');
      expect(verifyRecord(DATA, doc.recordId).fileLink, doc.recordId).toBe(doc.publicLink);
    }
  });

  it('comes with the same details as before — name, village, amount, detail', () => {
    const r = verifyRecord(DATA, 'receipt-2025-12');
    expect(r.details).toEqual({
      name: 'Test Contributor', nameHindi: 'परीक्षण योगदानकर्ता',
      village: 'Shaharpura', villageHindi: 'शहरपुरा', amount: 500, detail: 'Cash', isResell: false,
    });
    expect(r.docLabelKey).toBe('doc_receipt');
    expect(r.year).toBe('2025');
  });

  it('is trimmed of stray spaces', () => {
    expect(verifyRecord(DATA, 'receipt-2025-93').fileLink).toBe('https://files.example/2025/spaced.pdf');
  });
});

describe('when there is no link to give', () => {
  it('a record that is not in the list is not verified and has none', () => {
    const r = verifyRecord(DATA, 'receipt-2025-777');
    expect(r.verified).toBe(false);
    expect(r.fileLink).toBe('');
    expect(r.details).toBeNull();
  });

  it('a malformed id has none', () => {
    for (const id of ['', 'receipt', 'receipt-2025', '12345']) {
      const r = verifyRecord(DATA, id);
      expect(r.malformed, id).toBe(true);
      expect(r.fileLink, id).toBe('');
    }
  });

  it('a verified record whose link is not a plain web address has none — the record is still verified', () => {
    for (const id of ['receipt-2025-90', 'receipt-2025-91', 'receipt-2025-92']) {
      const r = verifyRecord(DATA, id);
      expect(r.verified, id).toBe(true);
      expect(r.fileLink, id).toBe('');
    }
  });

  it('with no generated files at all (as the live list is today) nothing verifies and nothing links', () => {
    const empty = parsePortalData({ users: DATA.users, collections: DATA.collections })!;
    for (const id of ['receipt-2025-12', 'certificate-2025-15']) {
      const r = verifyRecord(empty, id);
      expect(r.verified).toBe(false);
      expect(r.fileLink).toBe('');
    }
  });
});

describe('loan-consent documents', () => {
  it('verify, but never carry a link on this page', () => {
    for (const id of ['consent_loaner-2025-CN1', 'consent_guarantor-2025-CN2']) {
      const r = verifyRecord(DATA, id);
      expect(r.verified, id).toBe(true);
      expect(r.fileLink, `${id}: the verify page shows nothing else about a consent, and the file has a photo and a signature`).toBe('');
      expect(r.details).toBeNull();
    }
  });
});

describe('a resold item', () => {
  it('still verifies and shows what was sold; its link follows the same rule as any receipt', () => {
    const r = verifyRecord(DATA, 'receipt-2025-16');
    expect(r.verified).toBe(true);
    expect(r.details).toMatchObject({ isResell: true, name: 'Old tent', amount: 900 });
    expect(r.fileLink).toBe(LINK('resell-16'));
  });
});
