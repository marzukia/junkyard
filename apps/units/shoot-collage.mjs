import { chromium } from 'playwright';
const URL = 'https://collage.mrzk.io/';

// Brand solid-colour test PNGs generated in Node (no canvas needed: build raw PNG buffers)
// Simpler: generate them in-page and hand buffers to setInputFiles. We build PNGs here via a tiny encoder.
import zlib from 'node:zlib';

function solidPng(w, h, [r, g, b]) {
  // PNG with a single solid colour, 8-bit RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[1 + x * 3 + 1] = g; row[1 + x * 3 + 2] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return c ^ 0xffffffff; }

const teal = solidPng(800, 800, [13, 148, 136]);
const amber = solidPng(800, 800, [217, 119, 6]);
const coral = solidPng(800, 800, [239, 99, 79]);
const navy = solidPng(800, 800, [30, 41, 99]);
const files = [
  { name: 'teal.png', mimeType: 'image/png', buffer: teal },
  { name: 'amber.png', mimeType: 'image/png', buffer: amber },
  { name: 'coral.png', mimeType: 'image/png', buffer: coral },
  { name: 'navy.png', mimeType: 'image/png', buffer: navy },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

// Light mode
const lightBtn = page.locator('button', { hasText: /^Light$/ });
if (await lightBtn.count()) { await lightBtn.first().click(); await page.waitForTimeout(300); }

// Ensure Grid mode + 2x2 (4 cell) layout
const gridBtn = page.locator('button', { hasText: /^Grid$/ });
if (await gridBtn.count()) { await gridBtn.first().click(); await page.waitForTimeout(200); }
const fourBtn = page.locator('button', { hasText: /^4$/ });
if (await fourBtn.count()) { await fourBtn.first().click(); await page.waitForTimeout(300); }

// Feed the multi-file input ("Choose files") with all 4 brand images
const fileInputs = page.locator('input[type="file"]');
const n = await fileInputs.count();
console.log('file inputs:', n);
// The first file input is the global multi-file chooser
await fileInputs.first().setInputFiles(files);
await page.waitForTimeout(1500);

// Check how many cells got filled
let filled = await page.locator('button[aria-label*="empty"]').count();
console.log('still-empty cells after multi-add:', filled);

// If cells remain empty, fill each per-cell input individually
if (filled > 0) {
  const allInputs = page.locator('input[type="file"]');
  const ni = await allInputs.count();
  for (let i = 0; i < Math.min(ni, files.length); i++) {
    try { await allInputs.nth(i).setInputFiles([files[i]]); await page.waitForTimeout(400); } catch (e) { console.log('input', i, 'err', e.message); }
  }
  await page.waitForTimeout(1000);
}

// Set spacing ~10. It's a Mantine Slider (thumb has role=slider, value 8, min 0 max 40).
// The first slider thumb is "Spacing" (#gutter-slider). Focus it and arrow up to 10.
const thumbs = page.locator('[role="slider"]');
const tc = await thumbs.count();
console.log('slider thumbs:', tc);
if (tc > 0) {
  const spacing = thumbs.first();
  const cur = parseInt(await spacing.getAttribute('aria-valuenow') || '8', 10);
  await spacing.focus();
  const delta = 10 - cur;
  const key = delta >= 0 ? 'ArrowRight' : 'ArrowLeft';
  for (let i = 0; i < Math.abs(delta); i++) { await spacing.press(key); await page.waitForTimeout(40); }
  await page.waitForTimeout(300);
  console.log('spacing now:', await spacing.getAttribute('aria-valuenow'));
}

// Set a background colour — use the Navy custom colour for a branded frame.
// Prefer the "Teal" swatch as a brand background; but cells already use teal, so use custom navy bg.
const bgColor = page.locator('input[type="color"][aria-label="Custom background colour"]');
if (await bgColor.count()) {
  await bgColor.first().evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, '#1e2963');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
}

// Report fill state
filled = await page.locator('button[aria-label*="empty"]').count();
console.log('FINAL still-empty cells:', filled);
const labels = await page.locator('label').allTextContents();
console.log('LABELS:', JSON.stringify(labels));

// Locate the collage preview element to screenshot. The actual square collage is
// .grid-canvas-outer (580x580); .canvas-area is a wider wrapper with empty space.
const previewSel = [
  '.grid-canvas-outer', '.canvas-wrapper', '[class*="canvas"]', '[class*="collage"]', 'main',
];
let target = null;
for (const sel of previewSel) {
  const loc = page.locator(sel).first();
  if (await loc.count()) {
    const box = await loc.boundingBox();
    if (box && box.width > 200 && box.height > 200) { target = loc; console.log('preview target:', sel, JSON.stringify(box)); break; }
  }
}

// Fallback: compute the bounding box that contains all 4 cell buttons
if (!target) {
  const cells = page.locator('button[aria-label^="Cell"]');
  console.log('cells found:', await cells.count());
}

await page.waitForTimeout(500);
if (target) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const pad = 8;
  await page.screenshot({
    path: '/home/planky/projects/_fleet/shots/ex-collage.png',
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 },
  });
  console.log('SAVED ex-collage.png (clipped to preview)');
} else {
  await page.screenshot({ path: '/home/planky/projects/_fleet/shots/ex-collage.png' });
  console.log('SAVED ex-collage.png (full page fallback)');
}

await browser.close();
