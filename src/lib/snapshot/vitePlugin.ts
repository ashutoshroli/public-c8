// ====== Vite plugin: the build-time data, as a module only the SERVER bundle can import ======
//
// `import payload from 'virtual:cpm-build-payload'`
//
//   server bundle  the JSON fetched from the API when the build started (or null, see buildFetch.ts)
//   client bundle  `null`, always — so the accounts, and the people in them, are never shipped to a
//                  browser inside JavaScript. The only copy that reaches a visitor is the
//                  name-free text rendered into the HTML.
//   dev / tests    `null`, and no network is touched.
//
// The payload is raw `portalData`, names included. That is deliberate and safe: it lives in
// `.svelte-kit/output/server`, which is not deployed (only `build/` is), and the facts built from
// it (facts.ts) are what reach the page. Building the facts in the app's own bundle, rather than
// here, keeps the Vite config free of the `$lib` aliases it cannot resolve.
//
// Fetched lazily, once per process, the first time the server graph asks for it.

import type { Plugin } from 'vite';
import { DEFAULTS } from '../config.ts';
import { resolveBuildPayload, type BuildPayload, type FetchOptions } from './buildFetch.ts';

const ID = 'virtual:cpm-build-payload';
const RESOLVED = `\0${ID}`;
const EMPTY = 'export default null;';

/** `tuning` exists for tests (no real waiting between attempts); the build passes nothing. */
export function buildPayloadPlugin(
  env: Record<string, string | undefined> = process.env,
  tuning: Pick<FetchOptions, 'attempts' | 'backoffMs' | 'sleep' | 'timeoutMs'> = {},
): Plugin {
  let command: 'build' | 'serve' = 'serve';
  let pending: Promise<BuildPayload | null> | null = null;

  const apiBase = () => (env.PUBLIC_API_BASE ?? '').trim() || DEFAULTS.PUBLIC_API_BASE;

  return {
    name: 'cpm-build-payload',
    enforce: 'pre',
    configResolved(config) {
      command = config.command;
    },
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    async load(id, options) {
      if (id !== RESOLVED) return null;
      const isServerBuild = options?.ssr === true;
      if (!isServerBuild || command !== 'build' || env.VITEST) return EMPTY;
      // eslint-disable-next-line no-console
      pending ??= resolveBuildPayload(env, { ...tuning, apiBase: apiBase(), log: (m) => console.info(m) });
      const payload = await pending;
      return payload ? `export default ${JSON.stringify(payload)};` : EMPTY;
    },
  };
}
