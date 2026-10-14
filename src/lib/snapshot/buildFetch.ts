// ====== Fetching the data for the text snapshot, at build time ======
//
// Runs in Node while `vite build` runs (see vitePlugin.ts), on Vercel or on a laptop. It imports
// nothing from `$lib` or `$app`, because the Vite config that loads it is bundled before any alias
// exists.
//
// THE POLICY, and why it is this one
// ----------------------------------
// The snapshot is read from the API when the site is BUILT, so a build that cannot reach the API
// has a choice: ship a site with no accounts text, or not ship. It does not ship.
//
// Vercel keeps serving the previous good deployment when a build fails, and that deployment has
// last time's accounts in its HTML. A fresh deployment with an empty text section would REPLACE a
// working snapshot with nothing, and a crawler that happened to visit in the next hour would
// index "no records" for a committee that has them. Failing loudly is the safer default and the
// committee notices at once: the redeploy they pressed is red.
//
// Two environment variables are the way out when the API is down for a long time and a deploy
// cannot wait. Both are set on purpose, in the Vercel project, and both are documented in README:
//   CPM_SNAPSHOT=off              skip the snapshot entirely (no network at build)
//   CPM_SNAPSHOT_ALLOW_EMPTY=1    if the API cannot be reached, build anyway without a snapshot

export interface SnapshotPolicy {
  mode: 'on' | 'off';
  allowEmpty: boolean;
}

const truthy = (v: string | undefined) => /^(1|true|yes|on)$/i.test((v ?? '').trim());
const falsy = (v: string | undefined) => /^(0|off|false|no)$/i.test((v ?? '').trim());

export function snapshotPolicy(env: Record<string, string | undefined>): SnapshotPolicy {
  return {
    mode: falsy(env.CPM_SNAPSHOT) ? 'off' : 'on',
    allowEmpty: truthy(env.CPM_SNAPSHOT_ALLOW_EMPTY),
  };
}

/** What the build keeps of the API response. `data` is the raw `portalData` JSON. */
export interface BuildPayload {
  /** ISO instant the data was fetched. */
  fetchedAt: string;
  /** The API's data-version token, or ''. */
  version: string;
  data: unknown;
}

export class SnapshotFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotFetchError';
  }
}

export interface FetchOptions {
  apiBase: string;
  /** Total tries, first included. */
  attempts?: number;
  timeoutMs?: number;
  /** Pause before the 2nd, 3rd … try. */
  backoffMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
  now?: () => Date;
}

const rows = (j: Record<string, unknown>, key: string) => (Array.isArray(j[key]) ? (j[key] as unknown[]).length : 0);

/**
 * Why a response should not become a snapshot, or null when it is fine. A response that parses
 * but has no ledger in it is treated like a failed request: the Worker answering 200 with empty
 * arrays is what a half-failed D1 read looks like, and it is exactly the case we must not publish.
 */
export function problemWith(json: unknown): string | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return 'the response was not a JSON object';
  const j = json as Record<string, unknown>;
  if (!Array.isArray(j.collections)) return 'the response has no "collections" list';
  if (rows(j, 'collections') + rows(j, 'expenses') + rows(j, 'loans') === 0) {
    return 'the response has no contributions, expenses or loans in it (an empty ledger)';
  }
  return null;
}

async function getJson(fetchImpl: typeof fetch, url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error(`timed out after ${timeoutMs} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch `portalData` the way the browser client does (dataVersion first, then portalData with the
 * version so the edge cache cannot hand back an older copy), retrying a few times.
 * Throws SnapshotFetchError when every attempt failed.
 */
export async function fetchBuildPayload(opts: FetchOptions): Promise<BuildPayload> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const backoff = opts.backoffMs ?? [1_500, 4_000];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = opts.log ?? (() => {});
  const now = opts.now ?? (() => new Date());
  const base = opts.apiBase.replace(/\/+$/, '');

  const failures: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now();
    try {
      let version = '';
      try {
        const vr = (await getJson(fetchImpl, `${base}/?action=dataVersion`, timeoutMs)) as { v?: unknown } | null;
        if (vr && vr.v != null) version = String(vr.v);
      } catch {
        /* the version only keeps a stale edge copy away; the data itself is what matters */
      }
      const vq = version ? `&v=${encodeURIComponent(version)}` : '';
      const data = await getJson(fetchImpl, `${base}/?action=portalData${vq}`, timeoutMs);

      const problem = problemWith(data);
      if (problem) throw new Error(problem);
      if ((data as { stale?: unknown }).stale === true) {
        log(`[snapshot] warning: the Worker says this data is a last-known-good copy (stale), not a fresh read.`);
      }
      log(`[snapshot] fetched portalData${version ? ` (data version ${version})` : ''} in ${Date.now() - started} ms, attempt ${attempt} of ${attempts}.`);
      return { fetchedAt: now().toISOString(), version, data };
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      failures.push(`attempt ${attempt}: ${why}`);
      log(`[snapshot] attempt ${attempt} of ${attempts} failed: ${why}`);
      if (attempt < attempts) await sleep(backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 0);
    }
  }

  throw new SnapshotFetchError(
    `Could not fetch the accounts from ${base} after ${attempts} attempts (${failures.join('; ')}).\n` +
      `The build was stopped on purpose: Vercel keeps serving the previous deployment, which still has the last good\n` +
      `snapshot in its HTML. Shipping a site with an empty snapshot over it would be worse.\n` +
      `Check that the Worker is up, then redeploy. If a deploy cannot wait, set CPM_SNAPSHOT_ALLOW_EMPTY=1 (build\n` +
      `without a snapshot if the API is unreachable) or CPM_SNAPSHOT=off (skip it) in the Vercel project's environment.`,
  );
}

/** The whole decision, in one place: policy + fetch -> a payload, or null for "no snapshot". */
export async function resolveBuildPayload(
  env: Record<string, string | undefined>,
  opts: Omit<FetchOptions, 'apiBase'> & { apiBase: string },
): Promise<BuildPayload | null> {
  const policy = snapshotPolicy(env);
  const log = opts.log ?? (() => {});
  if (policy.mode === 'off') {
    log('[snapshot] CPM_SNAPSHOT=off: building without an accounts snapshot.');
    return null;
  }
  try {
    return await fetchBuildPayload(opts);
  } catch (err) {
    if (policy.allowEmpty) {
      log(`[snapshot] CPM_SNAPSHOT_ALLOW_EMPTY is set, so the build continues WITHOUT a snapshot.\n${err instanceof Error ? err.message : err}`);
      return null;
    }
    throw err;
  }
}
