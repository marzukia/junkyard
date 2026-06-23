import { chromium } from 'playwright';
const URL = 'https://mrzk.io/posts/did-covid19-make-trump-president/';
const OUT = '/home/planky/projects/_fleet/shots';

async function run(dark) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport:{width:1440,height:900}, colorScheme: dark?'dark':'light', deviceScaleFactor:2 })).newPage();
  await page.goto(URL, { waitUntil:'networkidle', timeout:60000 });
  await page.evaluate((d)=>{ document.documentElement.classList.toggle('dark', d); document.documentElement.classList.toggle('light', !d); }, dark);
  await page.waitForTimeout(600);
  const tag = dark?'dark':'light';

  // header / hero region
  await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/region-${tag}-header.png` });

  // scroll to first chart and capture viewport with surrounding prose
  const firstChart = await page.$('article img[src*="education"], main img[src*="education"]');
  if (firstChart) { await firstChart.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    await page.evaluate(()=>window.scrollBy(0,-180)); await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/region-${tag}-chart-incontext.png` }); }

  // references / footer
  await page.evaluate(()=>window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/region-${tag}-footer.png` });
  await browser.close();
}
await run(false);
await run(true);
console.log('regions done');
