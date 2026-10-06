// Anonymity policy copy (privacy + terms). Kept in its own file so it never collides with the
// loan-rules tests.

import { describe, it, expect } from 'vitest';
import { t } from '$lib/i18n';

describe('anonymity policy copy (privacy + terms)', () => {
  it('privacy: applies to current AND earlier years, is permanent, and later years must be asked for', () => {
    const en = t('en', 'privacy_rights_p', { email: 'x@y.z' });
    expect(en).toContain('current year and in all earlier years');
    expect(en).toContain('permanent');
    expect(en).toContain('will not show them by name again');
    expect(en).toContain('tell the committee when you contribute');
    expect(en).toContain('cannot be made anonymous'); // loan records stay the exception
    const hi = t('hi', 'privacy_rights_p', { email: 'x@y.z' });
    expect(hi).toContain('पिछले सभी वर्षों');
    expect(hi).toContain('स्थायी');
    expect(hi).toContain('योगदान देते समय');
    expect(hi).toContain('गुमनाम नहीं किया जा सकता');
  });

  it('terms: says to ask for anonymity at the time of contributing', () => {
    expect(t('en', 'terms_donations_p')).toContain('tell the committee when you contribute');
    expect(t('hi', 'terms_donations_p')).toContain('योगदान देते समय');
  });
});
