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
