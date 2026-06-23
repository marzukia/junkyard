import { chromium } from 'playwright';
const URL = 'https://exif.mrzk.io/';
const OUT = '/home/planky/projects/_fleet/shots/ex-exif.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2000);

// Feed the EXIF-rich JPEG to the file input.
const input = await page.$('input.drop-zone-input, input[type=file]');
await input.setInputFiles('/tmp/exif-sample.jpg');

// Wait for metadata panel to render.
await page.waitForTimeout(3000);

const txt = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log('--- body after upload ---');
console.log(txt);

// Try to find the results region to crop tightly.
const sel = await page.evaluate(() => {
  // Look for an element that now contains EXIF field labels.
  const candidates = [...document.querySelectorAll('div,section,main')];
  for (const el of candidates) {
    const t = el.innerText || '';
    if (/Canon|Make|GPS|Latitude|Focal|ISO|Aperture|Exposure/i.test(t) && t.length < 2000) {
      const r = el.getBoundingClientRect();
      if (r.width > 200 && r.height > 150) {
        el.setAttribute('data-shot', '1');
        return { found: true, w: r.width, h: r.height };
      }
    }
  }
  return { found: false };
});
console.log('crop target:', JSON.stringify(sel));

if (sel.found) {
  const el = await page.$('[data-shot="1"]');
  await el.screenshot({ path: OUT });
} else {
  await page.screenshot({ path: OUT, fullPage: false });
}
console.log('saved', OUT);
await browser.close();
