import { chromium } from 'playwright';
const browser = await chromium.launch();
// CSV: what's the default output format and does JSON tab work?
const ctx = await browser.newContext({ viewport:{width:1440,height:900}, permissions:['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
await page.goto('https://csv.mrzk.io',{waitUntil:'networkidle'});
await page.waitForTimeout(500);
await page.locator('textarea').first().fill('name,age,city\nAlice,30,NYC\nBob,25,"LA, CA"');
// click JSON button explicitly
await page.locator('button:has-text("JSON")').first().click().catch(()=>{});
await page.waitForTimeout(500);
const jsonOut = await page.locator('textarea').nth(1).inputValue().catch(()=>'');
console.log('CSV JSON output (first 300):', jsonOut.slice(0,300));
console.log('JSON valid parse:', (()=>{try{JSON.parse(jsonOut);return true}catch(e){return e.message.slice(0,80)}})());

// base64 copy toast WITH clipboard perms
await page.goto('https://base64.mrzk.io',{waitUntil:'networkidle'});
await page.waitForTimeout(400);
await page.locator('textarea').first().fill('test');
await page.locator('button:has-text("Encode")').first().click().catch(()=>{});
await page.waitForTimeout(300);
const copyBtn = page.locator('button:has-text("Copy")').first();
const copyVisible = await copyBtn.isVisible();
await copyBtn.click().catch(e=>console.log('copy click err',e.message));
await page.waitForTimeout(500);
const afterCopy = await page.locator('body').innerText();
console.log('base64 copy btn visible:', copyVisible);
console.log('toast/copied text present:', /copied/i.test(afterCopy));
const clip = await page.evaluate(()=>navigator.clipboard.readText().catch(()=>'ERR')).catch(()=>'noaccess');
console.log('clipboard content:', clip);
await browser.close();
