// One-off generator for the assets that search engines, link previews and phones ask for by
// NAME rather than through the manifest. Run with `node scripts/gen-seo-assets.mjs`.
// sharp is a devDependency (never shipped to the browser); the generated files are the
// committed artifacts, exactly like gen-icons.mjs / gen-screenshots.mjs.
//
//   static/og-image.png                  1200x630  link-preview card (og:image / twitter:image)
//   static/apple-touch-icon.png          180x180   OPAQUE iOS home-screen icon, at the site root
//   static/favicon.ico                   16/32/48  the file crawlers and old browsers request blindly
//   static/icons/badge-96.png            96x96     white-on-transparent Android notification badge
//   static/icons/icon-512-monochrome.png 512x512   manifest icon for Android 13+ themed icons
//
// WHY EACH ONE EXISTS
//  - og-image: the old social image was the 1280x720 app-store screenshot. It is the wrong shape
//    (16:9, not the 1.91:1 every platform crops to) and says nothing about what the page is.
//  - apple-touch-icon: the old one was the TRANSPARENT app icon. iOS fills transparency with
//    black, so the home-screen tile was a logo on a black square. Safari also asks for
//    /apple-touch-icon.png at the root without reading any <link>, so it lives there.
//  - favicon.ico: Google Search and most feed readers request /favicon.ico directly; with only
//    an SVG they showed a generic globe. Google wants a multiple of 48px, so 48 is included.
//  - badge-96: Android draws a notification `badge` from its ALPHA CHANNEL only. Pointing it at
//    the full-colour logo renders a solid white blob in the status bar; a simple glyph reads.
//  - icon-512-monochrome: same alpha-only rule, for the launcher's themed-icon mode.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = (p) => resolve(root, 'static', p);
const logoSvg = readFileSync(out('logo.svg'));
const faviconSvg = readFileSync(out('favicon.svg'));

// ------------------------------------------------------------------ 1. OG IMAGE 1200x630

