import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Fully static output (adapter-static) so this deploys to the same Vercel /
 * Cloudflare static hosting the other Public frontends use — no server runtime.
 *
 * `fallback: '404.html'`: every real page is prerendered, so the fallback is only ever reached
 * by a URL that is NOT a page. Vercel serves a root `404.html` with HTTP status 404, which is
 * what lets a crawler (and Search Console) see that a mistyped or stale link is gone. It used to
 * be `200.html`, which Vercel serves with status 200 for ANY unknown path — a "soft 404" that
 * Google reports as an error and may index as a copy of the home page. The fallback page still
 * boots the app, so the client router renders src/routes/+error.svelte for the URL.
 */
/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    alias: {
      $lib: './src/lib'
    },
    prerender: {
      // Fail the build on ANY broken internal link, 404 included. Under the old 200.html
      // fallback a link to a missing page still "worked" (it rendered the app), so 404s were
      // waved through; now the same link is a genuine 404 for a visitor and a crawler, and
      // finding that out at build time is far cheaper than finding it in Search Console.
      handleHttpError: ({ path, message }) => {
        throw new Error(message + ` (${path})`);
      }
    }
  }
};

export default config;
