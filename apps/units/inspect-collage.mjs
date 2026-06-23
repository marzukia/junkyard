import { chromium } from 'playwright';
const URL = 'https://collage.mrzk.io/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const out = {};
  out.title = document.title;
  out.buttons = [...document.querySelectorAll('button')].map(b => ({ t: b.textContent.trim().slice(0,40), aria: b.getAttribute('aria-label') }));
  out.inputs = [...document.querySelectorAll('input')].map(i => ({ type: i.type, id: i.id, name: i.name, accept: i.accept, aria: i.getAttribute('aria-label'), placeholder: i.placeholder }));
  out.selects = [...document.querySelectorAll('select')].map(s => ({ id: s.id, opts: [...s.options].map(o=>o.textContent.trim()) }));
  out.canvases = [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height }));
  out.labels = [...document.querySelectorAll('label')].map(l => l.textContent.trim().slice(0,40));
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
