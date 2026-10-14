// /llms.txt — a map of the portal written for language models and AI search agents.
//
// Generated from the route table at build time (see src/lib/crawlerFiles.ts), prerendered so the
// site stays fully static, exactly like /sitemap.xml next to it.
import { config } from '$lib/config';
import { llmsTxt } from '$lib/crawlerFiles';
import { snapshot } from '$lib/snapshot';

export const prerender = true;

export function GET() {
  return new Response(llmsTxt(config.siteUrl, { fullTextAsOf: snapshot?.asOf, years: snapshot?.years }), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