async function ogImage() {
  const W = 1200;
  const H = 630;
  const logoSize = 340;
  const circleR = 200;
  const cx = 262;
  const cy = H / 2;
  const textX = 540;
  const font = "Noto Sans, Inter, Segoe UI, Arial, sans-serif";

  // Same sunrise gradient as the app-listing screenshots, so the brand reads the same everywhere.
  // Text stays inside the central 1200x600 band: X/Twitter's large card crops to 2:1.
  const card = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fde7c9"/>
      <stop offset="0.55" stop-color="#fbc98c"/>
      <stop offset="1" stop-color="#ec9460"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${circleR}" fill="#ffffff" opacity="0.92"/>
  <text x="${textX}" y="190" font-family="${font}" font-weight="700" font-size="25" letter-spacing="3.2" fill="#9a3d0a">NAVYUVAK CHHATH PUJA SAMITI</text>
  <text x="${textX}" y="288" font-family="${font}" font-weight="900" font-size="92" fill="#7a2e00">Chhath Puja</text>
  <text x="${textX}" y="356" font-family="${font}" font-weight="800" font-size="56" fill="#9a3d0a">Transparency Portal</text>
  <rect x="${textX}" y="392" width="96" height="6" rx="3" fill="#0b6b4f"/>
  <text x="${textX}" y="448" font-family="${font}" font-weight="600" font-size="31" fill="#7a2e00">Every contribution is visible.</text>
  <text x="${textX}" y="492" font-family="${font}" font-weight="600" font-size="31" fill="#7a2e00">Every expense is accountable.</text>
  <text x="${textX}" y="552" font-family="${font}" font-weight="600" font-size="24" fill="#b4560f">Shaharpura, Gardih  ·  Jharkhand  ·  Est. 2017</text>
</svg>`);

  const logo = await sharp(logoSvg, { density: 384 })
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Two passes on purpose: sharp applies composite() AFTER flatten()/removeAlpha() inside one
  // pipeline, so a single chain hands back an RGBA file (fully opaque, but with a needless
  // alpha channel). Compositing first and flattening the result gives a true RGB PNG.
  const composed = await sharp(card)
    .composite([{ input: logo, left: Math.round(cx - logoSize / 2), top: Math.round(cy - logoSize / 2) }])
    .png()
    .toBuffer();
  await sharp(composed)
    // Opaque: a preview scraper that cannot composite alpha shows black behind transparency.
    .flatten({ background: '#fbc98c' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out('og-image.png'));
  console.log('wrote static/og-image.png', `${W}x${H}`);
}

// ------------------------------------------------------------ 2. APPLE TOUCH ICON 180x180

async function appleTouchIcon() {
  // The maskable icon is already an OPAQUE brand-orange field with the emblem inside the safe
  // zone, which is precisely what iOS wants: it rounds the corners itself and must not be handed
  // pre-rounded or transparent art.
  await sharp(out('icons/icon-512-maskable.png'))
    .resize(180, 180, { kernel: 'lanczos3' })
    .flatten({ background: { r: 242, g: 122, b: 26 } })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out('apple-touch-icon.png'));
  console.log('wrote static/apple-touch-icon.png 180x180 (opaque)');
}

// ------------------------------------------------------------------ 3. favicon.ico

/** An .ico container whose images are PNGs (supported by every browser since IE9 / Vista). */
function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette colours
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.buf)]);
}

async function faviconIco() {
  // Rasterise the simplified emblem ONCE, large, then downscale: the small sizes get proper
  // anti-aliasing instead of a hinted-to-nothing 16px render.
  const big = await sharp(faviconSvg, { density: 1152 }).resize(512, 512).png().toBuffer();
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    const buf = await sharp(big).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
    images.push({ size, buf });
  }
  writeFileSync(out('favicon.ico'), icoFromPngs(images));
  console.log('wrote static/favicon.ico', sizes.join('/'));
}

// ------------------------------------------- 4 & 5. MONOCHROME GLYPH (badge + themed icon)

/**
 * A rising sun over water, as one flat colour. Drawn on a 100x100 grid inside a ~40 radius so
 * `scale` can pull it further in for the themed-icon safe zone. Android keeps only the alpha
 * channel of these, so detail beyond solid shapes is lost: sun, five rays, horizon, ripples.
 */
function glyphSvg(size, colour, scale) {
  const rays = [-90, -130, -50, -170, -10]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const x1 = (50 + Math.cos(a) * 30).toFixed(2);
      const y1 = (62 + Math.sin(a) * 30).toFixed(2);
      const x2 = (50 + Math.cos(a) * 42).toFixed(2);
      const y2 = (62 + Math.sin(a) * 42).toFixed(2);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    })
    .join('');
  // Optical centre: the glyph spans y 17..84, so lift it by ~-1.5 to sit on the canvas centre.
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <g transform="translate(50 50) scale(${scale}) translate(-50 -51)" fill="${colour}" stroke="none">
    <path d="M 30 62 A 20 20 0 0 1 70 62 Z"/>
    <rect x="14" y="67" width="72" height="6" rx="3"/>
    <rect x="27" y="78" width="46" height="6" rx="3"/>
    <g stroke="${colour}" stroke-width="6" stroke-linecap="round" fill="none">${rays}</g>
  </g>
</svg>`);
}

async function badge() {
  await sharp(glyphSvg(96, '#ffffff', 1), { density: 288 })
    .resize(96, 96)
    .png({ compressionLevel: 9 })
    .toFile(out('icons/badge-96.png'));
  console.log('wrote static/icons/badge-96.png 96x96 (white on transparent)');
}

async function monochrome() {
  // A themed icon is masked like a maskable one: Android's adaptive-icon safe zone is a circle
  // 66dp across on a 108dp canvas, i.e. a radius of ~30.6% of the canvas. The glyph's farthest
  // point is ~44.6 grid units from its centre, so 0.68 puts it at ~30.3 units = 155px of 512,
  // inside that circle. (src/lib/discoverability.test.ts measures this from the PNG.)
  await sharp(glyphSvg(512, '#000000', 0.68), { density: 288 })
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(out('icons/icon-512-monochrome.png'));
  console.log('wrote static/icons/icon-512-monochrome.png 512x512 (black on transparent)');
}

await ogImage();
await appleTouchIcon();
await faviconIco();
await badge();
await monochrome();
