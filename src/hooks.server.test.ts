// ====== hooks.server.ts: the <html lang> of a prerendered page ======
//
// app.html is one template with <html lang="en">. The hook relabels the Hindi pages, which is what
// a search engine, a screen reader and the browser's translate prompt trust before they read a word.

import { describe, it, expect } from 'vitest';
import { handle } from './hooks.server';

const HTML = '<!doctype html>\n<html lang="en" class="scroll-smooth">\n<head></head><body></body></html>';

/** Runs the hook for `path` and returns what it does to the first chunk of HTML. */
async function chunkFor(path: string): Promise<string> {
  let transform: ((i: { html: string; done: boolean }) => string | undefined) | undefined;
  const event = { url: new URL(path, 'https://chhath.test') } as never;
  const resolve = (async (_e: unknown, opts?: { transformPageChunk?: typeof transform }) => {
    transform = opts?.transformPageChunk;
    return new Response('ok');
  }) as never;
  await handle({ event, resolve } as never);
  expect(transform, 'the hook must register a transformPageChunk').toBeTypeOf('function');
  return transform!({ html: HTML, done: true }) ?? HTML;
}

describe('<html lang>', () => {
  it('is hi on every Hindi address', async () => {
    for (const p of ['/hi', '/hi/', '/hi/expenses', '/hi/2025', '/hi/verify', '/hi/llms-full.txt']) {
      const html = await chunkFor(p);
      expect(html, p).toContain('<html lang="hi" class="scroll-smooth">');
      expect(html, p).not.toContain('lang="en"');
    }
  });

  it('stays en everywhere else, including pages whose name merely starts with "hi"', async () => {
    for (const p of ['/', '/expenses', '/2025', '/verify', '/history', '/hindi', '/hi-fi', '/llms.txt']) {
      const html = await chunkFor(p);
      expect(html, p).toBe(HTML);
    }
  });

  it('changes nothing but that one attribute', async () => {
    const hi = await chunkFor('/hi/expenses');
    expect(hi.replace('lang="hi"', 'lang="en"')).toBe(HTML);
  });

  it('leaves a chunk that has no <html> tag (every chunk after the first) untouched', async () => {
    let transform: (i: { html: string; done: boolean }) => string | undefined = () => undefined;
    await handle({
      event: { url: new URL('/hi/expenses', 'https://chhath.test') },
      resolve: async (_e: unknown, o: { transformPageChunk: typeof transform }) => { transform = o.transformPageChunk; return new Response(''); },
    } as never);
    expect(transform({ html: '<main>पन्ना</main>', done: true })).toBe('<main>पन्ना</main>');
  });
});
