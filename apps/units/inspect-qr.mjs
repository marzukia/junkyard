import { chromium } from 'playwright';
const URL = 'https://qr.mrzk.io/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const out = {};
  out.title = document.title;
  out.inputs = [...document.querySelectorAll('input, textarea')].map(el => ({
    tag: el.tagName, type: el.type, placeholder: el.placeholder, name: el.name,
    aria: el.getAttribute('aria-label'), id: el.id, value: el.value,
  }));
  out.buttons = [...document.querySelectorAll('button')].map(b => ({ text: b.innerText.trim(), aria: b.getAttribute('aria-label') }));
  out.canvases = [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height }));
  out.svgs = document.querySelectorAll('svg').length;
  out.colorInputs = [...document.querySelectorAll('input[type=color]')].map(c => ({ id: c.id, value: c.value }));
  // grab swatches / colour buttons
  out.bodyText = document.body.innerText.slice(0, 800);
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
