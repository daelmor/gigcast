import { expect, test } from '@playwright/test';

test('home page has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Booking Briefs grounded in Qloo');
});

test('about page explains the labels and links to the repository', async ({ page }) => {
	await page.goto('/about');
	await expect(page.getByRole('heading', { name: 'About gigcast' })).toBeVisible();
	await expect(page.getByText('Why Qloo is load-bearing').first()).toBeVisible();
	await expect(page.locator('a[href="https://github.com/daelmor/gigcast"]').first()).toBeVisible();
});
