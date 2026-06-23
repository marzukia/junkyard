import { chromium } from 'playwright';
const URL = 'https://subs.mrzk.io/';
const OUT = '/home/planky/projects/_fleet/shots/ex-subs.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2000);

// Force light mode
const lightBtn = page.locator('button', { hasText: /^Light$/ });
if (await lightBtn.count()) { await lightBtn.first().click(); await page.waitForTimeout(300); }

const srt = `1
00:00:01,000 --> 00:00:03,000
Hello from mrzk.io

2
00:00:04,500 --> 00:00:07,200
Edit, shift & convert subtitles
right here in your browser
`;
const buffer = Buffer.from(srt, 'utf-8');
const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles({ name: 'demo.srt', mimeType: 'application/x-subrip', buffer });
await page.waitForTimeout(1500);

// The parsed-cue table IS the output. Screenshot that element directly.
const handle = await page.evaluateHandle(() => {
  const cueText = [...document.querySelectorAll('textarea')].find(t => t.value.includes('Hello from mrzk.io'));
  let table = cueText;
  // climb to the card that wraps the "# / TIMINGS / TEXT" table
  while (table && table.parentElement && !(table.textContent.includes('TIMINGS') && table.getBoundingClientRect().width > 700)) table = table.parentElement;
  table.scrollIntoView({ block: 'center' });
  return table;
});
const el = handle.asElement();
await page.waitForTimeout(300);
await el.screenshot({ path: OUT });

const out = await page.evaluate(() => ({
  cues: document.body.innerText.match(/(\d+)\s*cues/)?.[0] || '',
  texts: [...document.querySelectorAll('textarea')].map(t => t.value),
}));
console.log('OUTPUT:', JSON.stringify(out, null, 2));
await browser.close();
