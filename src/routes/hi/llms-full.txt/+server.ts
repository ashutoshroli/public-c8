// /hi/llms-full.txt — the accounts in plain sentences, in Hindi: the Hindi twin of /llms-full.txt.
//
// The only FILE that exists in two languages: a text file is read by a person or a model in one
// language at a time, and this one is the Hindi reading. (robots.txt, sitemap.xml and the rest stay
// at their single address.) Prerendered, like the English one.
import { config } from '$lib/config';
import { llmsFullTxt } from '$lib/crawlerFiles';
import { snapshot } from '$lib/snapshot';

export const prerender = true;

export function GET() {
  return new Response(llmsFullTxt(config.siteUrl, snapshot, 'hi'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
