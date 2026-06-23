import { chromium } from 'playwright';
const browser = await chromium.launch();
const results = {};
async function withPage(slug, vw, fn) {
  const ctx = await browser.newContext({ viewport:{width:vw,height:vw<500?800:900}, isMobile:vw<500 });
  const page = await ctx.newPage();
  const errs=[];
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,150));});
  page.on('pageerror',e=>errs.push('PE:'+e.message.slice(0,150)));
  await page.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  let r; try { r = await fn(page); } catch(e){ r={fnError:e.message.slice(0,200)}; }
  r.errs = errs;
  await ctx.close();
  return r;
}

async function mdTest(page){
  const ta = page.locator('textarea').first();
  await ta.fill('# Title\n\n**bold** and *italic*\n\n- item 1\n- item 2\n\n```js\nconst x=1;\n```\n\n[link](https://x.com)');
  await page.waitForTimeout(500);
  // preview
  await page.locator('button:has-text("Preview")').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  const body = await page.locator('body').innerText();
  // toolbar bold
  await page.locator('button:has-text("Edit")').first().click().catch(()=>{});
  await page.waitForTimeout(200);
  // copy html
  await page.locator('button:has-text("Copy HTML")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const afterCopy = await page.locator('body').innerText();
  // TOC
  await page.locator('button:has-text("TOC")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const tocVal = await ta.inputValue();
  return { previewRenders: /Title|bold|item 1/i.test(body), copyToast: /copied/i.test(afterCopy), tocInserted: /\[Title\]|#title|Table of Contents/i.test(tocVal) };
}

async function cssTest(page){
  // box shadow default -> copy CSS
  const body0 = await page.locator('body').innerText();
  const hasBoxShadow = /box-shadow/i.test(body0);
  // adjust a range
  const range = page.locator('input[type=range]').first();
  await range.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  // switch to gradient tab
  await page.locator('button:has-text("Linear")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const gradBody = await page.locator('body').innerText();
  const gradShows = /linear-gradient/i.test(gradBody);
  // glassmorphism
  await page.locator('button:has-text("Glassmorphism")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const glassBody = await page.locator('body').innerText();
  const glassShows = /backdrop-filter|blur/i.test(glassBody);
  // cubic bezier
  await page.locator('button:has-text("Cubic Bezier")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const cbBody = await page.locator('body').innerText();
  const cbShows = /cubic-bezier/i.test(cbBody);
  // copy
  await page.locator('button:has-text("Copy CSS")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const afterCopy = await page.locator('body').innerText();
  return { hasBoxShadow, gradShows, glassShows, cbShows, copyToast:/copied/i.test(afterCopy) };
}

async function tsTest(page){
  // epoch to date default
  const body0 = await page.locator('body').innerText();
  // use now
  await page.locator('button:has-text("Use now")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  // enter epoch
  const inp = page.locator('input[type=text]').first();
  await inp.fill('1700000000');
  await page.waitForTimeout(500);
  const body = await page.locator('body').innerText();
  const has2023 = /2023/.test(body);
  // date to epoch
  await page.locator('button:has-text("Date to epoch")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const dteBody = await page.locator('body').innerText();
  // bulk textarea
  const bulkTa = page.locator('textarea').first();
  await bulkTa.fill('1700000000\n1750000000\nnotanumber');
  await page.waitForTimeout(400);
  const bulkBody = await page.locator('body').innerText();
  // garbage
  await page.locator('button:has-text("Epoch to date")').first().click().catch(()=>{});
  await inp.fill('garbagexyz');
  await page.waitForTimeout(400);
  const garbBody = await page.locator('body').innerText();
  return { has2023, bulkWorks: /2023|2025|invalid/i.test(bulkBody), garbageHandled:/invalid|error|—|not a/i.test(garbBody) };
}

async function uuidTest(page){
  const body0 = await page.locator('body').innerText();
  const uuidV4 = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/.test(body0);
  // regenerate
  await page.locator('button:has-text("Regenerate")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  // v7
  await page.locator('button:has-text("UUID v7")').first().click().catch(()=>{});
  await page.locator('button:has-text("Regenerate")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const v7body = await page.locator('body').innerText();
  const uuidV7 = /[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}/.test(v7body);
  // nano id
  await page.locator('button:has-text("Nano ID")').first().click().catch(()=>{});
  await page.locator('button:has-text("Regenerate")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  // ULID
  await page.locator('button:has-text("ULID")').first().click().catch(()=>{});
  await page.locator('button:has-text("Regenerate")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  // v5 needs namespace+name - check inputs appear
  await page.locator('button:has-text("UUID v5")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const v5body = await page.locator('body').innerText();
  // count change
  const numInp = page.locator('input[type=number]').first();
  await numInp.fill('10');
  await page.locator('button:has-text("UUID v4")').first().click().catch(()=>{});
  await page.locator('button:has-text("Regenerate")').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  // inspect
  const inspectInp = page.locator('input[placeholder*="Inspect"], input[placeholder*="inspect"]').first();
  await inspectInp.fill('98f8ac81-9299-40b2-beff-ff3087fc434f').catch(()=>{});
  await page.locator('button:has-text("Inspect")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const inspBody = await page.locator('body').innerText();
  return { uuidV4, uuidV7, v5HasInputs:/namespace|name/i.test(v5body), inspectWorks:/version|variant|v4|timestamp/i.test(inspBody) };
}

async function hashTest(page){
  await page.locator('textarea').first().fill('hello world');
  await page.waitForTimeout(600);
  const body = await page.locator('body').innerText();
  // md5 of "hello world" = 5eb63bbbe01eeed093cb22bb8f5acdc3
  const md5ok = body.includes('5eb63bbbe01eeed093cb22bb8f5acdc3');
  // sha256 = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
  const sha256ok = body.includes('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  // verify checksum
  const verifyInp = page.locator('input[type=text]').first();
  await verifyInp.fill('5eb63bbbe01eeed093cb22bb8f5acdc3');
  await page.waitForTimeout(400);
  const verifBody = await page.locator('body').innerText();
  // HMAC tab
  await page.locator('button:has-text("HMAC")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const hmacBody = await page.locator('body').innerText();
  return { md5ok, sha256ok, verifyMatch:/match|✓|valid|verified/i.test(verifBody), hmacTab:/key|secret/i.test(hmacBody) };
}

async function jwtTest(page){
  const sample = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  await page.locator('textarea').first().fill(sample);
  await page.waitForTimeout(600);
  const body = await page.locator('body').innerText();
  const decoded = /John Doe|HS256|1234567890|sub/i.test(body);
  // encode/sign tab
  await page.locator('button:has-text("Encode / Sign")').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  const encBody = await page.locator('body').innerText();
  // garbage jwt
  await page.locator('button:has-text("Decode")').first().click().catch(()=>{});
  await page.locator('textarea').first().fill('not.a.jwt');
  await page.waitForTimeout(400);
  const garbBody = await page.locator('body').innerText();
  return { decoded, encodeTab:/payload|secret|sign|algorithm/i.test(encBody), garbageHandled:/invalid|error|malformed/i.test(garbBody) };
}

for (const vw of [1440,390]) {
  results[`markdown_${vw}`] = await withPage('markdown', vw, mdTest);
  results[`css_${vw}`] = await withPage('css', vw, cssTest);
  results[`timestamp_${vw}`] = await withPage('timestamp', vw, tsTest);
  results[`uuid_${vw}`] = await withPage('uuid', vw, uuidTest);
  results[`hash_${vw}`] = await withPage('hash', vw, hashTest);
  results[`jwt_${vw}`] = await withPage('jwt', vw, jwtTest);
}
console.log(JSON.stringify(results,null,1));
await browser.close();
