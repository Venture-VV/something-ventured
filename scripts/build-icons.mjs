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

/* The wordmark on library green. `inset` shrinks the artwork for maskable icons. */
function iconSVG(inset = 0) {
  const s = 1 - inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#2E5A4C"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)" fill="#F4F3EF" font-family="Jost" font-weight="600" text-anchor="middle">
    <text x="256" y="246" font-size="118" letter-spacing="-2">library</text>
    <text x="256" y="362" font-size="118" letter-spacing="-2">live</text>
  </g>
</svg>`;
}

function splashHTML(w, h) {
  return `<!doctype html><style>${FONTS}
  body { width: ${w}px; height: ${h}px; display: grid; place-items: center; background: #F4F3EF; color: #2E5A4C; }
  .c { display: grid; justify-items: center; gap: 10px; text-align: center; transform: translateY(-4%); }
  b { font: 600 34px/1 Jost; letter-spacing: -.01em; }
  span { font: 500 13px/1 Jost; letter-spacing: .2em; text-transform: uppercase; color: #8E8C86; padding-left: .2em; }
  </style><div class="c"><b>library live</b><span>Hangzhou</span></div>`;
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
