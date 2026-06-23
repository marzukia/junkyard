import { chromium } from 'playwright';

const URL = 'https://bg.mrzk.io/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`.slice(0, 200)));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`.slice(0, 200)));

const result = {};
try {
  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  result.httpStatus = resp ? resp.status() : null;
} catch (e) {
  result.gotoError = String(e);
}
await page.waitForTimeout(3000);
result.title = await page.title();

result.dom = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
    type: el.type, accept: el.accept, id: el.id, name: el.name,
    hidden: el.offsetParent === null,
  }));
  const buttons = Array.from(document.querySelectorAll('button')).map((b) => (b.innerText || '').trim().slice(0, 40));
  return {
    bodyText: (document.body.innerText || '').slice(0, 600),
    inputs,
    buttons,
    hasCanvas: document.querySelectorAll('canvas').length,
    hasImg: document.querySelectorAll('img').length,
  };
});
result.logs = logs;
console.log(JSON.stringify(result, null, 2));
await browser.close();
