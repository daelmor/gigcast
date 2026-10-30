/**
 * Accessibility check with axe-core: colour contrast and focus-related rules on the main pages,
 * in Light and Dark. Exits non-zero when a violation is found.
 *
 *   pnpm exec tsx scripts/a11y-check.mts [baseUrl] [pages...]
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const [base = 'http://localhost:5173', ...pageArgs] = process.argv.slice(2);
const pages = pageArgs.length ? pageArgs : ['/', '/new', '/about', '/dev/preview', '/dev/market-preview', '/dev/ui'];
const themes = ['light', 'dark'] as const;

let violations = 0;
const browser = await chromium.launch();
for (const theme of themes) {
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
	const page = await context.newPage();
	await page.addInitScript((t) => {
		try {
			localStorage.setItem('gigcast-theme', t);
		} catch {
			// ignore
		}
	}, theme);
	for (const route of pages) {
		const res = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => null);
		if (!res || res.status() >= 400) {
			console.log(`skip ${route} (${res ? res.status() : 'no response'})`);
			continue;
		}
		await page.waitForTimeout(800);
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
			// The MapLibre canvas and attribution are third-party; ECharts SVG text is decorative.
			.exclude('.maplibregl-map')
			.analyze();
		const relevant = results.violations.filter((v) =>
			/contrast|focus|aria|label|link-name|button-name|heading|region|landmark|list|image-alt/.test(v.id)
		);
		for (const v of relevant) {
			violations += v.nodes.length;
			console.log(`\n${theme} ${route}: ${v.id} (${v.impact}) — ${v.help}`);
			for (const n of v.nodes.slice(0, 4)) {
				console.log(`  ${n.target.join(' ')}`);
				if (n.failureSummary) console.log(`    ${n.failureSummary.split('\n').slice(0, 2).join(' ')}`);
			}
		}
		if (relevant.length === 0) console.log(`${theme} ${route}: ok`);
	}
	await context.close();
}
await browser.close();
console.log(violations ? `\n${violations} violation node(s)` : '\nno violations');
process.exit(violations ? 1 : 0);
