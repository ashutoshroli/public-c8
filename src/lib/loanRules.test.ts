// Loan rules by year: a rule that started later must never be shown as "violated" by an older
// loan (the 2021 Praveen Kumar loan, whose guarantors included committee members, was marked
// "Rule Violation" although the ban only started in 2023).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePortalData } from '$lib/api/schema';
import { loanItems } from '$lib/api/derive';
import { t } from '$lib/i18n';
import {
  committeeGuarantorBanned,
  COMMITTEE_GUARANTOR_BAN_FROM_YEAR,
  GUARANTOR_COUNT_SINCE,
  PORTAL_CONSENT_FROM_YEAR,
  WHATSAPP_CONSENT_UNTIL_YEAR
} from '$lib/loanRules';

describe('committeeGuarantorBanned', () => {
  it('is false before 2023 and true from 2023 on', () => {
    expect(COMMITTEE_GUARANTOR_BAN_FROM_YEAR).toBe(2023);
    expect(committeeGuarantorBanned(2021)).toBe(false);
    expect(committeeGuarantorBanned(2022)).toBe(false);
    expect(committeeGuarantorBanned(2023)).toBe(true);
    expect(committeeGuarantorBanned(2025)).toBe(true);
  });

  it('treats an unknown year strictly (never waves it through)', () => {
    expect(committeeGuarantorBanned(null)).toBe(true);
    expect(committeeGuarantorBanned(undefined)).toBe(true);
    expect(committeeGuarantorBanned(NaN)).toBe(true);
  });

  it('WhatsApp consent ends the year before portal consent starts', () => {
    expect(PORTAL_CONSENT_FROM_YEAR).toBe(2026);
    expect(WHATSAPP_CONSENT_UNTIL_YEAR).toBe(2025);
    expect(GUARANTOR_COUNT_SINCE).toBe(2021);
  });
});

function dataFor(loanYear: number) {
  const data = parsePortalData({
    users: [
      { ID: 'R1', Name: 'Receiver One', Village: 'Gardih' },
      { ID: 'G1', Name: 'Committee Guarantor', Village: 'Shaharpura' },
      { ID: 'G2', Name: 'Plain Guarantor', Village: 'Shaharpura' }
    ],
    collections: [
      { Year: loanYear, ID: 'G1', Amount: '100', 'Contribution Type': '1' },
      { Year: loanYear, ID: 'G2', Amount: '100', 'Contribution Type': '1' }
    ],
    committee: [{ Year: loanYear, ID: 'G1' }],
    loans: [{ Year: loanYear, ID: 'R1', Amount: '1000', 'Intrest Rate': '2', Tenure: '10', 'Loan ID': 'LN1' }],
    guarantors: [
      { 'Loan ID': 'LN1', Guarantor: 'G1', Year: loanYear },
      { 'Loan ID': 'LN1', Guarantor: 'G2', Year: loanYear }
    ]
  });
  if (!data) throw new Error('test fixture no longer passes the portal schema');
  return data;
}

describe('loans page guarantor badges are judged by the loan year', () => {
  it('2021 loan: committee guarantor is "allowed at the time", not a violation', () => {
    const [loan] = loanItems(dataFor(2021), 2021);
    const g = loan.guarantors.find((x) => x.seed === 'G1')!;
    expect(g.isCommittee).toBe(true);
    expect(g.ruleViolation).toBe(false);
    expect(g.allowedAtTheTime).toBe(true);
  });

  it('2023 loan: committee guarantor IS a violation', () => {
    const [loan] = loanItems(dataFor(2023), 2023);
    const g = loan.guarantors.find((x) => x.seed === 'G1')!;
    expect(g.ruleViolation).toBe(true);
    expect(g.allowedAtTheTime).toBe(false);
  });

  it('a non-committee guarantor is neither, in any year', () => {
    for (const y of [2021, 2024]) {
      const [loan] = loanItems(dataFor(y), y);
      const g = loan.guarantors.find((x) => x.seed === 'G2')!;
      expect(g.ruleViolation).toBe(false);
      expect(g.allowedAtTheTime).toBe(false);
    }
  });
});

describe('/loan-rules page copy', () => {
  const keys = [
    'loan_rules_subtitle', 'lr_intro', 'lr_steps_h', 'lr_step1', 'lr_step2', 'lr_step3', 'lr_step4',
    'lr_step5', 'lr_since_h', 'lr_since_note', 'lr_from', 'lr_from_least', 'lr_until', 'lr_r_three',
    'lr_r_committee', 'lr_n_committee', 'lr_r_whatsapp', 'lr_n_whatsapp', 'lr_r_portal', 'lr_n_portal',
    'lr_n25_h', 'lr_n25_1', 'lr_n25_2', 'lr_n25_3', 'lr_n25_4', 'lr_n25_5', 'lr_n25_6', 'lr_pay_h',
    'lr_pay_p', 'lr_source', 'lr_back_loans', 'loan_rules_link', 'footer_loan_rules',
    'allowed_at_the_time', 'lr_old_loan_note'
  ];
  it('every key exists in English and Hindi and Hindi is really translated', () => {
    for (const k of keys) {
      const en = t('en', k);
      const hi = t('hi', k);
      expect(en, `${k} missing in en`).not.toBe(k);
      expect(hi, `${k} missing in hi`).not.toBe(k);
      expect(hi, `${k} hi is a copy of en`).not.toBe(en);
    }
  });

  it('the year-bearing sentences carry the years from loanRules.ts, not hard-coded numbers', () => {
    const vars = { whatsapp_until: WHATSAPP_CONSENT_UNTIL_YEAR, portal_from: PORTAL_CONSENT_FROM_YEAR };
    expect(t('en', 'lr_step4', vars)).toContain('2025');
    expect(t('en', 'lr_step4', vars)).toContain('2026');
    expect(t('hi', 'lr_pay_p', vars)).toContain('2026');
    const page = readFileSync('src/routes/loan-rules/+page.svelte', 'utf8');
    expect(page).toContain('COMMITTEE_GUARANTOR_BAN_FROM_YEAR');
    expect(page).not.toMatch(/\b2023\b/);
  });
});
