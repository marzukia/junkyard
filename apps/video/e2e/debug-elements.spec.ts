import { test, expect } from '@playwright/test';

test('debug: list all elements', async ({ page }) => {
  await page.goto('http://localhost:4174');
  await page.waitForLoadState('networkidle');
  
  // Get all elements with class names
  const allElements = await page.$$eval('*', (els) => els.map(el => el.className).filter(c => c).slice(0, 50));
  console.log('Classes found:', allElements);
  
  // Check for app-root
  const appRoot = await page.locator('.app-root').count();
  console.log('app-root count:', appRoot);
  
  // Check for site-main
  const siteMain = await page.locator('.site-main').count();
  console.log('site-main count:', siteMain);
  
  // Check for card elements
  const cards = await page.locator('.card').count();
  console.log('card count:', cards);
  
  // Get the full body innerHTML
  const bodyHtml = await page.locator('body').innerHTML();
  console.log('Body HTML length:', bodyHtml.length);
  console.log('Body HTML (first 1000 chars):', bodyHtml.substring(0, 1000));
});