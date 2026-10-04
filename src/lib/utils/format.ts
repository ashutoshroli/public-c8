/**
 * Number / currency helpers — behaviour matches Public/frontend-v3/script.js
 * exactly so displayed values are identical to the existing portals.
 */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

/** Format as Indian Rupees, no decimals (matches `fmt`). */
export function fmt(n: number | null | undefined): string {
  return inr.format(n || 0);
}

const inrPlain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
/** Format a plain number with Indian grouping (no currency symbol). */
export function fmtNum(n: number | null | undefined): string {
  return inrPlain.format(n || 0);
}

/**
 * Strip everything except digits/dot/minus, then parseFloat (matches `parseAmt`).
 * The single amount-parsing helper used in every financial sum.
 */
export function parseAmt(v: unknown): number {
  return parseFloat((v ?? '').toString().replace(/[^0-9.-]+/g, '')) || 0;
}

/** Only allow http(s) URLs (matches `safeUrl`). */
export function safeUrl(v: unknown): string {
  const raw = (v ?? '').toString().trim();
  return /^https?:\/\//i.test(raw) ? raw : '';
}

/**
 * Whether to render a contributor's profile photo vs. the initials fallback.
 * Show the photo only when there is a non-empty URL AND the image has not
 * failed to load. Centralised so the decision is identical everywhere it is
 * used (ContributorCard / ContributorsListModal / ContributorDetail) and can
 * be unit-tested without a DOM.
 */
export function shouldShowPhoto(photo: string | null | undefined, failed: boolean): boolean {
  return !!photo && !failed;
}

/** First character of a name, uppercased — used for avatar fallbacks. */
export function initials(name: unknown): string {
  const s = (name ?? '').toString().trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/** Deterministic colour pair for an avatar, seeded by a string. v8 uses a
 *  restrained, near-flat set of deep tones (white initials stay readable). */
const AVATAR_COLORS: [string, string][] = [
  ['#0b6b4f', '#0f7a5a'],
  ['#2557a7', '#2f64b8'],
  ['#8a5a14', '#9a6a1f'],
  ['#5b4b8a', '#6a5a9a'],
  ['#9b3d3d', '#ab4b4b'],
  ['#2f6f73', '#3a7f83'],
  ['#4d5b53', '#5b6a61'],
  ['#7a4a2b', '#8a5a3b']
];
export function avatarGradient(seed: unknown): [string, string] {
  const s = (seed ?? '').toString();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
