import { chromium } from 'playwright';
const browser = await chromium.launch();
const out = [];
async function run(vw, label) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 800 : 900 }, isMobile: vw < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,150)); });
  page.on('pageerror', e => errs.push('PE:'+e.message.slice(0,150)));
  await page.goto('https://json.mrzk.io', { waitUntil:'networkidle' });
  const ta = page.locator('textarea').first();
  // valid json
  await ta.fill('{"b":2,"a":1,"nested":{"x":[1,2,3]}}');
  await page.locator('button:has-text("Format")').first().click();
  await page.waitForTimeout(400);
  let outVal = await page.locator('textarea').nth(1).inputValue().catch(()=>'');
  const formatted = outVal.includes('\n');
  // invalid json
  await ta.fill('{bad json,,,}');
  await page.waitForTimeout(400);
  const bodyText = await page.locator('body').innerText();
  const hasError = /error|invalid|unexpected|expect/i.test(bodyText);
  // huge
  const huge = JSON.stringify(Array.from({length:5000},(_,i)=>({i,v:'x'.repeat(20)})));
  await ta.fill(huge);
  await page.locator('button:has-text("Format")').first().click();
  await page.waitForTimeout(600);
  // tree
  await ta.fill('{"a":1,"arr":[1,2]}');
  await page.locator('button:has-text("Tree")').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  const treeText = await page.locator('body').innerText();
  // sample btn
  await page.locator('button:has-text("Sample")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const afterSample = await ta.inputValue().catch(()=>'');
  out.push({vw, label, formatted, hasError, sampleLoaded: afterSample.length>0, treeShows: /\b(a|arr)\b/.test(treeText), errs});
  await ctx.close();
}
await run(1440,'desktop');
await run(390,'mobile');
console.log(JSON.stringify(out,null,1));
await browser.close();
