# Chhath Puja Transparency Portal — frontend-v8

Navyuvak Chhath Puja Samiti (Shaharpura, Gardih) ka public transparency portal.
**Ek hi minimal light layout** — koi skins, themes, dark mode ya chatbot nahi.

> v6 ka data layer (API, derive, i18n, push, offline snapshot, QR redirect, PWA) bina badlaav ke
> use hota hai. Backend / Cloudflare Worker **unchanged** hai.

## Stack
SvelteKit 2 + Svelte 5 + TypeScript + Tailwind, `adapter-static` (fallback `404.html`, so an unknown URL gets a real HTTP 404), PWA.

## Routes
`/` Home · `/contributors` · `/expenses` · `/loans` · `/committee` · `/downloads` ·
`/decade` · `/donate` · `/verify?record=` · `/guide` · `/loan-rules` · `/privacy` · `/terms`

Every page also exists in Hindi under `/hi` (`/hi`, `/hi/expenses`, …), and every year that has
records has a page of its own: `/2025`, `/hi/2025` (see *Two languages, one page per year*).

## Structure
```
src/lib/
  api/         schema (Zod) · client (fetch + cache) · derive (pure calcs)
  stores/      portal · lang · notifications · install
  components/  Shell (header, nav, footer) · MoreMenu · LiveScroll · Modal · states
  utils/       format · ranking · drive · decadeData
src/routes/    ek page = ek folder, seedha design + derive functions
src/routes/hi/ Hindi twins: each is a 1-line wrapper that renders the English page component
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
- **Refreshing does not disturb installed apps.** The pages are not in the offline cache, and the app
  version is the *commit* (not a timestamp), so redeploying the same commit builds an identical
  service worker: installed apps download nothing and do not reload. (Check: `npm run build` twice;
  `build/sw.js` is byte-identical.)
- `/llms-full.txt` is the same text for every page in one file; `/llms.txt` links to it.

Code: `src/lib/snapshot/` (facts → sentences, build-time fetch, Vite plugin) and
`src/lib/components/AccountsText.svelte`.

## Two languages, one page per year
**The language is in the address.** `/hi/…` is Hindi, everything else is English. Before this, the
language was a setting kept in the browser, so one address served two languages and a search engine
(which has no setting) only ever saw English. Now each language page exists on its own, can be
shared and bookmarked, and says so to search engines:

- Every page is its own canonical and lists its twin with `hreflang` (`en`, `hi`, and `x-default` =
  English). `sitemap.xml` lists each page twice with the full `hreflang` set. `<html lang>` is `hi` on
  the Hindi pages (`src/hooks.server.ts`). Titles, descriptions and structured data are Hindi there.
- The language button in the header is a real link to the same page in the other language, so it
  works with scripts off and a crawler can follow it.
- **A visitor who chose Hindi keeps getting Hindi:** the choice is remembered in the browser, and a
  tiny script in `app.html` takes them from an English page address to its `/hi` twin before the page
  paints. Crawlers have no browser storage, so they see English at the English address and Hindi at
  `/hi/…`. Files (`robots.txt`, `sitemap.xml`, `llms.txt`, `/.well-known/…`) have one address and are
  never redirected.
- **Old links:** the WhatsApp and e-mail templates still send `https://…/#downloads` (from when Downloads
  was a section of the home page). The same early script sends that exact link to the Downloads page
  (`/hi/downloads` for a Hindi visitor), keeping any `?query` and dropping the fragment.
- The Hindi route files are wrappers around the English page components, so the two cannot drift
  apart. A new page needs its `ROUTES` entry (incl. `descriptionHi`) and a wrapper under `src/routes/hi/`
  — a test fails until both exist.

**A page for each year** (`/2025`, `/hi/2025`, …) holds that year's contributions, expenses, loans and
committee roles in plain sentences, with the committee's "Our Journey" story for the year when it has
one, links to the other years and to the detailed ledgers. A year gets a page when it has any
contribution, loan, committee row or expense; the pages are created at build time from the same
snapshot as above (`src/routes/[year=year]`), so a **new year appears after the next Redeploy**.
(Until then, visitors who navigate inside the app already see it, drawn from live data.) The same
rules apply: no names, no individual amounts. The year story is left out if it contains the whole
name of anyone in the contributors list, a phone number or an email — the build log lists any it held
back, and a published story is the committee's own text, so read them once at `/<year>`.

The contributors list also holds institutions. An organisation the committee has **approved by name**
may be thanked in a story: today only *Genius Public School* (2017's story). The list is
`APPROVED_ORGANISATIONS` in `src/lib/snapshot/redact.ts`; nothing is inferred from how a name looks, so
another school or trust stays guarded until it is added there, in a PR. Only the name is freed — never
the organisation's own record (what it gave, when).

`/hi/llms-full.txt` is the Hindi version of `/llms-full.txt` (both now include a section per year).

Code: `src/lib/lang/url.ts` (language ↔ address), `src/lib/stores/lang.ts`,
`src/lib/components/YearPage.svelte`, `src/lib/components/Seo.svelte`.

## Offline
The service worker precaches the app's code, fonts and icons plus one **app shell** (`/app-shell`,
the single-page-app fallback that `adapter-static` writes a second time; `404.html` is the same page
served with a 404 for unknown URLs). Every page navigation is answered with that shell and the router
draws the route from cached JavaScript, with data from the visitor's last saved copy. Navigations to
*files* (`/robots.txt`, `/llms.txt`, `/sitemap.xml`, `/.well-known/…`) are left to the network.
`npm run build && npm test` also runs the generated worker for real (install, then navigations online
and offline); without a build those tests are skipped.

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
