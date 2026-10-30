/**
 * Render static/og.png (1200x630): the white horizontal lockup and the tagline on the brand's
 * night ground. Re-run after changing the logo or the tagline:
 *
 *   pnpm exec tsx scripts/og-image.mts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const logo = await readFile(path.join(root, 'static/brand/gigcast-horizontal-white.svg'), 'utf8');
const plexCss = await readFile(path.join(root, 'node_modules/@fontsource/ibm-plex-sans/400.css'), 'utf8');
const fontDir = path.join(root, 'node_modules/@fontsource/ibm-plex-sans/files');
// Point the font-face rules at the local files so the render needs no network.
const css = plexCss.replace(/url\(\.\/files\//g, `url(file://${fontDir}/`);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
html, body { margin: 0; width: 1200px; height: 630px; background: #100c28; }
.card { position: relative; width: 1200px; height: 630px; display: flex; flex-direction: column; justify-content: center; padding: 0 96px; box-sizing: border-box; color: #eeedf8; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
.logo svg { height: 96px; width: auto; display: block; }
.tagline { margin-top: 48px; font-size: 44px; line-height: 56px; font-weight: 400; letter-spacing: -0.01em; max-width: 900px; }
.foot { position: absolute; left: 96px; bottom: 64px; font-size: 22px; line-height: 28px; color: #aba6cc; }
</style></head><body><div class="card"><div class="logo">${logo}</div><p class="tagline">Booking Briefs grounded in Qloo</p><p class="foot">Audience map · lineup · sponsors · venues · pricing · risk panel · what the model would have guessed without the data</p></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, 'static/og.png'), type: 'png' });
await browser.close();
console.log('wrote static/og.png');
