import { test, expect } from '@playwright/test';

test('parcel search and export', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Lot/Plan').fill('3/RP67254');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForSelector('.leaflet-pane .leaflet-interactive', { timeout: 20000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export KMZ' }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('.kmz');
});
