import { chromium } from 'playwright';
const URL = 'https://favicon.mrzk.io/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1300 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const lightBtn = page.locator('button', { hasText: /^Light$/ });
if (await lightBtn.count()) { await lightBtn.first().click(); await page.waitForTimeout(300); }

const dataUrl = await page.evaluate(() => {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  const r = 96;
  x.fillStyle = '#1f6feb';
  x.beginPath();
  x.moveTo(r, 0);
  x.arcTo(S, 0, S, S, r);
  x.arcTo(S, S, 0, S, r);
  x.arcTo(0, S, 0, 0, r);
  x.arcTo(0, 0, S, 0, r);
  x.closePath();
  x.fill();
  x.fillStyle = '#ffffff';
  x.font = '700 320px Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('M', S / 2, S / 2 + 24);
  return c.toDataURL('image/png');
});

const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles({ name: 'logo-m.png', mimeType: 'image/png', buffer });
await page.waitForTimeout(800);

const textInput = page.locator('input[type="text"]').first();
if (await textInput.count()) { await textInput.fill('mrzk'); await page.waitForTimeout(200); }

const genBtn = page.locator('button', { hasText: /Generate favicon set/i });
await genBtn.click();
await page.waitForTimeout(2500);

// Find the card/section that contains the PREVIEW label + size grid
const clip = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')];
  const label = els.find(e => e.children.length === 0 && e.textContent.trim().toLowerCase() === 'preview');
  if (!label) return null;
  // climb until the bounding box is tall enough to enclose the size-tile grid (card)
  let cur = label;
  while (cur.parentElement) {
    const r = cur.getBoundingClientRect();
    if (r.width > 600 && r.height > 130) break;
    cur = cur.parentElement;
  }
  const r = cur.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
console.log('CLIP:', JSON.stringify(clip));

const pad = 16;
if (clip && clip.height > 100 && clip.width > 400) {
  await page.screenshot({
    path: '/home/planky/projects/_fleet/shots/ex-favicon.png',
    clip: {
      x: Math.max(0, clip.x - pad),
      y: Math.max(0, clip.y - pad),
      width: Math.min(clip.width + pad * 2, 1440 - Math.max(0, clip.x - pad)),
      height: clip.height + pad * 2,
    },
  });
  console.log('SAVED via clip');
} else {
  await page.screenshot({ path: '/home/planky/projects/_fleet/shots/ex-favicon.png', fullPage: true });
  console.log('SAVED fullPage fallback');
}

await browser.close();
