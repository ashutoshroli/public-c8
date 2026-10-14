// The language in the address: the helpers that every link, canonical and hreflang is built from.

import { describe, it, expect } from 'vitest';
import { langOfPath, stripLang, localePath, otherLanguagePath, isFilePath, yearOfPath } from './url';
import { match } from '../../params/year';

describe('which language an address is in', () => {
  it('/hi and anything under /hi is Hindi; everything else is English', () => {
    for (const p of ['/hi', '/hi/', '/hi/expenses', '/hi/2025', '/hi/verify']) expect(langOfPath(p), p).toBe('hi');
    for (const p of ['/', '/expenses', '/2025', '/verify', '/history', '/hindi', '/hi-fi', '/his']) {
      expect(langOfPath(p), `${p} must not be mistaken for Hindi`).toBe('en');
    }
  });

  it('stripLang removes the prefix and only the prefix', () => {
    expect(stripLang('/hi')).toBe('/');
    expect(stripLang('/hi/expenses')).toBe('/expenses');
    expect(stripLang('/hi/2025')).toBe('/2025');
    expect(stripLang('/expenses')).toBe('/expenses');
    expect(stripLang('/history')).toBe('/history');
    expect(stripLang('/')).toBe('/');
  });
});

describe('localePath', () => {
  it('prefixes pages for Hindi and leaves English alone', () => {
    expect(localePath('/expenses', 'hi')).toBe('/hi/expenses');
    expect(localePath('/', 'hi')).toBe('/hi');
    expect(localePath('/2025', 'hi')).toBe('/hi/2025');
    expect(localePath('/expenses', 'en')).toBe('/expenses');
    expect(localePath('/', 'en')).toBe('/');
  });

  it('keeps the query and the hash, which carry a receipt’s record id and a section anchor', () => {
    expect(localePath('/verify?record=ABC.1', 'hi')).toBe('/hi/verify?record=ABC.1');
    expect(localePath('/privacy#cookies', 'hi')).toBe('/hi/privacy#cookies');
    expect(localePath('/?record=X', 'hi')).toBe('/hi?record=X');
    expect(localePath('/hi/verify?record=ABC', 'en')).toBe('/verify?record=ABC');
  });

  it('is idempotent: a path that already has the language is not prefixed twice', () => {
    expect(localePath('/hi/expenses', 'hi')).toBe('/hi/expenses');
    expect(localePath(localePath('/loans', 'hi'), 'hi')).toBe('/hi/loans');
    expect(localePath('/hi', 'hi')).toBe('/hi');
  });

  it('never gives a file a language: there is one robots.txt', () => {
    for (const f of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/.well-known/security.txt', '/icons/icon-192.png', '/robots.txt?x=1']) {
      expect(localePath(f, 'hi'), f).toBe(f);
      expect(isFilePath(f.split('?')[0]), f).toBe(true);
    }
    expect(isFilePath('/expenses')).toBe(false);
    expect(isFilePath('/hi/2025')).toBe(false);
  });
});

describe('the toggle target', () => {
  it('goes to the same page in the other language, keeping the record id of a receipt', () => {
    expect(otherLanguagePath('/expenses')).toEqual({ lang: 'hi', path: '/hi/expenses' });
    expect(otherLanguagePath('/hi/expenses')).toEqual({ lang: 'en', path: '/expenses' });
    expect(otherLanguagePath('/')).toEqual({ lang: 'hi', path: '/hi' });
    expect(otherLanguagePath('/hi')).toEqual({ lang: 'en', path: '/' });
    expect(otherLanguagePath('/verify', '?record=A1', '')).toEqual({ lang: 'hi', path: '/hi/verify?record=A1' });
    expect(otherLanguagePath('/hi/privacy', '', '#cookies')).toEqual({ lang: 'en', path: '/privacy#cookies' });
  });

  it('toggling twice comes back to the start', () => {
    for (const p of ['/', '/loans', '/2024', '/verify']) {
      const there = otherLanguagePath(p);
      expect(otherLanguagePath(there.path).path).toBe(p);
    }
  });
});

describe('year addresses', () => {
  it('a year is four digits starting 20, and only that', () => {
    expect(yearOfPath('/2025')).toBe(2025);
    expect(yearOfPath('/2017/')).toBe(2017);
    for (const p of ['/', '/expenses', '/1999', '/20', '/20255', '/2025/x', '/hi/2025']) expect(yearOfPath(p), p).toBeNull();
  });

  it('the route matcher agrees, so a word can never be taken for a year', () => {
    for (const ok of ['2017', '2025', '2099']) expect(match(ok), ok).toBe(true);
    for (const bad of ['expenses', 'loans', '2025x', '202', '12345', '1999', '']) expect(match(bad), bad).toBe(false);
  });
});
