// /llms-full.txt — the accounts written out in plain sentences, for every data page, in one file.
//
// The same text the pages carry at the bottom (src/lib/snapshot), as Markdown, from the data the
// build fetched. Prerendered: it is as fresh as the last deploy, which is also when the sitemap's
// `lastmod` for these pages moves.
import { config } from '$lib/config';
import { llmsFullTxt } from '$lib/crawlerFiles';
import { snapshot } from '$lib/snapshot';

export const prerender = true;

export function GET() {
  return new Response(llmsFullTxt(config.siteUrl, snapshot), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
