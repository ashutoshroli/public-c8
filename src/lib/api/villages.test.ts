// ====== The Download Center's village picker and name search ======
//
// On /hi/downloads the search found nobody, in any village, while /downloads worked. The picker
// used the village's NAME AS DISPLAYED as its value — Hindi in Hindi — but people were matched on
// the English name, so no Hindi village ever matched anyone. A village is now identified by its
// English name in both languages and only its label follows the language. These tests hold that,
// on data shaped like the real thing: some users have no Hindi spelling of their village, some have
// no village at all.

import { describe, it, expect } from 'vitest';
import { parsePortalData } from './schema';
import { villageOptions, villageOf, peopleInVillage } from './derive';

const user = (ID: string, Name: string, NameHi: string, Village: string, VillageHi: string) =>
  ({ ID, Name, 'Name (Hindi)': NameHi, Village, 'Village (Hindi)': VillageHi });

const DATA = parsePortalData({
  users: [
    user('U1', 'Ravi Verma', 'रवि वर्मा', 'Shaharpura', ''),                 // no Hindi spelling on THIS user ...
    user('U2', 'Sita Devi', 'सीता देवी', 'Shaharpura', 'शहरपुरा'),            // ... but this one has it
    user('U3', 'Mohan Das', 'मोहन दास', 'Gardih', 'गरडीह'),
    user('U4', 'Anil Kumar', 'अनिल कुमार', 'Karihari', 'करिहारी'),
    user('U5', 'Baghai Person', 'बघई व्यक्ति', 'Baghaidih', ''),            // a village NO user has a Hindi spelling for
    user('U6', 'No Village', 'कोई गाँव नहीं', '', ''),                         // no village at all
    user('U7', 'Rani Kumari', 'रानी कुमारी', ' Gardih ', 'गरडीह'),            // stray spaces in the ledger
  ],
})!;

describe('the options', () => {
  it('English: one option per village, the value and the label both the English name, sorted', () => {
    expect(villageOptions(DATA, 'en')).toEqual([
      { value: 'Baghaidih', label: 'Baghaidih' },
      { value: 'Gardih', label: 'Gardih' },
      { value: 'Karihari', label: 'Karihari' },
      { value: 'Shaharpura', label: 'Shaharpura' },
    ]);
  });

  it('Hindi: the label is the Hindi spelling, the value is STILL the English name', () => {
    expect(villageOptions(DATA, 'hi')).toEqual([
      { value: 'Karihari', label: 'करिहारी' },
      { value: 'Gardih', label: 'गरडीह' },
      { value: 'Shaharpura', label: 'शहरपुरा' },
      { value: 'Baghaidih', label: 'Baghaidih' },
    ]);
  });

  it('the same villages are offered in both languages — only the labels and their order differ', () => {
    const en = villageOptions(DATA, 'en').map((o) => o.value).sort();
    const hi = villageOptions(DATA, 'hi').map((o) => o.value).sort();
    expect(hi).toEqual(en);
  });

  it('a village stays in the Hindi list even if nobody in it has a Hindi spelling (it used to vanish)', () => {
    expect(villageOptions(DATA, 'hi').find((o) => o.value === 'Baghaidih')).toEqual({ value: 'Baghaidih', label: 'Baghaidih' });
  });

  it('takes the Hindi spelling from whichever user has one, not only the first user', () => {
    // U1, the first Shaharpura user, has none; U2 has it.
    expect(villageOptions(DATA, 'hi').find((o) => o.value === 'Shaharpura')!.label).toBe('शहरपुरा');
  });

  it('a user with no village adds no option, and stray spaces do not make a second village', () => {
    expect(villageOptions(DATA, 'en').map((o) => o.value)).not.toContain('');
    expect(villageOptions(DATA, 'en').filter((o) => o.value === 'Gardih')).toHaveLength(1);
    expect(villageOf(DATA.users[6])).toBe('Gardih');
  });

  it('is empty when there are no users', () => {
    expect(villageOptions(parsePortalData({})!, 'hi')).toEqual([]);
  });
});

