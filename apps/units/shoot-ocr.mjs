import { chromium } from 'playwright';
const URL = 'https://ocr.mrzk.io/';
const OUT = '/home/planky/projects/_fleet/shots/ex-ocr.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
page.on('console', m => { if (/ERR|fail/i.test(m.text())) console.log('PAGE:', m.text()); });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

// Force light mode
const lightBtn = page.locator('button', { hasText: /^Light$/ });
if (await lightBtn.count()) { await lightBtn.first().click(); await page.waitForTimeout(300); }

// Generate a PNG in-page via canvas: clear black text on white
const dataUrl = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 220;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000000';
  x.font = 'bold 64px Arial, sans-serif';
  x.textBaseline = 'middle';
  x.textAlign = 'center';
  x.fillText('MRZK.IO OCR TEST 12345', c.width / 2, c.height / 2);
  return c.toDataURL('image/png');
});

const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');

// Feed into the tool's file input
const fileInput = page.locator('input.ocr-file-input');
await fileInput.setInputFiles({ name: 'mrzk-ocr-test.png', mimeType: 'image/png', buffer });
await page.waitForTimeout(800);

// Click Extract Text
const extract = page.locator('button', { hasText: /Extract Text/ });
await extract.first().click();

// Wait for recognized text to appear in the DOM
const target = 'MRZK.IO OCR TEST 12345';
let found = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  const txt = await page.evaluate(() => document.body.innerText);
  // normalise spaces for the match
  const norm = txt.replace(/\s+/g, ' ');
  if (norm.includes('MRZK.IO OCR TEST 12345') || /MRZK\.?IO.*OCR.*TEST.*12345/.test(norm)) { found = true; break; }
  // also break if a textarea/result region got populated with our digits
  const hasDigits = /12345/.test(norm) && /OCR/.test(norm);
  if (hasDigits && i > 3) { found = true; break; }
}
console.log('FOUND:', found);

// Dump what the recognized output looks like
const dump = await page.evaluate(() => {
  const ta = document.querySelector('textarea');
  const pre = document.querySelector('pre');
  return { textarea: ta ? ta.value : null, pre: pre ? pre.innerText : null };
});
console.log('RESULT DUMP:', JSON.stringify(dump));

await page.waitForTimeout(500);

// Find the result/output region to crop. Prefer an element containing the extracted text.
const clip = await page.evaluate((needleDigits) => {
  // candidate result containers
  const all = [...document.querySelectorAll('textarea, pre, [class*="result"], [class*="output"], [class*="text"]')];
  let best = null, bestArea = Infinity;
  for (const el of all) {
    const t = (el.value || el.innerText || '');
    if (/12345/.test(t) && /OCR/i.test(t)) {
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (r.width > 50 && r.height > 20 && area < bestArea) { best = r; bestArea = area; }
    }
  }
  if (best) return { x: best.x, y: best.y, width: best.width, height: best.height };
  return null;
}, '12345');
console.log('CLIP:', JSON.stringify(clip));

if (clip) {
  const pad = 24;
  await page.screenshot({
    path: OUT,
    clip: {
      x: Math.max(0, clip.x - pad),
      y: Math.max(0, clip.y - pad),
      width: Math.min(1440 - Math.max(0, clip.x - pad), clip.width + pad * 2),
      height: clip.height + pad * 2,
    },
  });
  console.log('SAVED (clipped) ex-ocr.png');
} else {
  // fallback: full page screenshot so we at least capture state
  await page.screenshot({ path: OUT, fullPage: false });
  console.log('SAVED (fallback full viewport) ex-ocr.png');
}
await browser.close();
