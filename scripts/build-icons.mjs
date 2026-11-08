/* Render the member app's icons and iOS launch screens with a headless browser.
   Needs Playwright (npx playwright, or a global install):  node scripts/build-icons.mjs
   Outputs to app/icons/. The artwork is plain SVG below, so it can be edited by hand. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'app', 'icons');
// fonts are inlined as data URIs: a page made with setContent may not load file:// URLs
const font = async f => `data:font/woff2;base64,${(await readFile(path.join(ROOT, 'assets', 'fonts', f))).toString('base64')}`;

const FONTS = `
@font-face { font-family: Jost; src: url("${await font('jost-latin-var.woff2')}"); font-weight: 100 900; }
@font-face { font-family: SerifI; src: url("${await font('source-serif-4-latin-var-italic.woff2')}"); font-style: italic; }
@font-face { font-family: Mono; src: url("${await font('ibm-plex-mono-latin-500.woff2')}"); }
html, body { margin: 0; padding: 0; background: transparent; }`;

/* A hotel key fob on raspberry velvet. `inset` shrinks the artwork for maskable icons. */
function iconSVG(inset = 0) {
  const s = 1 - inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#B53E5E"/><stop offset=".55" stop-color="#8A2543"/><stop offset="1" stop-color="#5A1330"/></radialGradient>
    <linearGradient id="brass" x1="0" x2="1"><stop offset="0" stop-color="#9A7434"/><stop offset=".45" stop-color="#F6DC9C"/><stop offset="1" stop-color="#B98F45"/></linearGradient>
    <linearGradient id="fob" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#FAE3DF"/><stop offset=".6" stop-color="#EFC3C1"/><stop offset="1" stop-color="#E2A9A9"/></linearGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#2A0712" flood-opacity=".55"/></filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  ${Array.from({ length: 32 }, (_, i) => `<rect x="${i * 16}" width="6" height="512" fill="rgba(0,0,0,.07)"/>`).join('')}
  <g transform="translate(256 262) scale(${s}) translate(-256 -262)">
    <circle cx="256" cy="112" r="38" fill="none" stroke="url(#brass)" stroke-width="13"/>
    <g filter="url(#sh)">
      <path d="M256 138c62 0 92 30 92 76v118c0 52-40 88-92 118-52-30-92-66-92-118V214c0-46 30-76 92-76z" fill="url(#fob)"/>
    </g>
    <path d="M256 152c52 0 78 26 78 64v114c0 44-34 75-78 102-44-27-78-58-78-102V216c0-38 26-64 78-64z" fill="none" stroke="#9B2D4A" stroke-width="3.5"/>
    <circle cx="256" cy="180" r="15" fill="#7B1E3A"/><circle cx="256" cy="180" r="15" fill="none" stroke="url(#brass)" stroke-width="6"/>
    <text x="256" y="318" text-anchor="middle" font-family="Jost" font-weight="600" font-size="96" letter-spacing="4" fill="#9B2D4A">SV</text>
    <text x="256" y="366" text-anchor="middle" font-family="Mono" font-size="21" letter-spacing="4" fill="#9B2D4A" fill-opacity=".8">HZ·301</text>
  </g>
</svg>`;
}

function splashHTML(w, h) {
  return `<!doctype html><style>${FONTS}
  body { width: ${w}px; height: ${h}px; display: grid; place-items: center; background: #9B2D4A; color: #F5EBDD; }
  .c { display: grid; justify-items: center; gap: 16px; text-align: center; transform: translateY(-2%); }
  svg { width: 84px; height: 84px; }
  b { font: 600 14px/1 Jost; letter-spacing: .38em; text-transform: uppercase; padding-left: .38em; }
  i { font: italic 400 15px/1 SerifI; opacity: .8; }
  </style><div class="c"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="27" fill="none" stroke="#F5EBDD" stroke-width="1.6"/><circle cx="30" cy="30" r="22" fill="none" stroke="#F5EBDD" stroke-width=".8"/><text x="30" y="36" text-anchor="middle" fill="#F5EBDD" font-family="Jost" font-weight="600" font-size="15">SV</text></svg><b>Something Ventured</b><i>A members’ club · Hangzhou</i></div>`;
}

const SPLASH = [[393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3], [390, 844, 3], [428, 926, 3], [375, 812, 3], [414, 896, 2], [375, 667, 2]];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
async function icon(file, size, inset = 0) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>${FONTS} svg { width: ${size}px; height: ${size}px; display: block; }</style>${iconSVG(inset)}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: false });
  await page.close();
  console.log('  ', file);
}
await icon('icon-192.png', 192);
await icon('icon-512.png', 512);
await icon('icon-maskable-192.png', 192, 0.18);
await icon('icon-maskable-512.png', 512, 0.18);
await icon('apple-touch-icon.png', 180, 0.04);
for (const [w, h, dpr] of SPLASH) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.setContent(splashHTML(w, h));
  await page.evaluate(() => document.fonts.ready);
  const file = `splash-${w * dpr}x${h * dpr}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  await page.close();
  console.log('  ', file);
}
await browser.close();
