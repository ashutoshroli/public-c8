// Privacy / Terms / Loan-rules wording guards.
//
// These pin the decisions made when the pages were reviewed: no claim the portal cannot back up,
// real retention numbers taken from the backend code, and a "Last updated" date that cannot go
// stale because the wording is hashed.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { T, t } from '$lib/i18n';
import { POLICY_LAST_UPDATED, formatPolicyDate } from '$lib/policyDates';
import { parsePortalData } from '$lib/api/schema';
import { loanItems } from '$lib/api/derive';
import { simpleInterest, minInterestMonths } from '$lib/loanRules';

// sha256 of every privacy_* / terms_* string in both languages. When this fails you changed the
// policy wording: bump POLICY_LAST_UPDATED in src/lib/policyDates.ts, then paste the new hash.
const POLICY_TEXT_HASH = '2f942882f161b315a22de36875f8eaa1b21bb5d9944552268c093a2324f286d5';

function policyHash(): string {
  const rows: string[] = [];
  for (const lang of ['en', 'hi'] as const) {
    for (const key of Object.keys(T[lang]).sort()) {
      if (key.startsWith('privacy_') || key.startsWith('terms_')) rows.push(`${lang}:${key}=${T[lang][key]}`);
    }
  }
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

describe('"Last updated" cannot go stale', () => {
  it('the policy wording matches the hash recorded with the current date', () => {
    expect(
      policyHash(),
      `Policy wording changed. Bump POLICY_LAST_UPDATED (now ${POLICY_LAST_UPDATED}) in policyDates.ts, then set POLICY_TEXT_HASH to ${policyHash()}`
    ).toBe(POLICY_TEXT_HASH);
  });

  it('the date is valid and formats in both languages', () => {
    expect(POLICY_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatPolicyDate('2026-10-07', 'en')).toBe('7 October 2026');
    expect(formatPolicyDate('2026-10-07', 'hi')).toBe('7 अक्टूबर 2026');
    expect(formatPolicyDate('not-a-date', 'en')).toBe('not-a-date');
    expect(t('en', 'policy_dates', { updated: 'A' })).toBe('Last updated: A');
    expect(t('hi', 'policy_dates', { updated: 'A' })).toBe('अंतिम अद्यतन: A');
  });
});

describe('privacy wording stays factual', () => {
  const all = (lang: 'en' | 'hi') =>
    Object.keys(T[lang])
      .filter((k) => k.startsWith('privacy_') || k.startsWith('terms_'))
      .map((k) => T[lang][k])
      .join('\n');

  it('no absolute cookie promise and no claim that the portal "complies" with a law', () => {
    for (const lang of ['en', 'hi'] as const) {
      expect(all(lang)).not.toMatch(/Nothing else on this portal uses cookies/);
      expect(all(lang)).not.toMatch(/और कुछ भी cookies इस्तेमाल नहीं करता/);
      expect(all(lang)).not.toMatch(/DPDP|complies with|compliant/i);
    }
    expect(t('en', 'privacy_cookies_p')).toContain('does not intentionally use additional tracking cookies');
  });

  it('does not promise anything on behalf of Google or Microsoft beyond what they state', () => {
    const en = t('en', 'privacy_cookies_p');
    expect(en).toContain('Google says Google Analytics does not log or store individual IP addresses');
    expect(en).not.toMatch(/Microsoft[^.]*(does not|doesn.t) (store|log)/i);
    expect(en).toContain('Clarity');
    expect(en).toContain('clicks, taps, scrolling');
    expect(en).toContain('sensitive content masked');
  });

  it('retention numbers come from the backend code (180 / 2 days / 90)', () => {
    const en = t('en', 'privacy_retention_p');
    expect(en).toContain('180 days');
    expect(en).toContain('two days');
    expect(en).toContain('90 days');
    expect(en).not.toMatch(/short-lived|as soon as/);
    const hi = t('hi', 'privacy_retention_p');
    for (const n of ['180', '90']) expect(hi).toContain(n);
  });

  it('describes turning notifications off the way it really works (server learns on the next failed delivery)', () => {
    expect(t('en', 'privacy_push_p')).toContain('next time delivery to it fails');
    expect(t('en', 'privacy_retention_p')).toContain('when delivery to it next fails');
  });

  it('does not claim "minimum information" while father’s name and photo are published', () => {
    for (const lang of ['en', 'hi'] as const) expect(all(lang)).not.toMatch(/minimum information|न्यूनतम जानकारी/i);
  });
});

describe('terms', () => {
  it('has a fair-use clause and a contact with the committee email', () => {
    expect(t('en', 'terms_misuse_p')).toContain('do not misuse');
    expect(t('en', 'terms_contact_p', { email: 'a@b.c' })).toContain('a@b.c');
    expect(t('hi', 'terms_contact_p', { email: 'a@b.c' })).toContain('a@b.c');
  });

  it('refund wording is untouched', () => {
    expect(t('en', 'terms_donations_p')).toContain('no refund will be made');
    expect(t('hi', 'terms_donations_p')).toContain('कोई रिफ़ंड नहीं किया जाएगा');
  });

  it('both policy pages show the version line', () => {
    for (const f of ['src/routes/terms/+page.svelte', 'src/routes/privacy/+page.svelte']) {
      expect(readFileSync(f, 'utf8'), f).toContain("$tr('policy_dates'");
    }
  });
});

describe('loan rules wording', () => {
  it('says "borrower", never "loaner", on the loan-rules page', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const key of Object.keys(T[lang]).filter((k) => k.startsWith('lr_'))) {
        expect(T[lang][key], `${lang}:${key}`).not.toMatch(/loaner/i);
      }
    }
  });

  it('has the historical-rule principle box and the one-line bidding explanation', () => {
    const page = readFileSync('src/routes/loan-rules/+page.svelte', 'utf8');
    expect(page).toContain("$tl('lr_principle_h')");
    expect(page).toContain("$tl('lr_bid_note')");
    expect(t('en', 'lr_bid_note')).toContain('interest-rate bidding process');
  });

  it('writes the rules the committee decided, and only those', () => {
    const en = (k: string, v: Record<string, string | number> = {}) => t('en', k, v);
    // bids happen in the WhatsApp group; tie goes to whoever first provides 3 valid guarantors
    expect(en('lr_step2')).toContain('committee WhatsApp group');
    expect(en('lr_tie')).toContain('first provides 3 valid guarantors');
    // repayment: day after Diwali, no fixed calendar date
    expect(en('lr_pay_1')).toContain('the day after Diwali');
    expect(en('lr_pay_1')).toContain('no fixed calendar date'.replace('no', 'There is no'));
    // guarantors: principal + full interest, equal shares, Chhath morning Arghya in any case
    const p3 = en('lr_pay_3', { arghya_from: 2026 });
    expect(p3).toContain('principal plus the full interest');
    expect(p3).toContain('one third each');
    expect(p3).toContain('morning Arghya of Chhath');
    expect(p3).toContain('in any case');
    // minimum interest period: 11 months, 10 until 2024, full period even when repaid early
    const p2 = en('lr_pay_2', { interest_until: 2024 });
    expect(p2).toContain('11 months');
    expect(p2).toContain('10 months until 2024');
    expect(p2).toContain('Even if the borrower repays earlier');
    // nothing the committee has not decided
    const all = Object.keys(T.en).filter((k) => k.startsWith('lr_')).map((k) => T.en[k]).join('\n');
    expect(all).not.toMatch(/late fee|penalt|jointly|compound/i);
  });
});

