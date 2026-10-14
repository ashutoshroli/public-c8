// Indian Standard Time helpers for the text snapshot.
//
// The build runs on Vercel in UTC. Between 18:30 and 24:00 UTC it is already tomorrow in India,
// so `new Date().getFullYear()` and `toISOString().slice(0, 10)` are wrong for this committee for
// five and a half hours of every day — and for those hours on 31 December, the whole year. Every
// date the snapshot prints, and the "current year" it uses to choose which year to show, is
// therefore computed in Asia/Kolkata explicitly.

const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' for the given instant, in IST. */
export function istDate(d: Date): string {
  return IST_DATE.format(d);
}

/** The calendar year it is in India at the given instant. */
export function istYear(d: Date): number {
  return Number(istDate(d).slice(0, 4));
}

/**
 * A 'YYYY-MM-DD' date for people: "14 Oct 2026" / "14 अक्टूबर 2026".
 * Formatted in UTC from the date's own parts so the visitor's time zone cannot move it a day.
 */
export function formatIstDate(isoDate: string, lang: 'en' | 'hi'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const when = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: lang === 'hi' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(when);
}
