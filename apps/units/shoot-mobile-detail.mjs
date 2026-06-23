import { chromium } from 'playwright';
const URL = 'https://mrzk.io/posts/did-covid19-make-trump-president/';
const OUT = '/home/planky/projects/_fleet/shots';
const browser = await chromium.launch();
// mobile dark chart detail
let page = await (await browser.newContext({ viewport:{width:390,height:844}, colorScheme:'dark', deviceScaleFactor:2 })).newPage();
await page.goto(URL,{waitUntil:'networkidle',timeout:60000});
await page.evaluate(()=>document.documentElement.classList.add('dark'));
await page.waitForTimeout(500);
const c = await page.$('img[src*="education"]');
await c.scrollIntoViewIfNeeded(); await page.evaluate(()=>window.scrollBy(0,-120)); await page.waitForTimeout(300);
await page.screenshot({ path:`${OUT}/mobile-dark-chart.png` });
// references light
await page.close();
page = await (await browser.newContext({ viewport:{width:1440,height:900}, colorScheme:'light', deviceScaleFactor:2 })).newPage();
await page.goto(URL,{waitUntil:'networkidle',timeout:60000});
await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight-1400)); await page.waitForTimeout(400);
await page.screenshot({ path:`${OUT}/region-light-references.png` });
await browser.close();
console.log('ok');
