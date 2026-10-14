// Which navigations the service worker must NOT answer with the cached app shell.
//
// Workbox's navigation fallback (`navigateFallback: '/'`, set by @vite-pwa/sveltekit) answers
// every navigation request that is not a precached page with the cached home page, so the client
// router can take over. That is right for a page URL and wrong for a FILE.
//
// With it, opening /robots.txt, /sitemap.xml, /llms.txt or /.well-known/security.txt in a browser
// that already has the portal installed returned the home page's shell, which then rendered the
// portal's own 404 page. The committee checking its own robots.txt would conclude the file was
// missing. Crawlers have no service worker, which is exactly why this could never show up in a
// crawl and had to be found by reasoning about the browser.
//
// Every page route of the portal is extension-less (/expenses, /loans, ...), so "the last path
// segment has a file extension" cleanly separates files from pages.
//
// Workbox tests each pattern against `url.pathname + url.search`. The first pattern therefore
// refuses to look past a '?': a receipt's QR opens `/?record=<id>`, and an id containing a "/"
// and a "." must not make that page navigation look like a file request.
export const NAVIGATE_FALLBACK_DENYLIST: RegExp[] = [
  /^[^?]*\/[^/?]+\.[A-Za-z0-9]+(?:\?.*)?$/,
  /^\/\.well-known\//,
];
