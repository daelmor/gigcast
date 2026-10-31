import { expect, test } from '@playwright/test';

test('home page has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Booking Briefs grounded in cultural data');
});

test('about page explains the labels and links to the repository', async ({ page }) => {
	await page.goto('/about');
	await expect(page.getByRole('heading', { name: 'About gigcast' })).toBeVisible();
	await expect(page.getByText('Where the data comes from').first()).toBeVisible();
	await expect(page.locator('a[href="https://github.com/daelmor/gigcast"]').first()).toBeVisible();
});

test('compare page shows the dated comparison', async ({ page }) => {
	await page.goto('/compare');
	await expect(
		page.getByRole('heading', { level: 1, name: 'What changes when the agent has the taste graph' })
	).toBeVisible();
	await expect(page.getByText('Pre-computed comparison, run on 2026-10-30')).toBeVisible();
	await expect(page.locator('a[href="/brief/brief_EKSh8E9vLF"]').first()).toBeVisible();
});
