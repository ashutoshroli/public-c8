import type { ParamMatcher } from '@sveltejs/kit';

/**
 * A festival-year address segment: four digits starting 20 ('/2025'). The matcher keeps the year
 * routes from ever claiming a word like '/expenses', and keeps '/20' or '/abcd' as plain 404s.
 */
export const match: ParamMatcher = (param) => /^20\d{2}$/.test(param);
