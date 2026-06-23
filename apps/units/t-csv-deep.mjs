import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
const page = await ctx.newPage();
await page.goto('https://csv.mrzk.io',{waitUntil:'networkidle'});
await page.waitForTimeout(500);
await page.locator('textarea').first().fill('name,age,city\nAlice,30,NYC\nBob,25,"LA, CA"');
await page.waitForTimeout(600);

// Check default state - which format button is active, and all textarea/output values
async function dump(tag){
  const tas = await page.locator('textarea').all();
  const vals = [];
  for (let i=0;i<tas.length;i++) vals.push(await tas[i].inputValue().catch(()=>'(err)'));
  // also any <pre> or code output
  const pre = await page.locator('pre, code').allTextContents().catch(()=>[]);
  console.log(`--- ${tag} ---`);
  vals.forEach((v,i)=>console.log(`  textarea[${i}] (${v.length}ch): ${v.slice(0,120).replace(/\n/g,'\\n')}`));
  if(pre.length) console.log('  pre/code:', JSON.stringify(pre).slice(0,200));
}
await dump('default (no format clicked)');

// click each format and dump
for (const f of ['JSON','MD','SQL','XML','YAML']) {
  await page.locator(`button:has-text("${f}")`).first().click().catch(()=>{});
  await page.waitForTimeout(400);
  await dump(`after ${f}`);
}
await browser.close();
