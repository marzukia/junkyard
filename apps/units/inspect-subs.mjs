import { chromium } from 'playwright';
const URL = 'https://subs.mrzk.io/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  const o = {};
  o.title = document.title;
  o.bodyText = document.body.innerText.slice(0, 1500);
  o.fileInputs = document.querySelectorAll('input[type="file"]').length;
  o.textareas = [...document.querySelectorAll('textarea')].map(t => ({ ph: t.placeholder, cls: t.className.slice(0,60) }));
  o.buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0,40)).filter(Boolean);
  o.inputs = [...document.querySelectorAll('input')].map(i => ({ type: i.type, ph: i.placeholder }));
  o.contentEditable = document.querySelectorAll('[contenteditable]').length;
  return o;
});
console.log(JSON.stringify(out, null, 2));
await page.screenshot({ path: '/home/planky/projects/_fleet/shots/subs-initial.png' });
await browser.close();
