# Chhath Puja Transparency Portal — frontend-v8

Navyuvak Chhath Puja Samiti (Shaharpura, Gardih) ka public transparency portal.
**Ek hi minimal light layout** — koi skins, themes, dark mode ya chatbot nahi.

> v6 ka data layer (API, derive, i18n, push, offline snapshot, QR redirect, PWA) bina badlaav ke
> use hota hai. Backend / Cloudflare Worker **unchanged** hai.

## Stack
SvelteKit 2 + Svelte 5 + TypeScript + Tailwind, `adapter-static` (fallback `404.html`, so an unknown URL gets a real HTTP 404), PWA.

## Routes
`/` Home · `/contributors` · `/expenses` · `/loans` · `/committee` · `/downloads` ·
`/decade` · `/donate` · `/verify?record=` · `/guide` · `/privacy` · `/terms`

## Structure
```
src/lib/
  api/         schema (Zod) · client (fetch + cache) · derive (pure calcs)
  stores/      portal · lang · notifications · install
  components/  Shell (header, nav, footer) · MoreMenu · LiveScroll · Modal · states
  utils/       format · ranking · drive · decadeData
src/routes/    ek page = ek folder, seedha design + derive functions
```

## Search, previews and PWA files
Page metadata (title key, description, noindex) lives in one table, `src/lib/seo.ts` (`ROUTES`);
the sitemap, `llms.txt`, canonical tags and structured data are all generated from it, so a new
page only needs one entry. `/verify` is `noindex` (it is the receipt-QR page) and stays out of the
sitemap. `static/robots.txt` welcomes every crawler by name.

Images that crawlers, link previews and phones fetch by name are generated, then committed:
```sh
node scripts/gen-seo-assets.mjs   # og-image, apple-touch-icon, favicon.ico, badge-96, monochrome icon
node scripts/gen-icons.mjs        # PWA icons from static/logo.svg
node scripts/gen-screenshots.mjs  # app-listing screenshots
```

## The accounts in words (what search engines and AI can read)
The pages are drawn in the browser from the public API, so the HTML a crawler downloads used to be
an empty frame. Under each data page (Home, Expenses, Loans, Committee, Contributors, 10 Years) there
is now a section **"The accounts in words"**: the same figures as plain sentences, written into the
HTML when the site is **built** from the data the API returns at that moment.

- **Visitors still get live data.** The section shows the build-time text until the live data loads,
  then switches to the same sentences from the live data (labelled "Live figures"), or "Saved
  figures" when offline. A redeploy only refreshes what crawlers see.
- **Refreshing it:** Vercel → *Deployments* → the latest **Production** deployment → ⋯ → **Redeploy**.
  The build re-reads the API, so the text, the "as of" date and the sitemap `lastmod` move together.
  (Untick "Use existing Build Cache" if you want to be certain nothing is reused.)
- **If the API cannot be reached the build FAILS** (3 tries). That is deliberate: Vercel then keeps
  serving the *previous deployment*, which still has the last good text, instead of replacing it with
  an empty section. Check the Worker, then redeploy.
- **Emergency switches** (Vercel → Project Settings → Environment Variables; leave unset normally):
  `CPM_SNAPSHOT_ALLOW_EMPTY=1` builds without a snapshot if the API is unreachable;
  `CPM_SNAPSHOT=off` skips the snapshot (and the network) altogether.
- **It names no one.** Counts, totals, roles, and villages with at least 5 contributors; never a
  contributor, committee member, borrower or guarantor, father's name, photo, mobile number or an
  individual's amount. Expense lines are published as written, except a line that contains a known
  person's name, a phone number or an email, which is folded into "Other items" (the amount still
  counts). The build log says how many lines were folded.
- `/llms-full.txt` is the same text for every page in one file; `/llms.txt` links to it.

Code: `src/lib/snapshot/` (facts → sentences, build-time fetch, Vite plugin) and
`src/lib/components/AccountsText.svelte`.

## Design tokens
`tailwind.config.ts` me `brand` (hara), `canvas`, `ink`, `muted`, `line`. Card = `.surface`,
list = `.rows`, input = `.field` (src/app.css).

## Commands
```sh
npm install
npm run dev
npm run check
npm test
npm run build
```
