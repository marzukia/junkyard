import { test, expect } from '@playwright/test';

test('debug: check for JS errors', async ({ page }) => {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push('Page error: ' + error.message);
  });
  
  await page.goto('http://localhost:4174');
  await page.waitForLoadState('networkidle');
  
  console.log('Console errors:', errors);
  
  // Check if tabs exist
  const modeTabs = page.locator('.mode-tab');
  const count = await modeTabs.count();
  console.log('Mode tab count:', count);
  
  // Get page HTML to see what's rendered
  const html = await page.content();
  const hasModeTabs = html.includes('mode-tab');
  console.log('HTML contains mode-tab:', hasModeTabs);
  
  // Check for splice in HTML
  const hasSplice = html.includes('Splice');
  console.log('HTML contains Splice:', hasSplice);
});