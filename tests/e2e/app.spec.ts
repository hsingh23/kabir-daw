import { test, expect } from '@playwright/test';

test.describe('PocketStudio E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('full navigation flow with screenshots', async ({ page }) => {
    // 1. Initial Load (Mixer View)
    await expect(page.getByText('Studio Mix')).toBeVisible();
    await expect(page.locator('h1')).toContainText('PocketStudio');
    await page.screenshot({ path: 'test-results/01-mixer-view.png' });

    // 2. Interact with Fader (basic check that controls exist)
    const fader = page.locator('input[type="range"]').first();
    await expect(fader).toBeVisible();

    // 3. Navigate to Arranger View
    const arrangerBtn = page.getByText('Arranger');
    await arrangerBtn.click();

    // 4. Verify Arranger Load
    await expect(page.getByText('TRACKS')).toBeVisible();
    await page.screenshot({ path: 'test-results/02-arranger-view.png' });

    // 5. Open Context Menu (Right click simulation)
    await page.mouse.click(200, 200, { button: 'right' }); 
    // Note: Context menu might not appear if no clip is at 200,200, 
    // but we check that the app doesn't crash.
    await page.screenshot({ path: 'test-results/03-context-menu-attempt.png' });
  });

  test('transport controls responsiveness', async ({ page }) => {
    // Check Play Button
    const playBtn = page.locator('button').filter({ has: page.locator('svg.lucide-play') });
    await expect(playBtn).toBeVisible();
    
    // Check Record Button
    const recBtn = page.locator('button').filter({ has: page.locator('svg.lucide-circle') });
    await expect(recBtn).toBeVisible();
  });
});