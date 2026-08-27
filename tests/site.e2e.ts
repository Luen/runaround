import { expect, test } from '@playwright/test';

test('home and races pages render', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /run the city/i })).toBeVisible();
	await page.goto('/races');
	await expect(page.getByRole('heading', { name: 'Races' })).toBeVisible();
	await page.goto('/about');
	await expect(page.getByRole('heading', { name: 'About RunAround' })).toBeVisible();
	await page.goto('/contact');
	await expect(page.getByRole('link', { name: 'info@runaround.com.au' })).toBeVisible();
	await page.goto('/login');
	await expect(page.getByRole('button', { name: /strava/i })).toBeVisible();
});

test('race page shows both leaderboards', async ({ page }) => {
	await page.goto('/races/30500288');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Race results' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Overall' })).toBeVisible();
	await page.getByRole('button', { name: 'Overall' }).click();
	await expect(page.getByRole('heading', { name: /overall/i })).toBeVisible();
});
