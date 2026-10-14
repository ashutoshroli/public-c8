import { execSync } from 'node:child_process';
import path from 'node:path';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * The app version SvelteKit bakes into the client JavaScript.
 *
 * It defaults to a TIMESTAMP, so two builds of the SAME commit produced different chunk hashes,
 * and therefore a different service worker. The committee refreshes the accounts snapshot by
 * redeploying the unchanged commit (see README); with a timestamp that redeploy would force every
 * installed app to download a new service worker and reload, for no change in the code.
 *
 * Pinned to the commit instead (SvelteKit's own docs recommend a commit ref): a redeploy of the
 * same commit now builds byte-identical JavaScript and an identical service worker, and a new
 * commit still gets a new version. Vercel provides the commit; locally we ask git.
 *
 * With no commit to be found the fallback is a timestamp, i.e. the old behaviour: a unique version
 * per build is merely wasteful (a refresh updates installed apps), whereas a CONSTANT one would be
 * unsafe — two different builds would claim to be the same version.
 */
function appVersion() {
  const fromHost = (process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  if (/^[0-9a-f]{40}$/i.test(fromHost)) return fromHost;
  try {
    const sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (/^[0-9a-f]{40}$/i.test(sha)) return sha;
  } catch {
    /* not a git checkout */
  }
  return String(Date.now());
}

/**
 * adapter-static, plus a SECOND copy of the single-page-app fallback at /app-shell.
 *
 * `404.html` is the fallback Vercel serves — with status 404 — for an unknown URL. The service
 * worker needs the same page to answer navigations offline, and it can only precache a URL that
 * answers 200 (Workbox refuses a 4xx/5xx and would fail the whole install). `app-shell.html` is
 * that URL: byte-identical content, served as an ordinary page. See vite.config.ts.
 */
function staticAdapterWithShell(options) {
  const inner = adapter(options);
  return {
    ...inner,
    async adapt(builder) {
      await inner.adapt(builder);
      await builder.generateFallback(path.join(options.pages, 'app-shell.html'));
    }
  };
}

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
    adapter: staticAdapterWithShell({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    version: { name: appVersion() },
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
      },
      // A route that is marked for prerendering but that no link or entry reached is a page nobody
      // can find, and the build says so — EXCEPT the year pages. They exist only for years that
      // have records, so a build without data (CPM_SNAPSHOT=off, or a brand-new database) has
      // none, and that is not a mistake.
      handleUnseenRoutes: ({ routes }) => {
        const unlinked = routes.filter((id) => !/^\/(hi\/)?\[year=year\]$/.test(id));
        if (unlinked.length > 0) {
          throw new Error(
            `These routes are prerendered but nothing links to them:\n${unlinked.map((id) => `  - ${id}`).join('\n')}`
          );
        }
      }
    }
  }
};

export default config;
