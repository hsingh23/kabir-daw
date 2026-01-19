import { test, expect } from '@playwright/test';

test('app loads and shows title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PocketStudio/);
  await expect(page.locator('h1')).toContainText('PocketStudio');
  
  // Verify Mixer view is default
  await expect(page.getByText('Studio Mix')).toBeVisible();

  // Take a screenshot for visual validation in CI
  await page.screenshot({ path: 'test-results/landing-page.png', fullPage: true });
});