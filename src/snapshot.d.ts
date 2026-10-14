// The module src/lib/snapshot/vitePlugin.ts provides. See that file for what is in it and where.
declare module 'virtual:cpm-build-payload' {
  const payload: { fetchedAt: string; version: string; data: unknown } | null;
  export default payload;
}
