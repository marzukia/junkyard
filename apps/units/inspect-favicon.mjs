import { chromium } from 'playwright';
const URL = 'https://favicon.mrzk.io/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].map(i => ({ type: i.type, accept: i.accept, id: i.id, name: i.name, cls: i.className }));
  const buttons = [...document.querySelectorAll('button')].map(b => ({ text: b.textContent.trim().slice(0,40), aria: b.getAttribute('aria-label') }));
  const headings = [...document.querySelectorAll('h1,h2,h3')].map(h => h.textContent.trim().slice(0,60));
  return { title: document.title, inputs, buttons, headings, bodyText: document.body.innerText.slice(0, 600) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
