/**
 * Loan rules and the year each one started — ONE source of truth for the loans page badge,
 * the /loan-rules page and the tests.
 *
 * A loan is judged by the rules of the year it was given, so a rule that started later must
 * never be shown as "violated" by an older loan.
 *
 *  - 3 guarantors per loan: in force at least since 2021 (the oldest loan on the portal).
 *  - Committee members may not stand guarantor: from 2023.
 *  - Guarantor consent was given in the committee WhatsApp group until 2025; from 2026 it is
 *    given on the portal's consent page.
 */
export const GUARANTOR_COUNT = 3;
export const GUARANTOR_COUNT_SINCE = 2021;
export const COMMITTEE_GUARANTOR_BAN_FROM_YEAR = 2023;
export const PORTAL_CONSENT_FROM_YEAR = 2026;
export const WHATSAPP_CONSENT_UNTIL_YEAR = PORTAL_CONSENT_FROM_YEAR - 1;

/**
 * Is a committee-member guarantor against the rules for a loan given in `loanYear`?
 * An unknown year is judged by the current rule (the strict reading), never waved through.
 */
export function committeeGuarantorBanned(loanYear: number | null | undefined): boolean {
  if (loanYear === null || loanYear === undefined || !Number.isFinite(loanYear)) return true;
  return loanYear >= COMMITTEE_GUARANTOR_BAN_FROM_YEAR;
}

/** Minimum interest period: 10 months until 2024, 11 months from 2025. */
export const INTEREST_10_MONTHS_UNTIL_YEAR = 2024;
export const INTEREST_11_MONTHS_FROM_YEAR = INTEREST_10_MONTHS_UNTIL_YEAR + 1;
export const MIN_INTEREST_MONTHS_NOW = 11;
export function minInterestMonths(loanYear: number): number {
  return loanYear <= INTEREST_10_MONTHS_UNTIL_YEAR ? 10 : MIN_INTEREST_MONTHS_NOW;
}

/** From 2026 the guarantors must pay by the morning Arghya of Chhath, in any case. */
export const GUARANTOR_ARGHYA_FROM_YEAR = 2026;

/** Simple monthly interest: principal × monthly rate (in %) × months. */
export function simpleInterest(principal: number, monthlyRatePct: number, months: number): number {
  return Math.round(principal * (monthlyRatePct / 100) * months * 100) / 100;
}
