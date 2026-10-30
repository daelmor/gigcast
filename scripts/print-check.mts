/**
 * Print the fixture brief to PDF and check the print stylesheet: black on white, no header,
 * table of contents or toolbar, one section per page.
 *
 *   pnpm exec tsx scripts/print-check.mts [baseUrl] [outFile]
 */
import { chromium } from '@playwright/test';

const [base = 'http://localhost:5173', out = '.cache/screenshots/after/dev-preview.pdf'] =
	process.argv.slice(2);

interface Report {
	bodyBackground: string;
	bodyColor: string;
	h1Color: string | null;
	headerVisible: boolean;
	tocVisible: boolean;
	toolbarVisible: boolean;
	sectionCount: number;
	sectionBreaks: string[];
}

// Plain source string: tsx would otherwise inject a `__name` helper into the page function.
const probe = `(() => {
	const visible = (sel) => Array.from(document.querySelectorAll(sel)).some((el) => {
		const cs = getComputedStyle(el);
		return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
	});
	const body = getComputedStyle(document.body);
	const h1 = document.querySelector('h1');
	const sections = Array.from(document.querySelectorAll('article section[aria-labelledby]'));
	return {
		bodyBackground: body.backgroundColor,
		bodyColor: body.color,
		h1Color: h1 ? getComputedStyle(h1).color : null,
		headerVisible: visible('nav[aria-label="Main"]'),
		tocVisible: visible('article > aside'),
		toolbarVisible: visible('.print\\\\:hidden'),
		sectionCount: sections.length,
		sectionBreaks: sections.map((s) => getComputedStyle(s).breakBefore)
	};
})()`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base + '/dev/preview', { waitUntil: 'networkidle', timeout: 90_000 });
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(500);
const report = (await page.evaluate(probe)) as Report;
console.log(JSON.stringify(report, null, 1));
await page.pdf({
	path: out,
	format: 'A4',
	printBackground: true,
	margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' }
});
console.log('wrote', out);
await browser.close();

const ok =
	/rgb\(255, 255, 255\)/.test(report.bodyBackground) &&
	/rgb\(0, 0, 0\)/.test(report.bodyColor) &&
	!report.headerVisible &&
	!report.tocVisible &&
	!report.toolbarVisible &&
	report.sectionBreaks.every((b) => b === 'page');
console.log(ok ? 'print check ok' : 'print check FAILED');
process.exit(ok ? 0 : 1);
