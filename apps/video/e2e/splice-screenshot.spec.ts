import { test } from '@playwright/test';
import * as fs from 'fs';

test('screenshot splice tab', async ({ page }) => {
  // Create a minimal test video file
  const hex = 
    "0000001c" +
    "66747970" +
    "69736f35" +
    "00000001" +
    "69736f35" +
    "61766331" +
    "00000008" +
    "66726565" +
    "00000008" +
    "6d646174";
  const testVideoPath = '/tmp/test-video-A.mp4';
  fs.writeFileSync(testVideoPath, Buffer.from(hex, 'hex'));
  
  await page.goto('http://localhost:4174');
  await page.waitForLoadState('networkidle');
  
  // Upload a file to activate the UI
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(testVideoPath);
  await page.waitForTimeout(2000);
  
  // Click on Splice tab
  const spliceTab = page.locator('.mode-tab', { hasText: 'Splice' });
  await spliceTab.click();
  await page.waitForTimeout(1000);
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/splice-tab-screenshot.png', fullPage: true });
  
  console.log('Screenshot saved to /tmp/splice-tab-screenshot.png');
});