describe('interest: simple monthly, matching what the portal itself computes', () => {
  it('simpleInterest = principal × monthly rate × months', () => {
    expect(simpleInterest(10000, 2, 11)).toBe(2200);
    expect(simpleInterest(8115, 2.42, 10)).toBeCloseTo(1963.83, 2);
  });

  it('the worked example on the page is that number', () => {
    expect(t('en', 'lr_int_ex')).toContain('₹2,200');
    expect(t('en', 'lr_int_ex')).toContain('₹12,200');
    expect(t('hi', 'lr_int_ex')).toContain('₹2,200');
    expect(simpleInterest(10000, 2, 11) + 10000).toBe(12200);
  });

  it('the loans page formula (derive.ts) agrees with simpleInterest', () => {
    const data = parsePortalData({
      users: [{ ID: 'R1', Name: 'Receiver One', Village: 'Gardih' }],
      collections: [],
      committee: [],
      loans: [{ Year: 2021, ID: 'R1', Amount: '8115', 'Intrest Rate': '2.42', Tenure: '10', 'Loan ID': 'LN1' }],
      guarantors: []
    });
    if (!data) throw new Error('fixture failed the portal schema');
    const [loan] = loanItems(data, 2021);
    expect(loan.interest).toBeCloseTo(simpleInterest(8115, 2.42, 10), 2);
  });

  it('minimum interest months: 10 until 2024, 11 from 2025', () => {
    expect(minInterestMonths(2021)).toBe(10);
    expect(minInterestMonths(2024)).toBe(10);
    expect(minInterestMonths(2025)).toBe(11);
    expect(minInterestMonths(2026)).toBe(11);
  });
});

describe('bold markers (**…**) in copy', () => {
  it('are balanced in every string, in both languages', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const [k, v] of Object.entries(T[lang])) {
        expect((v.match(/\*\*/g) || []).length % 2, `${lang}:${k} has an unbalanced **`).toBe(0);
      }
    }
  });

  it('the key terms are bold: no refund, 11 months, 3 guarantors', () => {
    expect(t('en', 'terms_donations_p')).toContain('**no refund will be made**');
    expect(t('hi', 'terms_donations_p')).toContain('**कोई रिफ़ंड नहीं किया जाएगा**');
    expect(t('en', 'lr_n25_6')).toContain('**11 months**');
    expect(t('en', 'lr_n25_3')).toContain('**3 guarantors**');
  });
});

describe('Terms: governing law and jurisdiction', () => {
  it('names only the courts at Giridih, Jharkhand', () => {
    expect(t('en', 'terms_law_p')).toContain('Only the courts at Giridih, Jharkhand');
    expect(t('hi', 'terms_law_p')).toContain('केवल गिरिडीह (झारखंड) के न्यायालयों');
  });
});

describe('Privacy: committee decisions', () => {
  it('response time 7 to 30 days, and the reason loans cannot be anonymous', () => {
    expect(t('en', 'privacy_rights_p', { email: 'x@y.z' })).toContain('within 7 to 30 days');
    expect(t('hi', 'privacy_rights_p', { email: 'x@y.z' })).toContain('7 से 30 दिनों');
    expect(t('en', 'privacy_rights_p', { email: 'x@y.z' })).toContain('financial obligation');
  });

  it('keeps the security line accurate: read-only except error reports and sign-ups', () => {
    expect(t('en', 'privacy_security_p')).toContain('Apart from error reports and notification sign-ups');
  });

  it('no changelog words ("now", "no longer") in the fonts sentence', () => {
    expect(t('en', 'privacy_thirdparty_p')).not.toMatch(/Fonts are now|no longer sees/);
  });
});
