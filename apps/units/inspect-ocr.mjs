import { chromium } from 'playwright';
const URL = 'https://ocr.mrzk.io/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
page.on('console', m => console.log('PAGE:', m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].map(i => ({ type: i.type, accept: i.accept, id: i.id, name: i.name, cls: i.className }));
  const buttons = [...document.querySelectorAll('button')].map(b => ({ text: b.textContent.trim().slice(0,40), aria: b.getAttribute('aria-label') }));
  const textareas = [...document.querySelectorAll('textarea')].map(t => ({ id: t.id, cls: t.className, ph: t.placeholder }));
  return { title: document.title, inputs, buttons, textareas, bodyText: document.body.innerText.slice(0, 800) };
});
console.log('INFO:', JSON.stringify(info, null, 2));
await browser.close();
