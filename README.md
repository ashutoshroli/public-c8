# Chhath Puja Transparency Portal — frontend-v8

Navyuvak Chhath Puja Samiti (Shaharpura, Gardih) ka public transparency portal.
**Ek hi minimal light layout** — koi skins, themes, dark mode ya chatbot nahi.

> v6 ka data layer (API, derive, i18n, push, offline snapshot, QR redirect, PWA) bina badlaav ke
> use hota hai. Backend / Cloudflare Worker **unchanged** hai.

## Stack
SvelteKit 2 + Svelte 5 + TypeScript + Tailwind, `adapter-static` (SPA fallback `200.html`), PWA.

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
