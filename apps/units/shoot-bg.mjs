import { chromium } from 'playwright';

const URL = 'https://bg.mrzk.io/';
const SHOT = '/home/planky/projects/_fleet/shots/ex-bg.png';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`.slice(0, 160)));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`.slice(0, 160)));

const result = {};
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 200, 200);
  g.fillStyle = '#e01b1b';
  g.beginPath(); g.arc(100, 100, 80, 0, Math.PI * 2); g.fill();
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'red-circle.png', { type: 'image/png' });
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

// Wait until an AFTER image appears (a second blob img) or download button.
const start = Date.now();
let processed = false;
while (Date.now() - start < 90000) {
  const state = await page.evaluate(() => {
    const txt = (document.body.innerText || '').toLowerCase();
    const imgs = document.querySelectorAll('img').length;
    const dl = Array.from(document.querySelectorAll('a,button')).some((b) => /download|save|png/i.test(b.innerText || '') || b.hasAttribute('download'));
    const after = txt.includes('after');
    return { imgs, dl, after, processing: txt.includes('processing') || txt.includes('removing') };
  });
  if ((state.imgs >= 2 || state.dl) && !state.processing) { processed = true; break; }
  await page.waitForTimeout(1500);
}
result.processed = processed;
result.elapsedMs = Date.now() - start;
await page.waitForTimeout(2000);

// Dump DOM structure to find the result container.
result.dom = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img')).map((i) => ({
    w: i.naturalWidth, h: i.naturalHeight, src: (i.src || '').slice(0, 25),
    rect: (() => { const r = i.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
  }));
  const dlBtns = Array.from(document.querySelectorAll('a,button')).filter((b) => /download|save/i.test(b.innerText || '') || b.hasAttribute('download')).map((b) => (b.innerText || '').trim().slice(0, 30));
  return { imgs, dlBtns, bodyText: (document.body.innerText || '').slice(0, 500) };
});

// Find the smallest common container that holds BOTH before and after images.
const handle = await page.evaluateHandle(() => {
  const imgs = Array.from(document.querySelectorAll('img')).filter((i) => i.naturalWidth >= 50);
  if (imgs.length < 2) return imgs[0]?.closest('section,div,main') || document.querySelector('main') || document.body;
  // common ancestor of first two images
  let a = imgs[0], b = imgs[1];
  const anc = new Set();
  let n = a;
  while (n) { anc.add(n); n = n.parentElement; }
  let m = b;
  while (m && !anc.has(m)) m = m.parentElement;
  return m || document.querySelector('main') || document.body;
});
const el = handle.asElement();
if (el) {
  await el.screenshot({ path: SHOT });
  result.clip = 'common-ancestor';
} else {
  await page.screenshot({ path: SHOT, fullPage: false });
  result.clip = 'fullpage';
}

result.logs = logs.slice(-10);
console.log(JSON.stringify(result, null, 2));
await browser.close();
