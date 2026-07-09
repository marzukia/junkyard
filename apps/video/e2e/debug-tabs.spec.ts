import { test, expect } from '@playwright/test';

test('debug: check mode tabs', async ({ page }) => {
  await page.goto('http://localhost:4174');
  
  // Check title
  await expect(page).toHaveTitle(/Video Toolkit/);
  
  // Count all mode-tab elements
  const modeTabs = page.locator('.mode-tab');
  const count = await modeTabs.count();
  console.log('Mode tab count:', count);
  
  // Get all tab text content
  for (let i = 0; i < count; i++) {
    const text = await modeTabs.nth(i).textContent();
    console.log(`Tab ${i}:`, text);
  }
  
  // Check if Splice tab exists
  const spliceTab = page.locator('.mode-tab').filter({ hasText: 'Splice' });
  const spliceExists = await spliceTab.count();
  console.log('Splice tab exists:', spliceExists > 0);
  
  // If no tabs found, check what's on the page
  if (count === 0) {
    const bodyText = await page.locator('body').innerText();
    console.log('Body text (first 500 chars):', bodyText.substring(0, 500));
  }
});