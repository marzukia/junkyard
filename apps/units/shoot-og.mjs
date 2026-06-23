import { chromium } from 'playwright';

const URL = 'https://og.mrzk.io/';
const OUT = '/home/planky/projects/_fleet/shots/ex-og.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: 'light',
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2000);

// Fill the title
const title = page.locator('#og-title');
await title.click();
await title.fill('');
await title.fill('18 free tools, zero paywalls');
await title.dispatchEvent('input');

// A fitting subtitle + badge
const sub = page.locator('#og-subtitle');
await sub.fill('Hashing, OG cards, QR, JSON, JWT — all in your browser');
await sub.dispatchEvent('input');

const badge = page.locator('#og-badge');
await badge.fill('og.mrzk.io');
await badge.dispatchEvent('input');

await page.waitForTimeout(1500); // let canvas re-render

// Verify the canvas actually painted (non-blank) by sampling pixels off the dataURL
const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return { ok: false, reason: 'no canvas' };
  const url = c.toDataURL('image/png');
  // sample a few pixels via an offscreen read
  const ctx2 = c.getContext('2d');
  let nonUniform = false;
  try {
    const d = ctx2.getImageData(0, 0, c.width, c.height).data;
    const first = `${d[0]},${d[1]},${d[2]}`;
    for (let i = 0; i < d.length; i += 4000 * 4) {
      if (`${d[i]},${d[i+1]},${d[i+2]}` !== first) { nonUniform = true; break; }
    }
  } catch (e) {}
  return { ok: true, w: c.width, h: c.height, bytes: url.length, nonUniform };
});
console.log('canvas:', JSON.stringify(canvasInfo));

// Find the live-preview region (the canvas's container) and shoot just that.
const canvas = page.locator('canvas');
await canvas.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await canvas.screenshot({ path: OUT });

console.log('saved', OUT);
await browser.close();
