import { chromium } from 'playwright';

const URL = 'https://og.mrzk.io/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 }, colorScheme: 'light', deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => console.log('PAGE:', m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const out = {};
  out.title = document.title;
  out.h1 = [...document.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ':' + e.textContent.trim().slice(0,60));
  out.inputs = [...document.querySelectorAll('input, textarea, select')].map(e => ({
    tag: e.tagName, type: e.type, name: e.name, id: e.id,
    placeholder: e.placeholder, label: (e.labels && e.labels[0] && e.labels[0].textContent.trim()) || '',
  }));
  out.buttons = [...document.querySelectorAll('button, a[role=button], [role=tab]')].map(e => e.textContent.trim().slice(0,40)).filter(Boolean);
  out.canvases = document.querySelectorAll('canvas').length;
  out.imgs = [...document.querySelectorAll('img')].map(i => i.src.slice(0,60));
  return out;
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: '/home/planky/projects/_fleet/shots/og-inspect.png', fullPage: true });
await browser.close();
