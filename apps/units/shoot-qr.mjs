import { chromium } from 'playwright';
const URL = 'https://qr.mrzk.io/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2000);

// Force light mode
const lightBtn = page.locator('button', { hasText: /^Light$/ });
if (await lightBtn.count()) { await lightBtn.first().click(); await page.waitForTimeout(300); }

// Ensure content is mrzk.io
const text = page.locator('#qr-text');
await text.fill('https://mrzk.io');

// Pick a distinctive brand colour (charted blue) for foreground
const fgHex = page.locator('#qr-fg');
await fgHex.fill('#1f6feb');
await fgHex.press('Enter');
await page.waitForTimeout(300);

// Use rounded dot style for a branded look
const rounded = page.locator('button[aria-label="Rounded dot style"]');
if (await rounded.count()) { await rounded.click(); }
await page.waitForTimeout(800);

// Verify the canvas is non-blank
const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return { ok: false };
  const ctx = c.getContext('2d');
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let nonWhite = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!(data[i] > 240 && data[i+1] > 240 && data[i+2] > 240)) nonWhite++;
  }
  return { ok: true, w: c.width, h: c.height, nonWhitePixels: nonWhite, frac: nonWhite / (c.width * c.height) };
});
console.log('CANVAS:', JSON.stringify(canvasInfo));

// Screenshot just the canvas / preview region for a focused output shot
const canvas = page.locator('canvas').first();
await canvas.scrollIntoViewIfNeeded();
const box = await canvas.boundingBox();
console.log('CANVAS BOX:', JSON.stringify(box));

// Capture a padded region around the canvas to include any frame/background
const pad = 32;
await page.screenshot({
  path: '/home/planky/projects/_fleet/shots/ex-qr.png',
  clip: {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  },
});
console.log('SAVED ex-qr.png');
await browser.close();