describe('what the picker offers can be searched, in either language', () => {
  it('every option, in both languages, leads to people (the Hindi page used to lead to nobody)', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const o of villageOptions(DATA, lang)) {
        expect(peopleInVillage(DATA, o.value).length, `${lang}: ${o.label}`).toBeGreaterThan(0);
      }
    }
  });

  it('the same option value gives the same people whichever language the page is in', () => {
    const byLang = (lang: 'en' | 'hi') =>
      Object.fromEntries(villageOptions(DATA, lang).map((o) => [o.value, peopleInVillage(DATA, o.value).map((u) => u.ID)]));
    expect(byLang('hi')).toEqual(byLang('en'));
  });

  it('the Hindi LABEL is not an identity: passing it finds nobody, which is exactly what the page used to do', () => {
    expect(peopleInVillage(DATA, 'शहरपुरा')).toEqual([]);
  });

  it('lists a village’s people, including the one with stray spaces in the ledger', () => {
    expect(peopleInVillage(DATA, 'Gardih').map((u) => u.ID)).toEqual(['U3', 'U7']);
    expect(peopleInVillage(DATA, 'Shaharpura').map((u) => u.ID)).toEqual(['U1', 'U2']);
    expect(peopleInVillage(DATA, '  Gardih  ').map((u) => u.ID)).toEqual(['U3', 'U7']);
  });

  it('an unknown or empty village gives nobody', () => {
    expect(peopleInVillage(DATA, 'Nowhere')).toEqual([]);
    expect(peopleInVillage(DATA, '')).toEqual([]);
  });
});

describe('the name search', () => {
  const ids = (v: string, q: string) => peopleInVillage(DATA, v, q).map((u) => u.ID);

  it('finds by the English name, in any case', () => {
    expect(ids('Shaharpura', 'ravi')).toEqual(['U1']);
    expect(ids('Shaharpura', 'SITA')).toEqual(['U2']);
    expect(ids('Shaharpura', 'a')).toEqual(['U1', 'U2']);
  });

  it('finds by the Hindi name — and either script works on either page', () => {
    expect(ids('Shaharpura', 'सीता')).toEqual(['U2']);
    expect(ids('Shaharpura', 'रवि वर्मा')).toEqual(['U1']);
    expect(ids('Gardih', 'मोहन')).toEqual(['U3']);
  });

  it('ignores spaces around what was typed, and an empty search lists the whole village', () => {
    expect(ids('Shaharpura', '  ravi  ')).toEqual(['U1']);
    expect(ids('Shaharpura', '')).toEqual(['U1', 'U2']);
    expect(ids('Shaharpura', '   ')).toEqual(['U1', 'U2']);
  });

  it('finds nobody for a name that is not there', () => {
    expect(ids('Shaharpura', 'zzz')).toEqual([]);
    expect(ids('Shaharpura', 'मोहन')).toEqual([]); // Mohan is in Gardih
  });

  it('treats a nukta letter the same however it was stored or typed', () => {
    // ड़ is U+095C in one place and ड + U+093C in another: a phone keyboard types the second, a
    // spreadsheet may hold the first. They are the same letter to a reader.
    const stored = parsePortalData({ users: [user('N1', 'Pandey', 'बड़ी देवी', 'Gardih', 'गरडीह')] })!;
    const typedDecomposed = 'ब\u0921\u093c';
    const typedPrecomposed = 'ब\u095c';
    expect(stored.users[0]['Name (Hindi)']!.toString().includes('\u095c')).toBe(false); // stored decomposed here
    expect(peopleInVillage(stored, 'Gardih', typedDecomposed)).toHaveLength(1);
    expect(peopleInVillage(stored, 'Gardih', typedPrecomposed)).toHaveLength(1);
    const storedPre = parsePortalData({ users: [user('N2', 'Pandey', 'ब\u095cी देवी', 'Gardih', 'गरडीह')] })!;
    expect(peopleInVillage(storedPre, 'Gardih', typedDecomposed)).toHaveLength(1);
    expect(peopleInVillage(storedPre, 'Gardih', typedPrecomposed)).toHaveLength(1);
  });

  it('caps the list so a big village stays fast', () => {
    const many = parsePortalData({
      users: Array.from({ length: 120 }, (_, i) => user(`M${i}`, `Person ${i}`, `व्यक्ति ${i}`, 'Gardih', 'गरडीह')),
    })!;
    expect(peopleInVillage(many, 'Gardih', 'person')).toHaveLength(50);
    expect(peopleInVillage(many, 'Gardih', 'person', 10)).toHaveLength(10);
  });
});
