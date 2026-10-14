// The cache revision of the offline app shell (/app-shell).
//
// Workbox re-downloads a precached URL only when its revision string changes. The shell is a page
// whose body is a few lines of bootstrap script naming the app's entry chunks by their hashed file
// names, so it is out of date exactly when those names change — and out of date in a way that
// breaks the app: a cached shell naming `start.OLD.js`, after the service worker has dropped that
// file, boots nothing.
//
// The revision is therefore derived from what the shell depends on:
//   - the names of every hashed file in _app/immutable (a code change, OR a changed environment
//     value baked into the JavaScript, such as PUBLIC_API_BASE, renames a chunk);
//   - the text of src/app.html (the shell's <head> comes from it).
//
// It deliberately does NOT use the commit, or `_app/version.json`: redeploying the same commit
// with a different PUBLIC_* environment value leaves both unchanged while renaming chunks, and
// that is the stale-shell case above. Names change when the shell's references change; nothing
// else is needed, and a refresh of the accounts snapshot changes none of it.
//
// Node-only, no `$lib` imports: vite.config.ts loads this before any alias exists.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `dir`, as '/'-separated paths relative to it. */
export function listFiles(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, path));
    else out.push(path);
  }
  return out;
}

/** Pure: the same names and app.html always give the same revision, in any order. */
export function revisionFrom(fileNames: readonly string[], appHtml: string): string {
  if (fileNames.length === 0) {
    // An empty listing would give EVERY build the same revision, which is the bug this exists to
    // prevent. Stop the build instead of silently shipping it.
    throw new Error('shell revision: no files found under _app/immutable — was the client build skipped?');
  }
  return createHash('sha1')
    .update([...fileNames].sort().join('\n'))
    .update('\0')
    .update(appHtml)
    .digest('hex')
    .slice(0, 20);
}

/** Called by the PWA plugin while it generates the worker, after the client build has been written. */
export async function shellRevision(root: string = process.cwd()): Promise<string> {
  return revisionFrom(
    listFiles(join(root, '.svelte-kit/output/client/_app/immutable')),
    readFileSync(join(root, 'src/app.html'), 'utf8'),
  );
}
