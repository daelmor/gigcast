import { expect, test } from '@playwright/test';

test('a promoter starts a brief, watches the trace and reads the document', async ({ page }) => {
	await page.goto('/new');
	await expect(page.getByRole('heading', { name: 'New booking brief' })).toBeVisible();

	await page
		.getByRole('button', { name: /Mexico City/ })
		.first()
		.click();
	await page.getByLabel('Artist').fill('Natalia Lafourcade');
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Generate brief' }).click();

	await expect(page).toHaveURL(/\/brief\/brief_[A-Za-z0-9_-]+$/);
	await expect(page.getByText('Building the Booking Brief')).toBeVisible();
	// The live trace shows tool calls as they happen.
	await expect(page.getByText('qloo_search_entity').first()).toBeVisible({ timeout: 30_000 });

	// The finished document replaces the live view without a reload.
	await expect(page.locator('h1')).toContainText('Arjona in Guatemala City', { timeout: 60_000 });
	await expect(page.getByRole('heading', { name: 'Audience map', level: 2 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sponsors', level: 2 })).toBeVisible();
	await expect(page.locator('[data-label="grounded"]').first()).toBeVisible();
	await expect(page.locator('[data-label="no_coverage"]').first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Markdown' })).toBeVisible();

	// The public JSON and Markdown representations exist too.
	const id = page.url().split('/').pop()!;
	const json = await page.request.get(`/api/briefs/${id}`);
	expect(json.ok()).toBeTruthy();
	expect((await json.json()).status).toBe('complete');
	const md = await page.request.get(`/brief/${id}/markdown`);
	expect(md.ok()).toBeTruthy();
	expect(await md.text()).toContain('# Booking Brief');

	// And the brief is listed on the landing page.
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Recent briefs' })).toBeVisible();
	await expect(page.getByRole('link', { name: /Natalia Lafourcade/ }).first()).toBeVisible();
});

test('a finished brief reloads straight into the document', async ({ page }) => {
	const created = await page.request.post('/api/briefs', {
		data: {
			artist: 'Café Tacvba',
			city: 'Mexico City',
			country: 'MX',
			dateFrom: '2027-01-15',
			dateTo: '2027-01-16',
			marketId: 'mexico-city'
		}
	});
	expect(created.status()).toBe(201);
	const { id } = (await created.json()) as { id: string };
	await expect
		.poll(async () => (await (await page.request.get(`/api/briefs/${id}`)).json()).status, {
			timeout: 60_000
		})
		.toBe('complete');
	await page.goto(`/brief/${id}`);
	await expect(page.locator('h1')).toContainText('Arjona in Guatemala City');
	await expect(page.getByText(/Agent trace · \d+ events/)).toBeVisible();
});

test('invalid requests are rejected with details', async ({ page }) => {
	const res = await page.request.post('/api/briefs', { data: { artist: '' } });
	expect(res.status()).toBe(400);
	const body = await res.json();
	expect(body.error).toBe('Invalid brief request.');
	expect(body.details.length).toBeGreaterThan(0);
	const missing = await page.request.get('/api/briefs/does-not-exist');
	expect(missing.status()).toBe(404);
});
