/**
 * Screenshots of the main pages in Light and Dark at desktop and phone widths.
 *
 *   pnpm exec tsx scripts/screenshots.mts <outDir> [baseUrl] [pages...]
 *
 * Defaults: baseUrl http://localhost:5173, pages / /new /about /dev/preview /dev/market-preview /dev/ui.
 * Dark is requested both ways the app supports: the OS preference and data-theme="dark".
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [outDir = '.cache/screenshots/after', base = 'http://localhost:5173', ...pageArgs] = process.argv.slice(2);
const pages = pageArgs.length ? pageArgs : ['/', '/new', '/about', '/dev/preview', '/dev/market-preview', '/dev/ui'];
const widths = [1280, 390];
const themes = ['light', 'dark'] as const;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
for (const theme of themes) {
	for (const width of widths) {
		const context = await browser.newContext({
			viewport: { width, height: width > 600 ? 900 : 844 },
			colorScheme: theme,
			deviceScaleFactor: 1
		});
		const page = await context.newPage();
		await page.addInitScript((t) => {
			try {
				localStorage.setItem('gigcast-theme', t);
			} catch {
				// ignore
			}
		}, theme);
		for (const route of pages) {
			const name = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
			const res = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => null);
			if (!res || res.status() >= 400) {
				console.log(`skip ${route} (${res ? res.status() : 'no response'})`);
				continue;
			}
			await page.waitForTimeout(3000);
			const file = path.join(outDir, `${name}.${theme}.${width}.png`);
			await page.screenshot({ path: file, fullPage: true });
			console.log('saved', file);
		}
		await context.close();
	}
}
await browser.close();
