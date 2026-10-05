// Committee Call/WhatsApp buttons and the removal/correction contact (email, not a phone).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { CONTACT_EMAIL, whatsappUrl, telHref } from './contact';

const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('whatsappUrl', () => {
  it('adds the India code to a bare 10-digit number', () => {
    expect(whatsappUrl('9876543210')).toBe('https://wa.me/919876543210');
    expect(whatsappUrl(9876543210)).toBe('https://wa.me/919876543210');
  });

  it('keeps a number that already has a country code, and drops formatting', () => {
    expect(whatsappUrl('+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(whatsappUrl('919876543210')).toBe('https://wa.me/919876543210');
  });

  it('drops a leading trunk zero', () => {
    expect(whatsappUrl('09876543210')).toBe('https://wa.me/919876543210');
  });

  it('returns "" for anything that cannot be a number', () => {
    expect(whatsappUrl('')).toBe('');
    expect(whatsappUrl(null)).toBe('');
    expect(whatsappUrl('N/A')).toBe('');
    expect(whatsappUrl('12345')).toBe('');
  });
});

describe('telHref', () => {
  it('keeps only dialable characters', () => {
    expect(telHref('+91 98765-43210')).toBe('tel:+919876543210');
    expect(telHref('')).toBe('');
  });
});

describe('wiring', () => {
  it('the contact address is the committee email', () => {
    expect(CONTACT_EMAIL).toBe('chhath@shaharpura.com');
  });

  it('the committee page renders a Call and a WhatsApp button per member that has a number', () => {
    const page = read('routes/committee/+page.svelte');
    expect(page).toContain("telHref(m.mobile)");
    expect(page).toContain("whatsappUrl(m.mobile)");
    expect(page).toContain("$tr('call_member'");
    expect(page).toContain("$tr('whatsapp_member'");
  });

  it('the privacy page sends corrections to the email, and no longer to a phone/WhatsApp', () => {
    const page = read('routes/privacy/+page.svelte');
    expect(page).toContain('mailto:{CONTACT_EMAIL}');
    expect(page).not.toMatch(/wa\.me|whatsapp/i);
  });

  it('every removal/correction sentence points at {email}, in both languages', () => {
    const i18n = read('lib/i18n.ts');
    for (const key of ['privacy_published_p', 'privacy_rights_p', 'privacy_contact_p']) {
      const bodies = [...i18n.matchAll(new RegExp(`${key}:\\s*\\n?\\s*(['"])([\\s\\S]*?)\\1,\\n`, 'g'))].map((m) => m[2]);
      expect(bodies, `${key} should exist in en + hi`).toHaveLength(2);
      for (const b of bodies) expect(b, `${key} must mention {email}`).toContain('{email}');
    }
  });
});
