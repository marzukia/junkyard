import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'https://pdf.mrzk.io/';
const OUT = '/home/planky/projects/_fleet/shots/ex-pdf.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, colorScheme: 'light', acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2000);

// Force light mode
const lightBtn = page.locator('button', { hasText: /^Light$/ });
if (await lightBtn.count()) { await lightBtn.first().click(); await page.waitForTimeout(200); }

// Switch to Images -> PDF
await page.locator('button', { hasText: 'Images → PDF' }).first().click();
await page.waitForTimeout(600);

// Generate two branded page PNGs in-page via canvas, return as base64
const pages = await page.evaluate(() => {
  function makePage(title, subtitle, accent, items) {
    const c = document.createElement('canvas');
    c.width = 1240; c.height = 1754; // A4-ish @150dpi portrait
    const x = c.getContext('2d');
    // background
    x.fillStyle = '#ffffff'; x.fillRect(0,0,c.width,c.height);
    // accent header band
    x.fillStyle = accent; x.fillRect(0,0,c.width,210);
    x.fillStyle = '#ffffff';
    x.font = '700 76px Helvetica, Arial, sans-serif';
    x.fillText(title, 80, 120);
    x.font = '400 34px Helvetica, Arial, sans-serif';
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.fillText(subtitle, 82, 172);
    // body items
    x.fillStyle = '#11181c';
    let y = 360;
    for (const it of items) {
      x.fillStyle = accent;
      x.beginPath(); x.arc(110, y-12, 12, 0, Math.PI*2); x.fill();
      x.fillStyle = '#11181c';
      x.font = '500 40px Helvetica, Arial, sans-serif';
      x.fillText(it, 150, y);
      y += 96;
    }
    // a simple bar chart block
    x.fillStyle = '#11181c';
    x.font = '600 38px Helvetica, Arial, sans-serif';
    x.fillText('Quarterly figures', 80, y+40);
    const bars = [0.4, 0.7, 0.55, 0.9];
    const bx = 90, by = y+90, bw = 200, gap = 70, maxh = 360;
    bars.forEach((b,i)=>{
      x.fillStyle = accent;
      const h = b*maxh;
      x.fillRect(bx + i*(bw+gap), by + (maxh-h), bw, h);
    });
    // footer
    x.fillStyle = '#687076';
    x.font = '400 26px Helvetica, Arial, sans-serif';
    x.fillText('Generated with pdf.mrzk.io — runs entirely in your browser', 80, c.height-70);
    return c.toDataURL('image/png');
  }
  return [
    makePage('Acme Report', '2026 · Annual summary', '#1f6feb',
      ['Revenue grew 18% year over year','Two new markets opened in Q3','Customer churn dropped to 4.2%']),
    makePage('Appendix', 'Supporting figures', '#16a34a',
      ['Methodology and data sources','Regional breakdown tables','Glossary of terms']),
  ];
});

// Convert dataURLs to buffers and feed the file input
const files = pages.map((d, i) => ({
  name: `page-${i+1}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(d.split(',')[1], 'base64'),
}));
await page.locator('input[type=file]').setInputFiles(files);
await page.waitForTimeout(1200);

// Snapshot the loaded state (thumbnails / list)
const loadedBtns = await page.evaluate(() => [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean));
console.log('AFTER UPLOAD BUTTONS:', JSON.stringify(loadedBtns));

// Trigger the conversion and capture the resulting download
const convertBtn = page.locator('button', { hasText: /Convert \d+ image/ });
let downloadOk = false, downloadName = '', downloadSize = 0;
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    convertBtn.click(),
  ]);
  downloadName = download.suggestedFilename();
  const dlPath = `/home/planky/projects/_fleet/shots/_pdf-out.pdf`;
  await download.saveAs(dlPath);
  downloadSize = fs.statSync(dlPath).size;
  const head = fs.readFileSync(dlPath).subarray(0, 5).toString('latin1');
  downloadOk = head === '%PDF-';
  console.log('DOWNLOAD:', downloadName, downloadSize, 'bytes, valid PDF:', downloadOk);
} catch (e) {
  console.log('NO DOWNLOAD EVENT:', e.message);
}
await page.waitForTimeout(800);

// Screenshot the populated tool card (the panel showing the uploaded pages + convert state)
const card = page.locator('main, [class*=card], [class*=panel]').first();
let clip = null;
try {
  const box = await card.boundingBox();
  if (box) clip = { x: Math.max(0, box.x-8), y: Math.max(0, box.y-8), width: Math.min(box.width+16, 1440), height: Math.min(box.height+16, 1100) };
} catch {}
await page.screenshot({ path: OUT, ...(clip ? { clip } : { fullPage: false }) });
console.log('SAVED', OUT, 'clip:', JSON.stringify(clip));

await browser.close();
