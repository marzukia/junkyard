import { test, expect } from '@playwright/test';

test.describe('Video Splice Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
  });

  test('should display splice mode tab', async ({ page }) => {
    const spliceTab = page.getByRole('tab', { name: /splice/i });
    await expect(spliceTab).toBeVisible();
  });

  test('should switch to splice mode and show splice panel', async ({ page }) => {
    // Click on Splice tab
    await page.getByRole('tab', { name: /splice/i }).click();
    
    // Check that splice panel elements are visible
    await expect(page.locator('.splice-upload-section')).toBeVisible();
    await expect(page.getByText(/drop multiple videos/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /select videos/i })).toBeVisible();
  });

  test('should show hint when less than 2 clips', async ({ page }) => {
    await page.getByRole('tab', { name: /splice/i }).click();
    
    // Should show hint to add at least 2 clips
    await expect(page.getByText(/add at least 2 clips/i)).toBeVisible();
  });
});