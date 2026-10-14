// /.well-known/security.txt — where to report a security problem (RFC 9116).
//
// Prerendered at build time. `Expires` is computed from the build, and the file is rebuilt on
// every deploy, so it does not go stale on its own (see src/lib/crawlerFiles.ts).
import { config } from '$lib/config';
import { securityTxt } from '$lib/crawlerFiles';

export const prerender = true;

export function GET() {
  return new Response(securityTxt(config.siteUrl), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
