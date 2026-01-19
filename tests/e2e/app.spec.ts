import * as pwt from '@playwright/test';
const { test, expect } = pwt;

test.describe('PocketStudio E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('full navigation flow with screenshots', async ({ page }) => {
    await expect(page.getByText('Studio Mix')).toBeVisible();
    await expect(page.locator('h1')).toContainText('PocketStudio');
    
    // Check Export Button presence
    const exportBtn = page.locator('button[title="Export Mix"]');
    await expect(exportBtn).toBeVisible();

    // Navigate to Arranger View
    const arrangerBtn = page.getByText('Arranger');
    await arrangerBtn.click();
    await expect(page.getByText('TRACKS')).toBeVisible();

    // Go back to Studio (Mixer)
    const studioBtn = page.getByText('Studio');
    await studioBtn.click();
    await expect(page.getByText('Studio Mix')).toBeVisible();
  });

  test('instruments tab functionality', async ({ page }) => {
    // Switch to Backing Tab
    await page.getByText('Backing').click();
    
    // Check Tanpura presence
    await expect(page.getByText('TANPURA DRONE')).toBeVisible();
    await expect(page.getByText('First String')).toBeVisible();
    
    // Check Tabla presence
    await expect(page.getByText('TABLA PERCUSSION')).toBeVisible();
    await expect(page.getByText('Taal Pattern')).toBeVisible();

    // Verify URL update
    expect(page.url()).toContain('mixerTab=instruments');
    
    // Reload page to verify state persistence
    await page.reload();
    await expect(page.getByText('TANPURA DRONE')).toBeVisible();
  });

  test('export functionality check', async ({ page }) => {
     // Mock window.alert
     page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Nothing to export');
        await dialog.dismiss();
     });

     const exportBtn = page.locator('button[title="Export Mix"]');
     await exportBtn.click();
  });
});