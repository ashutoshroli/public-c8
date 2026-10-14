// Runs for every page the build prerenders (this is a static site: there is no server at runtime).
//
// One job: say which language the page is in. app.html is a single template with <html lang="en">,
// so without this a Hindi page (/hi/…) would be delivered to a search engine, a screen reader and
// the browser's own translation prompt labelled as English, with Hindi text inside. The label is
// what they believe about the page before they read a word of it.
import type { Handle } from '@sveltejs/kit';
import { langOfPath } from '$lib/lang/url';

export const handle: Handle = ({ event, resolve }) => {
  const hindi = langOfPath(event.url.pathname) === 'hi';
  return resolve(event, {
    transformPageChunk: ({ html }) => (hindi ? html.replace('<html lang="en"', '<html lang="hi"') : html),
  });
};
