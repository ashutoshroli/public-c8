/**
 * Version stamp shown on the Privacy and Terms pages.
 *
 * Bump POLICY_LAST_UPDATED whenever the wording of a privacy_* / terms_* string changes. The
 * test in policyUpdate.test.ts pins a hash of that wording, so changing the text without
 * revisiting this date fails the build instead of leaving a stale "Last updated" line.
 * (No "Effective from" date is shown: the committee has not fixed one yet.)
 */
export const POLICY_LAST_UPDATED = '2026-10-11';

/** "11 October 2026" / "11 अक्टूबर 2026" — fixed to UTC so the day never shifts with the viewer's zone. */
export function formatPolicyDate(iso: string, lang: 'en' | 'hi'): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}
